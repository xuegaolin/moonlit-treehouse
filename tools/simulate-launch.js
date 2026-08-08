// tools/simulate-launch.js — 用 Node 模拟微信小程序运行时，验证启动流程不会崩
//
// 目的：小程序 DevTools 白屏往往是 App()/onLaunch/onShow 里抛异常，控制台被吞掉。
//      这里搭一个最小 wx / App / Page / Component / getApp 沙箱，真实 require 业务代码，
//      跑完整启动链路：App() → onLaunch → onShow → 首页 onLoad → onShow。
//      任何 TypeError 都会在这里暴露。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const root = path.resolve(process.argv[2] || 'miniprogram');
const logs = [];
const errors = [];

// ---------- wx API mock ----------
const storage = {};
const wx = {
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop', appId: 'wxtest' } }),
  getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 375, windowHeight: 667, statusBarHeight: 20 }),
  getLaunchOptionsSync: () => ({ scene: 1001, path: 'pages/home/home', query: {}, referrerInfo: {} }),
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  getStorage: (o) => o && o.fail && o.fail({ errMsg: 'mock' }),
  setStorage: (o) => o && o.success && o.success({}),
  removeStorage: (o) => o && o.success && o.success({}),
  login: (o) => setTimeout(() => o.success && o.success({ code: 'MOCK_CODE_123' }), 0),
  request: (o) => {
    logs.push('wx.request ' + (o.method || 'GET') + ' ' + o.url);
    // 模拟后端未启动：走 fail 分支，验证兜底逻辑
    setTimeout(() => o.fail && o.fail({ errMsg: 'request:fail ECONNREFUSED' }), 0);
  },
  uploadFile: (o) => {
    logs.push('wx.uploadFile ' + o.url);
    setTimeout(() => o.fail && o.fail({ errMsg: 'uploadFile:fail' }), 0);
  },
  showToast: (o) => logs.push('toast: ' + (o && o.title)),
  hideToast: () => {},
  showLoading: (o) => logs.push('loading: ' + (o && o.title)),
  hideLoading: () => {},
  showModal: (o) => o && o.success && o.success({ confirm: false, cancel: true }),
  showActionSheet: (o) => o && o.fail && o.fail({ errMsg: 'cancel' }),
  navigateTo: (o) => { logs.push('navigateTo ' + o.url); o.success && o.success({}); },
  redirectTo: (o) => { logs.push('redirectTo ' + o.url); o.success && o.success({}); },
  switchTab: (o) => { logs.push('switchTab ' + o.url); o.success && o.success({}); },
  reLaunch: (o) => { logs.push('reLaunch ' + o.url); o.success && o.success({}); },
  navigateBack: () => logs.push('navigateBack'),
  setNavigationBarTitle: () => {},
  createSelectorQuery: () => {
    const q = {
      select: () => q,
      selectAll: () => q,
      selectViewport: () => q,
      fields: () => q,
      boundingClientRect: () => q,
      node: () => q,
      exec: (cb) => cb && cb([null]),
      in: () => q,
    };
    return q;
  },
  createCanvasContext: () => new Proxy({}, { get: () => () => {} }),
  canvasToTempFilePath: (o) => o && o.fail && o.fail({ errMsg: 'mock' }),
  createAnimation: () => new Proxy({}, { get: () => () => ({ export: () => ({}) }) }),
  saveImageToPhotosAlbum: (o) => o && o.fail && o.fail({ errMsg: 'mock' }),
  getImageInfo: (o) => o && o.fail && o.fail({ errMsg: 'mock' }),
  chooseMedia: (o) => o && o.fail && o.fail({ errMsg: 'cancel' }),
  chooseImage: (o) => o && o.fail && o.fail({ errMsg: 'cancel' }),
  vibrateShort: () => {},
  vibrateLong: () => {},
  setClipboardData: (o) => o && o.success && o.success({}),
  requestPayment: (o) => o && o.fail && o.fail({ errMsg: 'mock' }),
  nextTick: (fn) => setTimeout(fn, 0),
  getUpdateManager: () => ({ onCheckForUpdate() {}, onUpdateReady() {}, onUpdateFailed() {}, applyUpdate() {} }),
  onError: () => {},
  reportAnalytics: () => {},
  setInnerAudioOption: () => {},
  createInnerAudioContext: () => ({ play() {}, stop() {}, destroy() {}, onPlay() {}, onError() {} }),
};

// ---------- App / Page / Component mock ----------
let appInstance = null;
const pageDefs = {};
const componentDefs = {};

function AppMock(def) {
  appInstance = Object.assign({}, def);
  appInstance.globalData = def.globalData || {};
  try {
    if (typeof appInstance.onLaunch === 'function') {
      appInstance.onLaunch.call(appInstance, wx.getLaunchOptionsSync());
    }
  } catch (e) {
    errors.push('App.onLaunch 抛异常: ' + e.stack);
  }
}

function getAppMock() {
  return appInstance;
}

function makePageInstance(def, route) {
  const inst = Object.assign({}, def);
  inst.data = JSON.parse(JSON.stringify(def.data || {}));
  inst.route = route;
  inst.setData = function (patch, cb) {
    Object.assign(inst.data, patch);
    if (typeof cb === 'function') cb();
  };
  inst.selectComponent = () => null;
  inst.selectAllComponents = () => [];
  inst.animate = () => {};
  inst.createSelectorQuery = wx.createSelectorQuery;
  inst.triggerEvent = () => {};
  return inst;
}

// ---------- 模块加载器（把 wx/App/Page/Component/getApp 注入作用域）----------
const cache = {};
function loadModule(file) {
  const abs = path.resolve(file);
  if (cache[abs]) return cache[abs].exports;

  const src = fs.readFileSync(abs, 'utf8');
  const mod = { exports: {}, id: abs, filename: abs };
  cache[abs] = mod;

  const dirname = path.dirname(abs);
  const localRequire = (p) => {
    if (p.startsWith('.') || p.startsWith('/')) {
      let target = path.resolve(dirname, p);
      if (!fs.existsSync(target)) {
        if (fs.existsSync(target + '.js')) target += '.js';
        else if (fs.existsSync(path.join(target, 'index.js'))) target = path.join(target, 'index.js');
        else throw new Error('模块找不到: ' + p + ' (from ' + path.relative(root, abs) + ')');
      }
      return loadModule(target);
    }
    return require(p);
  };

  const wrapper = `(function(exports, require, module, __filename, __dirname, wx, App, Page, Component, Behavior, getApp, getCurrentPages){\n${src}\n})`;
  const fn = vm.runInThisContext(wrapper, { filename: abs });
  fn.call(
    mod.exports,
    mod.exports,
    localRequire,
    mod,
    abs,
    dirname,
    wx,
    AppMock,
    (def) => { pageDefs[abs] = def; },
    (def) => { componentDefs[abs] = def; },
    (def) => def,
    getAppMock,
    () => [{ route: 'pages/home/home' }]
  );
  return mod.exports;
}

// ---------- 开跑 ----------
console.log('=== 1. 加载 app.js（触发 App() + onLaunch）===');
try {
  loadModule(path.join(root, 'app.js'));
  console.log('  ✓ app.js 加载成功, globalData.baseUrl =', appInstance && appInstance.globalData.baseUrl);
} catch (e) {
  errors.push('app.js 加载失败: ' + e.stack);
  console.log('  ✗ ' + e.message);
}

console.log('\n=== 2. App.onShow（静默登录在此触发）===');
try {
  if (appInstance && typeof appInstance.onShow === 'function') {
    appInstance.onShow.call(appInstance, {});
    console.log('  ✓ onShow 执行完毕');
  } else {
    console.log('  - 无 onShow');
  }
} catch (e) {
  errors.push('App.onShow 抛异常: ' + e.stack);
  console.log('  ✗ ' + e.message);
}

console.log('\n=== 3. 逐个加载页面并跑 onLoad / onShow / onReady ===');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
for (const p of appJson.pages) {
  const jsPath = path.join(root, p + '.js');
  process.stdout.write('  ' + p + ' ... ');
  try {
    loadModule(jsPath);
    const def = pageDefs[path.resolve(jsPath)];
    if (!def) { console.log('✗ 未调用 Page()'); errors.push(p + ' 未调用 Page()'); continue; }
    const inst = makePageInstance(def, p);
    const hooks = ['onLoad', 'onShow', 'onReady'];
    for (const h of hooks) {
      if (typeof inst[h] === 'function') {
        inst[h].call(inst, {});
      }
    }
    console.log('✓');
  } catch (e) {
    console.log('✗ ' + e.message);
    errors.push(p + ' 生命周期抛异常: ' + e.stack);
  }
}

console.log('\n=== 4. 组件加载 ===');
function walkDir(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkDir(p, acc); else acc.push(p);
  }
  return acc;
}
for (const f of walkDir(path.join(root, 'components')).filter((f) => f.endsWith('.js'))) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  process.stdout.write('  ' + rel + ' ... ');
  try {
    loadModule(f);
    const def = componentDefs[path.resolve(f)];
    console.log(def ? '✓' : '✗ 未调用 Component()');
    if (!def) errors.push(rel + ' 未调用 Component()');
  } catch (e) {
    console.log('✗ ' + e.message);
    errors.push(rel + ': ' + e.stack);
  }
}

// 等异步回调（登录 fail、request fail 等）跑完
setTimeout(() => {
  console.log('\n=== 5. 异步回调日志 ===');
  logs.forEach((l) => console.log('  ' + l));

  console.log('\n=== 结果 ===');
  if (errors.length) {
    console.log('✗ 发现 ' + errors.length + ' 个运行时错误：\n');
    errors.forEach((e, i) => console.log('[' + (i + 1) + '] ' + e + '\n'));
    process.exitCode = 1;
  } else {
    console.log('✓ 启动链路全部通过，无运行时异常（含后端未启动的兜底路径）');
  }
}, 300);
