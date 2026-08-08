// tools/lint-wxml.js — WXML/WXSS 深度静态检查
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || 'miniprogram';
const out = [];
const log = (s) => out.push(s);

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'miniprogram_npm'].includes(e.name)) continue;
      walk(p, acc);
    } else acc.push(p.split(path.sep).join('/'));
  }
  return acc;
}

const files = walk(root);

// ---- WXML ----
const SELF_CLOSING_OK = ['image', 'input', 'icon', 'progress', 'switch', 'slider', 'audio', 'video', 'camera', 'canvas', 'checkbox', 'radio', 'textarea', 'import', 'include', 'wxs'];

for (const f of files.filter((x) => x.endsWith('.wxml'))) {
  const rawSrc = fs.readFileSync(f, 'utf8');
  // 剔除 HTML 注释（保留行数），避免注释里的示例代码误报
  const src = rawSrc.replace(/<!--[\s\S]*?-->/g, (mm) => mm.replace(/[^\n]/g, ' '));

  // 1. 标签栈严格配平
  //    void 标签只在本文件确实没有对应闭合标签时才当作自闭合，避免 <canvas></canvas> 误报
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const [, slash, tag, , selfClose] = m;
    const line = src.slice(0, m.index).split('\n').length;
    if (slash) {
      if (!stack.length) { log(`[配平] ${f}:${line} 多余闭合 </${tag}>`); continue; }
      const top = stack.pop();
      if (top.tag !== tag) log(`[配平] ${f}:${line} </${tag}> 与 <${top.tag}>(第${top.line}行) 不匹配`);
    } else if (!selfClose) {
      const hasClose = src.includes('</' + tag + '>');
      if (SELF_CLOSING_OK.includes(tag) && !hasClose) continue;
      stack.push({ tag, line });
    }
  }
  for (const s of stack) log(`[配平] ${f}:${s.line} <${s.tag}> 未闭合`);

  // 2. {{ }} 花括号配平
  const open = (src.match(/\{\{/g) || []).length;
  const close = (src.match(/\}\}/g) || []).length;
  if (open !== close) log(`[插值] ${f} {{=${open} }}=${close}`);

  // 3. 插值内出现双引号（会截断属性值）
  const iv = /\{\{([^}]*)\}\}/g;
  while ((m = iv.exec(src))) {
    if (m[1].includes('"')) {
      const line = src.slice(0, m.index).split('\n').length;
      log(`[插值] ${f}:${line} 插值内含双引号，会截断属性: ${m[0].slice(0, 60)}`);
    }
  }

  // 4. wx:for 缺 wx:key（按整个开始标签判断，支持属性换行写法）
  const tagRe = /<[a-zA-Z][a-zA-Z0-9-]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
  while ((m = tagRe.exec(src))) {
    const t = m[0];
    if (!t.includes('wx:for=')) continue;
    if (t.includes('wx:key=')) continue;
    const line = src.slice(0, m.index).split('\n').length;
    log(`[wx:key] ${f}:${line} wx:for 未指定 wx:key（DevTools 会告警）`);
  }

  // 5. 事件绑定的处理函数是否存在于同名 js
  const js = f.replace(/\.wxml$/, '.js');
  if (fs.existsSync(js)) {
    const jsSrc = fs.readFileSync(js, 'utf8');
    const ev = /\b(?:bind|catch|capture-bind|capture-catch)[:]?([a-zA-Z]+)\s*=\s*"([^"{}]+)"/g;
    const seen = new Set();
    while ((m = ev.exec(src))) {
      const fn = m[2].trim();
      if (!fn || seen.has(fn)) continue;
      seen.add(fn);
      if (!new RegExp('\\b' + fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:(=]').test(jsSrc)) {
        log(`[事件] ${f} -> ${fn} 在 ${path.basename(js)} 中未找到`);
      }
    }
  }

  // 6. 非法条件指令：微信只认 wx:if / wx:elif / wx:else
  //    wx:else-if / wx:elseif / v-else-if 会直接 WXML 编译报错
  const badDirective = /wx:(else-if|elseif|else_if|if-else)\b/g;
  while ((m = badDirective.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    log(`[指令] ${f}:${line} 非法指令 wx:${m[1]}，微信只支持 wx:elif`);
  }

  // 7. wx:elif / wx:else 前面必须有同级 wx:if（编译报错：wx:if not found）
  {
    const dirRe = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
    let hasIfAtDepth = {};
    let depth = 0;
    const tagRe2 = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
    let t;
    while ((t = tagRe2.exec(src))) {
      const [, slash, tag, attrs, selfClose] = t;
      const line = src.slice(0, t.index).split('\n').length;
      if (slash) { depth = Math.max(0, depth - 1); continue; }

      if (/\bwx:if\s*=/.test(attrs)) {
        hasIfAtDepth[depth] = true;
      } else if (/\bwx:(elif|else)\b/.test(attrs)) {
        if (!hasIfAtDepth[depth]) {
          const which = /\bwx:elif\b/.test(attrs) ? 'wx:elif' : 'wx:else';
          log(`[指令] ${f}:${line} ${which} 前面没有同级 wx:if（编译报错 "wx:if not found"）`);
        }
      } else if (!/\bwx:(elif|else)\b/.test(attrs)) {
        // 普通元素会断开 if/elif 链
        hasIfAtDepth[depth] = false;
      }

      if (!selfClose && !SELF_CLOSING_OK.includes(tag)) {
        depth++;
        hasIfAtDepth[depth] = false;
      }
    }
  }

  // 8. 插值里调用方法 —— WXML 不支持，静默渲染为空
  //    但 CSS 函数（linear-gradient / rgba / calc 等）在字符串字面里是合法的，需白名单
  {
    const CSS_FN = /^(linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|rgba?|hsla?|calc|url|var|translate[XYZ]?|translate3d|rotate|scale|blur|drop-shadow|cubic-bezier|env|min|max|clamp)$/;
    const ivRe = /\{\{([^}]*)\}\}/g;
    while ((m = ivRe.exec(src))) {
      const expr = m[1];
      const line = src.slice(0, m.index).split('\n').length;
      // 剔除字符串字面（CSS 值常写在引号里）
      const noStr = expr.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
      const callRe = /([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\s*\(/g;
      let c;
      while ((c = callRe.exec(noStr))) {
        const fn = c[1];
        const base = fn.split('.').pop();
        if (CSS_FN.test(fn) || CSS_FN.test(base)) continue;
        log(`[插值] ${f}:${line} WXML 不支持方法调用 ${fn}(...)，需在 JS 里预算好放进 data`);
      }
    }
  }

  // 9. 插值里的字面 \n（WXML 不转义，会原样渲染成两个字符）
  src.split('\n').forEach((l, i) => {
    if (/>\s*\\n|\\n\s*\{\{|\{\{[^}]*\}\}\\n/.test(l)) {
      log(`[文本] ${f}:${i + 1} 存在字面 \\n，WXML 不转义，会原样显示`);
    }
  });
}

// ---- WXSS ----
for (const f of files.filter((x) => x.endsWith('.wxss'))) {
  const src = fs.readFileSync(f, 'utf8');
  const ob = (src.match(/\{/g) || []).length;
  const cb = (src.match(/\}/g) || []).length;
  if (ob !== cb) log(`[WXSS] ${f} {=${ob} }=${cb}`);
  const im = /@import\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = im.exec(src))) {
    const t = path.posix.join(path.posix.dirname(f), m[1]);
    if (!fs.existsSync(t)) log(`[WXSS] ${f} @import 找不到: ${m[1]}`);
  }
}

console.log(out.length ? out.join('\n') : '无问题');
console.log('--- 问题总数: ' + out.length);
