// 一键全量检查：改完代码、DevTools 编译前跑这一个就够
// 用法: node tools/check-all.js [miniprogramDir]
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const MP = process.argv[2] || 'miniprogram';

const STEPS = [
  { name: 'WXML 编译错误 + 方法调用',  cmd: ['tools/lint-wxml.js', MP] },
  { name: 'WXML style 括号陷阱',       cmd: ['tools/lint-wxml-style.js', MP] },
  { name: '页面注册 / 组件 / 图标',     cmd: ['tools/check-miniprogram.js'], cwd: path.join(ROOT, MP), rel: '../tools/check-miniprogram.js' },
  { name: '启动生命周期模拟',           cmd: ['tools/simulate-launch.js', MP] }
];

let failed = 0;
const results = [];

STEPS.forEach(function (s) {
  const label = s.name;
  const cwd = s.cwd || ROOT;
  const args = s.rel ? [s.rel] : s.cmd;
  let ok = true;
  let out = '';
  try {
    out = execFileSync('node', args, { cwd: cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // simulate-launch 成功时也可能 exit 非 0（历史行为），用输出关键字判定
    out = String((e.stdout || '') + (e.stderr || ''));
    ok = /全部通过|0 问题|issues: 0|问题总数: 0/.test(out);
    if (!ok) failed++;
  }
  results.push({ label: label, ok: ok, out: out.trim() });
});

const NL = String.fromCharCode(10);
const lines = [];
lines.push('================ 小程序全量检查 ================');
results.forEach(function (r) {
  lines.push('');
  lines.push((r.ok ? '[PASS] ' : '[FAIL] ') + r.label);
  if (!r.ok) {
    lines.push(r.out.split(NL).slice(-12).map(function (l) { return '    ' + l; }).join(NL));
  }
});
lines.push('');
lines.push('===============================================');
lines.push(failed === 0 ? '全部通过，可以去 DevTools 编译' : failed + ' 项失败，先修再编译');

const report = lines.join(NL);
console.log(report);
fs.writeFileSync(path.join(ROOT, 'tools', 'last-check.txt'), report, 'utf8');
process.exit(failed === 0 ? 0 : 1);
