// 扫描 style="{{...}}" 里含括号的 CSS 函数 —— WXML 解析器会报
// Bad attr `style` with message: error at token `)`
// 用法: node tools/lint-wxml-style.js <miniprogramDir>
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || 'miniprogram';
let issues = 0;
let scanned = 0;

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'miniprogram_npm') return;
      walk(full);
    } else if (e.name.endsWith('.wxml')) {
      check(full);
    }
  });
}

function check(file) {
  scanned++;
  const lines = fs.readFileSync(file, 'utf8').split(String.fromCharCode(10));
  lines.forEach(function (line, i) {
    // 抓出所有 style="..." 的内容
    const m = line.match(/style="([^"]*)"/g);
    if (!m) return;
    m.forEach(function (attr) {
      if (attr.indexOf('{{') === -1) return;
      // 取 {{ }} 之间的表达式
      const exprs = attr.match(/\{\{([^}]*)\}\}/g) || [];
      exprs.forEach(function (ex) {
        // 表达式里出现 ( 或 ) 就是危险的
        if (/[()]/.test(ex)) {
          issues++;
          console.log('[STYLE-PAREN] ' + file + ':' + (i + 1));
          console.log('    ' + line.trim().slice(0, 140));
          console.log('    -> 改用 class 切换，渐变/CSS 函数写进 WXSS');
        }
      });
    });
  });
}

walk(root);
console.log('');
console.log('scanned wxml: ' + scanned);
console.log('issues: ' + issues);
process.exit(issues > 0 ? 1 : 0);
