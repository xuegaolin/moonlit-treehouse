// 对比 JPA Entity 字段 vs MySQL 实际表结构，找出 Unknown column 类问题
// 用法: node tools/check-schema.js [backendDir]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BACKEND = process.argv[2] || path.join(__dirname, '..', 'backend');
const ENTITY_DIR = path.join(BACKEND, 'src', 'main', 'java', 'com', 'treehouse', 'entity');

function camelToSnake(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function mysql(sql) {
  try {
    return execFileSync('mysql', ['-uroot', '-N', '-B', '-e', sql], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { MYSQL_PWD: 'root' })
    });
  } catch (e) {
    return null;
  }
}

// 1. 读所有 Entity
if (!fs.existsSync(ENTITY_DIR)) {
  console.log('ENTITY_DIR not found: ' + ENTITY_DIR);
  process.exit(1);
}
const files = fs.readdirSync(ENTITY_DIR).filter(f => f.endsWith('.java'));
console.log('found ' + files.length + ' entity files\n');

let problems = 0;

files.forEach(f => {
  const src = fs.readFileSync(path.join(ENTITY_DIR, f), 'utf8');

  // @Table(name = "xxx")
  const tm = src.match(/@Table\s*\(\s*name\s*=\s*"([^"]+)"/);
  if (!tm) return;
  const table = tm[1];

  // 实际表列
  const out = mysql('USE treehouse; SHOW COLUMNS FROM `' + table + '`;');
  if (out === null) {
    console.log('[SKIP] ' + f + ' -> table ' + table + ' (query failed / table missing)');
    problems++;
    return;
  }
  const dbCols = out.trim().split(/\r?\n/).filter(Boolean).map(l => l.split('\t')[0]);

  // Entity 字段：抓 private <Type> <name>;  跳过 @Transient / static / final 常量
  const entityCols = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(/^\s*private\s+(?:static\s+)?(?:final\s+)?[\w<>,.\[\]\s]+?\s+(\w+)\s*[;=]/);
    if (!fm) continue;
    // 往上看 5 行找 @Column(name=) / @Transient
    let explicit = null, transient = false;
    for (let j = Math.max(0, i - 6); j < i; j++) {
      if (/@Transient/.test(lines[j])) transient = true;
      const cm = lines[j].match(/@Column\s*\([^)]*name\s*=\s*"([^"]+)"/);
      if (cm) explicit = cm[1];
      if (/@(OneToMany|ManyToMany|OneToOne|ManyToOne)/.test(lines[j])) transient = true;
    }
    if (transient) continue;
    entityCols.push({ field: fm[1], col: explicit || camelToSnake(fm[1]) });
  }

  const missing = entityCols.filter(c => !dbCols.includes(c.col));
  const extra = dbCols.filter(c => !entityCols.some(e => e.col === c));

  if (missing.length || extra.length) {
    console.log('--- ' + f + '  ->  ' + table);
    missing.forEach(m => {
      console.log('  MISSING IN DB: ' + m.col + '   (entity field: ' + m.field + ')');
      problems++;
    });
    extra.forEach(e => console.log('  db-only col:   ' + e));
    console.log('');
  }
});

console.log(problems === 0 ? 'SCHEMA OK - no missing columns' : 'PROBLEMS: ' + problems);
