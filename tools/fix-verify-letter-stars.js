// 修掉 verify-ai-letter.js 里被脱敏占位符 *** 替换掉的真实代码
// 注意：本文件刻意只用单引号 + fromCharCode 拼接，不写任何反斜杠转义，
// 避免 fix-literal-newlines 之类的后处理破坏语法。
const fs = require('fs');
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(39);
const p = 'D:/clawd_workspace/projects/moonlit-treehouse/tools/verify-ai-letter.js';

let s = fs.readFileSync(p, 'utf8');
const STAR = '***';
const before = s.split(STAR).length - 1;
console.log('修复前 *** 出现次数: ' + before);

// 1) Authorization 头：'***' + tk  ->  'Bearer ' + tk
s = s.split(Q + STAR + Q + ' + tk').join(Q + 'Bearer ' + Q + ' + tk');
s = s.split(Q + STAR + Q + ' + token').join(Q + 'Bearer ' + Q + ' + token');

// 2) KEY 读取语句
const badKey = 'const KEY = ' + STAR + Q + 'D:/clawd_workspace/.credentials/ark-api-key.txt'
  + Q + ', ' + Q + 'utf8' + Q + ').trim();';
const goodKey = 'const KEY = fs.readFileSync(' + Q + 'D:/clawd_workspace/.credentials/ark-api-key.txt'
  + Q + ', ' + Q + 'utf8' + Q + ').trim();';
s = s.split(badKey).join(goodKey);

// 3) env 注入
s = s.split('TREEHOUSE_AI_API_KEY: ' + STAR).join('TREEHOUSE_AI_API_KEY: KEY');

fs.writeFileSync(p, s, 'utf8');

const after = s.split(STAR).length - 1;
console.log('修复后残留: ' + after);
if (after > 0) {
  s.split(NL).forEach(function (l, k) {
    if (l.indexOf(STAR) >= 0) console.log('  L' + (k + 1) + ': ' + l.trim().slice(0, 95));
  });
}
