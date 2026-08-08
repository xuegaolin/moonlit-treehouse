// tools/check-subscribe-consistency.js
// Three-party binding check for 8/6 subscribe message module
var fs = require('fs')
var ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse'
var DDL = ROOT + '/backend/src/main/resources/db/V5__letter_subscribe_log.sql'
var YML = ROOT + '/backend/src/main/resources/application.yml'
var LETTER_CTRL = ROOT + '/backend/src/main/java/com/treehouse/module/letter/LetterController.java'
var LETTER_SVC = ROOT + '/backend/src/main/java/com/treehouse/module/letter/LetterService.java'
var WECHAT_SVC = ROOT + '/backend/src/main/java/com/treehouse/service/WechatMaService.java'
var SUBSCRIBE_JS = ROOT + '/miniprogram/utils/subscribe.js'
var CONFIG_JS = ROOT + '/miniprogram/utils/config.js'
var LETTER_JS = ROOT + '/miniprogram/pages/letter/letter.js'
var LETTER_WXML = ROOT + '/miniprogram/pages/letter/letter.wxml'
var LETTER_SUB_ENTITY = ROOT + '/backend/src/main/java/com/treehouse/module/letter/LetterSubscribeLog.java'
var LETTER_SUB_REPO = ROOT + '/backend/src/main/java/com/treehouse/module/letter/LetterSubscribeLogRepository.java'
var DOC = ROOT + '/docs/subscribe-msg-integration.md'
function read(p) { try { return fs.readFileSync(p,'utf8') } catch (e) { return null } }
var total = 0, pass = 0
function check(label, cond, evidence) {
  total++
  if (cond) pass++
  var prefix = cond ? 'PASS' : 'FAIL'
  if (evidence) console.log('  [' + prefix + '] ' + label + ' :: ' + evidence)
  else console.log('  [' + prefix + '] ' + label)
}
console.log('=== 1. DDL fields vs Java entity ===')
var ddl = read(DDL)
var entity = read(LETTER_SUB_ENTITY)
if (!ddl || !entity) { console.log('  [FAIL] read failed'); process.exit(1) }
var fields = ['letter_id','openid','template_id','push_token','status','expire_at','pushed_at','error_code','error_msg','create_time','update_time']
fields.forEach(function (f) {
  var hasDDL = ddl.indexOf(f) >= 0
  var hasEntity = entity.indexOf(f) >= 0
  check('field ' + f, hasDDL && hasEntity)
})
console.log('')
console.log('=== 2. DDL indexes vs Repository ===')
var repo = read(LETTER_SUB_REPO)
var idx = ['uk_letter','idx_status_expire','idx_openid']
idx.forEach(function (i) { check('index ' + i, ddl.indexOf(i) >= 0) })
check('Repository findByLetterId', repo && repo.indexOf('findByLetterId') >= 0)
check('Repository existsByLetterId', repo && repo.indexOf('existsByLetterId') >= 0)
check('Repository @Modifying 原子 SQL', repo && repo.indexOf('@Modifying') >= 0)
console.log('')
console.log('=== 3. Controller endpoints ===')
var ctrl = read(LETTER_CTRL)
var endpoints = ['/subscribe-grant','/subscribe-status','/admin/set-template-id']
endpoints.forEach(function (e) { check('Ctrl ' + e, ctrl && ctrl.indexOf(e) >= 0) })
console.log('')
console.log('=== 4. Service 4 new methods ===')
var svc = read(LETTER_SVC)
var methods = ['grantSubscribe','subscribeStatus','pushSubscribeAfterDeliver','setTemplateId']
methods.forEach(function (m) { check('Svc ' + m, svc && svc.indexOf(m) >= 0) })
console.log('')
console.log('=== 5. WechatMaService + access_token ===')
var ws = read(WECHAT_SVC)
check('sendSubscribeMessage', ws && ws.indexOf('sendSubscribeMessage') >= 0)
check('ConcurrentHashMap cache', ws && ws.indexOf('ConcurrentHashMap') >= 0)
check('template-id-letter', ws && ws.indexOf('template-id-letter') >= 0)
console.log('')
console.log('=== 6. application.yml ===')
var yml = read(YML)
check('yml template-id-letter', yml && yml.indexOf('template-id-letter') >= 0)
check('yml WECHAT_TEMPLATE_ID_LETTER', yml && yml.indexOf('WECHAT_TEMPLATE_ID_LETTER') >= 0)
console.log('')
console.log('=== 7. subscribe.js + config.js ===')
var sub = read(SUBSCRIBE_JS)
var cfg = read(CONFIG_JS)
check('subscribe.js exists', !!sub)
check('wx.requestSubscribeMessage', sub && sub.indexOf('requestSubscribeMessage') >= 0)
check('config letterSubscribeGrant', cfg && cfg.indexOf('letterSubscribeGrant') >= 0)
check('config letterSubscribeStatus', cfg && cfg.indexOf('letterSubscribeStatus') >= 0)
console.log('')
console.log('=== 8. letter.js onSubmitted + refreshSubscribeBanner ===')
var lj = read(LETTER_JS)
check('import subscribe.js', lj && lj.indexOf('utils/subscribe.js') >= 0)
check('tryAskSubscribe', lj && lj.indexOf('tryAskSubscribe') >= 0)
check('refreshSubscribeBanner', lj && lj.indexOf('refreshSubscribeBanner') >= 0)
console.log('')
console.log('=== 9. letter.wxml banner ===')
var wxml = read(LETTER_WXML)
check('showSubscribeBanner', wxml && wxml.indexOf('showSubscribeBanner') >= 0)
check('subscribedCount', wxml && wxml.indexOf('subscribedCount') >= 0)
console.log('')
console.log('=== 10. docs/subscribe-msg-integration.md ===')
var doc = read(DOC)
check('doc exists', !!doc)
check('doc has template_id', doc && doc.indexOf('template_id') >= 0)
check('doc has checklist', doc && doc.indexOf('checklist') >= 0)
console.log('')
console.log('=== verdict ===')
console.log('PASS: ' + pass + ' / TOTAL: ' + total)
console.log(pass === total ? 'ALL PASS' : (pass + '/' + total + ' FAIL)'))
process.exit(pass === total ? 0 : 1)