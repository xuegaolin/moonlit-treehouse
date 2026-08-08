const fs = require('fs');
const path = require('path');

const ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse/backend/src/main/java';\n\nfunction walk(dir, out) {\n  out = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else if (d.name.endsWith('.java')) out.push(p);
  });
  return out;
}

const files = walk(ROOT);
console.log('total java files: ' + files.length);
console.log('');
console.log('=== ENTITIES (@Table) ===');
files.forEach(function (f) {
  const s = fs.readFileSync(f, 'utf8');
  const tm = s.match(/@Table\s*\(\s*name\s*=\s*"([^"]+)"/);
  if (tm) console.log('  ' + tm[1] + '  <-  ' + path.relative(ROOT, f));
});

console.log('');
console.log('=== MOKUGYO RELATED ===');
files.forEach(function (f) {
  const s = fs.readFileSync(f, 'utf8');
  if (!/mokugyo/i.test(s)) return;
  console.log('');
  console.log('--- ' + path.relative(ROOT, f));
  s.split(/\r?\n/).forEach(function (l, i) {
    const t = l.trim();
    if (!t || t.indexOf('*') === 0 || t.indexOf('//') === 0) return;
    if (/mokugyo/i.test(t) || /\btap\b/i.test(t)) {
      console.log('  ' + (i + 1) + ': ' + t.slice(0, 140));
    }
  });
});
