// 直接验证 AiService 的 LLM 调用逻辑（复刻 Java 端 prompt，不依赖后端实例）
const fs = require('fs');
const https = require('https');

const KEY = fs.readFileSync('D:/clawd_workspace/.credentials/ark-api-key.txt', 'utf8').trim();
const BASE = 'https://ark.cn-beijing.volces.com/api/coding/v3';

// 与 BailanService.AI_SYSTEM_PROMPT 完全一致
const SYSTEM = '你是「月光寡人事务局」的公文起草员，专为深夜疲惫的年轻人开具『摆烂许可证』。'
  + '要求：1) 模仿正式公文腔（如“经核定”“依照”“准予”“特此批准”），'
  + '但内容必须温柔、荒诞、好笑，是给人安慰而非真的公文；'
  + '2) 可虚构法规名，如《人间打工人保护法》《周末延续特别条例》；'
  + '3) 60 字以内，一句话，不要分段，不要引号，不要 markdown；'
  + '4) 禁止说教、禁止劝人努力、禁止提及心理治疗或医疗建议。';

const SCENES = {
  monday: '场景：又是周一，完全不想上班。开一张今日摆烂许可。',
  period: '场景：生理期身体不适，只想躺着。开一张今日摆烂许可。',
  breakup: '场景：刚失恋，心里很空。开一张今日摆烂许可，注意温柔不要提“分手”二字。',
  no_reason: '场景：没什么具体原因，就是累了、什么都不想干。开一张今日摆烂许可。'
};

function call(model, system, user, maxTokens, temperature) {
  return new Promise(function (resolve) {
    const body = JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    });
    const u = new URL(BASE + '/chat/completions');
    const r = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () {
        try {
          const j = JSON.parse(d);
          const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          resolve({ ok: !!t, text: t, http: res.statusCode, raw: d.slice(0, 200) });
        } catch (e) { resolve({ ok: false, http: res.statusCode, raw: d.slice(0, 200) }); }
      });
    });
    r.on('timeout', function () { r.destroy(); resolve({ ok: false, http: 0, raw: 'timeout' }); });
    r.on('error', function (e) { resolve({ ok: false, http: 0, raw: e.message }); });
    r.write(body);
    r.end();
  });
}

// 复刻 AiService.stripWrappers
function strip(s) {
  let t = s.trim();
  if (t.indexOf('```') === 0) {
    const nl = t.indexOf(String.fromCharCode(10));
    if (nl > 0) t = t.substring(nl + 1);
    if (t.lastIndexOf('```') === t.length - 3) t = t.substring(0, t.length - 3);
    t = t.trim();
  }
  if (t.length > 1) {
    const a = t.charAt(0), b = t.charAt(t.length - 1);
    if ((a === '"' && b === '"') || (a === '\u201c' && b === '\u201d') || (a === '\u300c' && b === '\u300d')) {
      t = t.substring(1, t.length - 1).trim();
    }
  }
  return t;
}

(async function () {
  console.log('======== 摆烂理由：4 场景 × LLM 实时生成 ========');
  console.log('');
  const results = [];
  for (const k of Object.keys(SCENES)) {
    const r = await call('doubao-seed-2.0-pro', SYSTEM, SCENES[k], 400, 0.95);
    if (r.ok) {
      const t = strip(r.text);
      const over = t.length > 120;
      console.log('[' + k + ']  ' + t.length + '字' + (over ? ' (超120将被截断)' : ''));
      console.log('  ' + t);
      results.push(t);
    } else {
      console.log('[' + k + ']  FAIL http=' + r.http + ' ' + r.raw);
    }
    console.log('');
  }

  // 同场景连续两次，验证是否有变化（模板会完全一样）
  console.log('======== 同场景重复调用（验证非模板） ========');
  console.log('');
  const a = await call('doubao-seed-2.0-pro', SYSTEM, SCENES.monday, 400, 0.95);
  const b = await call('doubao-seed-2.0-pro', SYSTEM, SCENES.monday, 400, 0.95);
  if (a.ok && b.ok) {
    const ta = strip(a.text), tb = strip(b.text);
    console.log('第1次: ' + ta);
    console.log('第2次: ' + tb);
    console.log('');
    console.log('两次内容是否不同: ' + (ta !== tb ? '是 -> 确认为实时生成' : '否 -> 可疑'));
  }

  console.log('');
  console.log('======== 判定 ========');
  console.log('成功生成: ' + results.length + '/4 场景');
  const allShort = results.every(function (t) { return t.length <= 120; });
  console.log('全部在 120 字截断线内: ' + (allShort ? '是' : '否（会被截断，需调 prompt）'));
  const noMd = results.every(function (t) { return t.indexOf('```') < 0 && t.indexOf('**') < 0; });
  console.log('无 markdown 残留: ' + (noMd ? '是' : '否'));
  process.exit(results.length === 4 ? 0 : 1);
})();
