// 校验 home 页签到功能的 WXML/JS/WXSS 三方一致性
// 静态检查过了不代表绑定对得上：bindtap 指向的方法是否存在、
// WXML 用到的 data 字段是否声明、class 是否有对应样式。
const fs = require('fs');
const NL = String.fromCharCode(10);
const BASE = 'D:/clawd_workspace/projects/moonlit-treehouse/miniprogram/';
const DIR = BASE + 'pages/home/';

const wxml = fs.readFileSync(DIR + 'home.wxml', 'utf8');
const js = fs.readFileSync(DIR + 'home.js', 'utf8');
const wxss = fs.readFileSync(DIR + 'home.wxss', 'utf8');

let fail = 0;

// 1) bindtap/catchtap 指向的方法必须在 js 里定义
console.log('=== 1. 事件绑定 -> JS 方法 ===');
const handlers = [];
const reH = /(?:bindtap|catchtap)="([A-Za-z0-9_]+)"/g;
let m;
while ((m = reH.exec(wxml)) !== null) {
  if (handlers.indexOf(m[1]) < 0) handlers.push(m[1]);
}
handlers.forEach(function (h) {
  const defined = new RegExp('[\\s{]' + h + '\\s*:\\s*function').test(js);
  console.log('  ' + (defined ? '[OK]  ' : '[缺失]') + ' ' + h);
  if (!defined) fail++;
});

// 2) WXML 里 {{}} 用到的顶层字段必须在 data 里声明
console.log('');
console.log('=== 2. 模板字段 -> data 声明 ===');
const dataStart = js.indexOf('data: {');
const dataEnd = js.indexOf(NL + '  },', dataStart);
const dataBlock = dataStart >= 0 ? js.slice(dataStart, dataEnd) : '';
const fields = [];
const reF = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)/g;
while ((m = reF.exec(wxml)) !== null) {
  const f = m[1];
  if (f === 'item' || f === 'true' || f === 'false') continue;
  if (fields.indexOf(f) < 0) fields.push(f);
}
fields.forEach(function (f) {
  const declared = new RegExp('[\\s{]' + f + '\\s*:').test(dataBlock);
  console.log('  ' + (declared ? '[OK]  ' : '[未声明]') + ' ' + f);
  if (!declared) fail++;
});

// 3) 签到相关 class 必须有样式
console.log('');
console.log('=== 3. 关键 class -> WXSS 样式 ===');
const keyClasses = ['checkin', 'checkin-top', 'checkin-btn', 'checkin-btn-done',
  'checkin-cal', 'cal-cell', 'cal-cell-on', 'cal-dot', 'cal-label',
  'mask', 'result-card', 'result-streak', 'result-encourage', 'result-coin',
  'result-medals', 'result-medal', 'result-close'];
keyClasses.forEach(function (c) {
  const has = wxss.indexOf('.' + c) >= 0;
  console.log('  ' + (has ? '[OK]  ' : '[缺样式]') + ' .' + c);
  if (!has) fail++;
});

// 4) utils/checkin.js 导出的方法与 home.js 调用一致
console.log('');
console.log('=== 4. utils/checkin.js 调用一致性 ===');
const util = fs.readFileSync(BASE + 'utils/checkin.js', 'utf8');
const used = [];
const DOT = String.fromCharCode(92) + '.';
const reU = new RegExp('checkin' + DOT + '([A-Za-z0-9_]+)' + String.fromCharCode(92) + '(', 'g');
while ((m = reU.exec(js)) !== null) {
  if (used.indexOf(m[1]) < 0) used.push(m[1]);
}
used.forEach(function (u) {
  const exported = new RegExp(u + '\\s*:\\s*' + u).test(util);
  console.log('  ' + (exported ? '[OK]  ' : '[未导出]') + ' checkin.' + u + '()');
  if (!exported) fail++;
});

// 5) apiPaths 是否齐全
console.log('');
console.log('=== 5. config.js apiPaths ===');
const cfg = fs.readFileSync(BASE + 'utils/config.js', 'utf8');
['checkinDo', 'checkinStatus', 'checkinMedals'].forEach(function (k) {
  const has = cfg.indexOf(k + ':') >= 0;
  console.log('  ' + (has ? '[OK]  ' : '[缺失]') + ' ' + k);
  if (!has) fail++;
});

console.log('');
console.log('===============================');
console.log(fail === 0 ? 'PASS: 签到 UI 三方绑定全部一致' : 'FAIL: ' + fail + ' 处不一致');
process.exit(fail === 0 ? 0 : 1);
