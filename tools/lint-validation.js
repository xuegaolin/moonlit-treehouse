// 扫描 @NotBlank / @NotEmpty 用在非字符串/非集合类型上（Bean Validation 会抛 UnexpectedTypeException）
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || 'src/main/java';

const STRING_OK = ['String', 'CharSequence'];
const COLLECTION_OK = ['List', 'Set', 'Map', 'Collection', 'String', 'CharSequence'];

function walk(dir, out) {
  out = out || [];
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, out);
    else if (it.name.endsWith('.java')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
let problems = 0;
let checked = 0;

for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  if (!/@NotBlank|@NotEmpty/.test(txt)) continue;
  const lines = txt.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/@(NotBlank|NotEmpty)\b/);
    if (!m) continue;
    const ann = m[1];

    // 往下找最近的字段声明
    let decl = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const d = lines[j].match(/private\s+([\w<>,\s\[\]]+?)\s+(\w+)\s*[=;]/);
      if (d) { decl = { type: d[1].trim(), name: d[2] }; break; }
      if (/private|public|protected/.test(lines[j])) break;
    }
    if (!decl) continue;
    checked++;

    const baseType = decl.type.replace(/<.*>/, '').trim();
    const allowed = ann === 'NotBlank' ? STRING_OK : COLLECTION_OK;
    if (allowed.indexOf(baseType) < 0) {
      problems++;
      const fix = ann === 'NotBlank' ? '@NotNull' : (baseType === 'Integer' || baseType === 'Long' ? '@NotNull' : '@NotNull');
      console.log('BAD  ' + path.relative(ROOT, file));
      console.log('     line ' + (i + 1) + ': @' + ann + ' on ' + decl.type + ' ' + decl.name);
      console.log('     -> should be ' + fix + '  (@' + ann + ' only supports ' + allowed.join('/') + ')');
      console.log('');
    }
  }
}

console.log('--- scanned ' + files.length + ' java files, ' + checked + ' annotated fields ---');
console.log(problems === 0 ? 'OK: no invalid @NotBlank/@NotEmpty usage' : 'FOUND ' + problems + ' invalid annotation(s)');
process.exit(problems === 0 ? 0 : 1);
