// _check.js — 小程序静态自检（临时脚本，检查完可删）
const fs = require('fs');
const path = require('path');

const out = [];
const log = (s) => out.push(s);

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'miniprogram_npm') continue;
      walk(p, acc);
    } else acc.push(p.split(path.sep).join('/'));
  }
  return acc;
}

const files = walk('.');

// 1. JS 语法
for (const f of files.filter((f) => f.endsWith('.js') && f !== '_check.js')) {
  try {
    new Function(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    log('[JS语法] ' + f + ' :: ' + e.message);
  }
}

// 2. app.json 页面四件套齐全
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
for (const p of app.pages) {
  for (const ext of ['js', 'json', 'wxml', 'wxss']) {
    if (!fs.existsSync(p + '.' + ext)) log('[缺文件] ' + p + '.' + ext);
  }
}

// 3. tabBar
const tabs = (app.tabBar && app.tabBar.list) || [];
tabs.forEach((t) => {
  if (!app.pages.includes(t.pagePath)) log('[tabBar] pagePath 未在 pages 中: ' + t.pagePath);
  ['iconPath', 'selectedIconPath'].forEach((k) => {
    if (t[k] && !fs.existsSync(t[k])) log('[tabBar] 图标缺失: ' + t[k]);
  });
});

// 4. 磁盘上有页面但没注册
const pageDirs = [
  ...new Set(
    files
      .filter((f) => f.startsWith('pages/'))
      .map((f) => f.replace(/\.[a-z]+$/, ''))
  ),
];
for (const d of pageDirs) {
  if (!app.pages.includes(d)) log('[未注册页面] ' + d);
}

// 5. usingComponents 能否解析到
for (const f of files.filter((f) => f.endsWith('.json'))) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    log('[JSON解析失败] ' + f + ' :: ' + e.message);
    continue;
  }
  const uc = j.usingComponents || {};
  for (const [name, p] of Object.entries(uc)) {
    let target = p.startsWith('/')
      ? p.slice(1)
      : path.posix.join(path.posix.dirname(f), p);
    if (!fs.existsSync(target + '.js') || !fs.existsSync(target + '.wxml')) {
      log('[组件找不到] ' + f + ' -> ' + name + ' = ' + p);
    }
  }
}

// 6. 跳转路径是否已注册
for (const f of files.filter((f) => (f.endsWith('.js') || f.endsWith('.wxml')) && f !== '_check.js')) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /['"](\/pages\/[a-zA-Z0-9_\-/]+)(\?[^'"]*)?['"]/g;
  let m;
  while ((m = re.exec(s))) {
    const pg = m[1].slice(1);
    if (!app.pages.includes(pg)) log('[跳转目标未注册] ' + f + ' -> ' + m[1]);
  }
}

// 7. WXML 标签配对
const PAIR = ['view', 'block', 'scroll-view', 'swiper', 'swiper-item', 'text', 'button', 'form', 'picker', 'label', 'navigator', 'movable-area', 'movable-view'];
for (const f of files.filter((f) => f.endsWith('.wxml'))) {
  const s = fs.readFileSync(f, 'utf8');
  for (const tag of PAIR) {
    const open = (s.match(new RegExp('<' + tag + '(?=[\\s>])(?![^>]*/>)', 'g')) || []).length;
    const close = (s.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (open !== close) log('[WXML标签] ' + f + ' <' + tag + '> open=' + open + ' close=' + close);
  }
}

// 8. 请求头 / 关键配置
const rq = fs.readFileSync('utils/request.js', 'utf8');
rq.split('\n').forEach((l, i) => {
  if (l.includes('Authorization')) log('[请求头] utils/request.js:' + (i + 1) + '  ' + l.trim());
});
const appjs = fs.readFileSync('app.js', 'utf8');
const bm = appjs.match(/baseUrl:\s*'([^']+)'/);
log('[baseUrl] ' + (bm ? bm[1] : '未找到'));

// 9. 非法字符 / 乱码检测
for (const f of files.filter((f) => /\.(js|json|wxml|wxss)$/.test(f))) {
  const s = fs.readFileSync(f, 'utf8');
  if (s.includes('\ufffd')) log('[编码] 存在替换字符(乱码): ' + f);
}

console.log(out.length ? out.join('\n') : '无问题');
console.log('--- 问题总数: ' + out.length);
