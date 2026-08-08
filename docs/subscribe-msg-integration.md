# 深夜信箱 · 一次性订阅消息接入指南

**模块**：A · 深夜信箱
**新增**：2026-08-06
**适用**：运营 / 开发上线时操作

---

## 一、为什么做这个

模块 A 的「深夜信箱」是核心付费模块（4.9 元 / 9.9 元 / 会员）。但当前投递后**用户不会收到任何系统通知**——只有等他们主动打开小程序「我的信箱」才看到。

接入一次性订阅消息后，**信到达那一刻**推一条服务通知到用户微信（标题 `树屋来信`），点进去直达「我的信箱」tab。

---

## 二、一次性订阅 vs 长期订阅

| 类型 | 是否需要审核 | 适用 | 当前选择 |
|------|------|------|---------|
| **一次性订阅** | 公共模板免审，自有模板需 1~3 天 | 任何类目可用 | ✅ 当前方案 |
| 长期订阅 | 需类目匹配 + 严格审核 | 工具类目通过率 < 10% | ❌ 不做 |
| 设备订阅 | 自营硬件 | ToC 小程序基本不可用 | ❌ 不做 |

**硬约束**：微信一次性订阅的 `push_token` **有效期 30 天**。超过 30 天的信（用户选了「一年后送达」）授权后，**投递时 push_token 已失效**，log 标 `EXPIRED`，不报错、不推送，前端信到时仅在站内展示。

---

## 三、申请 template_id 步骤

### 3.1 进入订阅消息公共模板库

1. 浏览器打开 https://mp.weixin.qq.com
2. 登录小程序后台（账号与密码找运营要）
3. 左侧菜单 → **订阅消息** → **公共模板库**
4. 搜索关键词 `提醒` 或 `签到`

### 3.2 推荐模板：待办提醒 / 任务提醒

搜出来最接近的（举两个）：

| 模板 | 字段 1 | 字段 2 | 字段 3 |
|------|------|------|------|
| 待办事项提醒 | 待办主题（字符） | 提醒时间（时间） | 温馨提示（字符） |
| 任务进度提醒 | 任务名称（字符） | 进度（字符） | 备注（字符） |

**推荐选「待办事项提醒」**——字段最匹配。

### 3.3 字段映射（项目内约定）

| 模板关键词 | 后端填充值 | 来源 |
|----------|----------|------|
| 待办主题 | `树屋来信` | 硬编码（LetterService.pushSubscribeAfterDeliver） |
| 提醒时间 | `2026年8月6日 21:00` | letter.deliveredAt 格式 yyyy年M月d日 H:mm |
| 温馨提示 | 你寄出的信到了，AI 已回信 / 你寄出的信到了，进来看看吧 | aiEnabled 决定文案 |

**改这 3 个值**：编辑 `LetterService.java` 的 `pushSubscribeAfterDeliver` 方法里的 `data` Map（用 `thing1 / time2 / thing3` 三个 key，对应微信模板里的关键词位置）。

### 3.4 申请通过后拿到 template_id

形如：`aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890abc`（约 43 字符）

### 3.5 填入项目

**生产环境（推荐）**：
```
WECHAT_TEMPLATE_ID_LETTER=aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890abc
```
通过环境变量注入，启动时 application.yml 读 `${WECHAT_TEMPLATE_ID_LETTER:}`。

**dev 临时调试**（不推荐生产用）：
```
POST /letter/admin/set-template-id
Body: { "templateId": "aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890abc" }
```
仅 dev profile 可达。重启后失效。

---

## 四、接入 checklist

每项都是阻塞点，没勾完前不要上线。

### 4.1 必做（阻塞上线）

- [ ] 申请到真实 template_id（按 §3 流程）
- [ ] 用 **真小程序**（体验版 / 正式版）写一封 1 天后送达的信
- [ ] 写完后弹授权弹窗 → 用户接受 → 看到 push_token 入库
- [ ] 1 天后信到时真收到服务通知
- [ ] 检查 4 个边界：
  - [ ] **重复授权**：同封信用户点 2 次授权 → log 仍是 1 条（UK 防重）
  - [ ] **拒授权**：用户关弹窗 → 信照常寄出，仅无通知
  - [ ] **过期**：用户授权时选了 1 年后送达 → 30 天后 push_token 过期 → log 标 EXPIRED
  - [ ] **越权**：用户 A 拿自己 token 查 B 的信 → 返回 subscribed:false

### 4.2 配置正确

- [ ] application.yml `template-id-letter` 不为空
- [ ] 后端日志可见 `[AiService] 已加载专用 truststore`（JDK 8 cacerts 修复仍生效）
- [ ] 微信公众平台 → 设置 → 第三方设置 → 开通订阅消息能力
- [ ] 小程序后台 → 类目 → 确认有「工具 / 生活服务」（已选，8/3 确认）

### 4.3 监控

- [ ] 日志：grep `[subscribe]` 应能看到 PUSHED / EXPIRED / FAILED 计数
- [ ] DB：定期跑 `SELECT status, COUNT(*) FROM t_letter_subscribe_log GROUP BY status`
- [ ] 微信公众平台 → 统计 → 订阅消息推送量

---

## 五、当前 dev 行为

**没填 template_id 也不影响开发**：
- 用户写完信 → 后端无 template_id → 弹授权静默走 NO_TEMPLATE 路径
- log 入库 status=PENDING（永远不推）
- 信到时 deliverDueLetters 跑通，但 pushSubscribeAfterDeliver 内部走 `template_id 为空 → log 保持 PENDING`
- 行为完全可预测、零错误、零外部调用

**所以**：
- dev 不接 template_id 不影响其他功能
- prod 接入时只需填 `WECHAT_TEMPLATE_ID_LETTER` 一个环境变量
- 接入后无需改代码

---

## 六、文件清单

| 文件 | 作用 |
|------|------|
| `db/V5__letter_subscribe_log.sql` | 推送日志表 DDL（已 apply） |
| `entity/LetterSubscribeLog.java` | JPA 实体 |
| `repository/LetterSubscribeLogRepository.java` | 含 markPushResult 原子 SQL |
| `service/WechatMaService.java` | access_token 缓存 + sendSubscribeMessage |
| `module/letter/LetterService.java` | grantSubscribe / subscribeStatus / pushSubscribeAfterDeliver / setTemplateId |
| `module/letter/LetterController.java` | 3 个新接口 |
| `module/letter/dto/SubscribeGrantRequest.java` | grant 入参 |
| `application.yml` | template-id-letter 配置项 |
| `miniprogram/utils/subscribe.js` | 前端授权 + 状态查询封装 |
| `miniprogram/utils/config.js` | 2 个新 apiPath |
| `miniprogram/pages/letter/letter.{js,wxml,wxss}` | 写完信后弹授权 + 信箱 banner |

---

## 七、回归验证（8/6 实跑过）

- ✅ DDL 实际建表成功（MySQL 5.7 / 12 字段 / 4 索引）
- ✅ 后端编译通过（mvn -o compile）
- ✅ 小程序静态检查 4/4 PASS（check-all.js）
- ⏳ 临时实例端到端 verify 受限于本会话工具与 PowerShell 字面反斜杠 n 污染暂未跑通；建议下次会话优先重写 verify-letter-subscribe.js 后跑一次
- ⏳ 真实 template_id 接入需在 mp.weixin.qq.com 申请后做

