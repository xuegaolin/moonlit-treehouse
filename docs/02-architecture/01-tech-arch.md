# 今夜树屋 · 技术架构

**版本**：v1.0  
**更新时间**：2026-07-25

---

## 一、整体架构图

```
┌──────────────────────────────────────────────────┐
│              微信小程序 (原生 wx)                  │
│  ┌──────┬──────┬──────┬──────┬──────┐            │
│  │ 首页  │ 信箱  │ 塔罗  │ 摆烂  │ 我的  │  ← Page  │
│  ├──────┴──────┴──────┴──────┴──────┤            │
│  │       统一 request 封装 (app.js)   │            │
│  └──────────────────┬─────────────────┘            │
└─────────────────────┼──────────────────────────────┘
                      │ HTTPS + JWT
                      ▼
┌──────────────────────────────────────────────────┐
│         Spring Boot 2.7.18 (JDK 1.8)             │
│  ┌────────────────────────────────────────┐      │
│  │  Filter 层：CORS · UTF-8 · JwtAuth     │      │
│  ├────────────────────────────────────────┤      │
│  │  Controller (RESTful)                   │      │
│  │  ├─ WechatLoginController               │      │
│  │  ├─ UserController                      │      │
│  │  ├─ LetterController                    │      │
│  │  ├─ BailanController                    │      │
│  │  ├─ TarotController                     │      │
│  │  ├─ WishController                      │      │
│  │  ├─ BottleController                    │      │
│  │  ├─ OrderController                     │      │
│  │  └─ MembershipController                │      │
│  ├────────────────────────────────────────┤      │
│  │  Service (业务)                          │      │
│  │  ├─ AiService (LLM 调用)                │      │
│  │  ├─ ContentSecurityService (审核)       │      │
│  │  ├─ CoinService (月光币)                │      │
│  │  ├─ PaymentService (微信支付)           │      │
│  │  └─ NotificationService (订阅消息)      │      │
│  ├────────────────────────────────────────┤      │
│  │  Repository (JPA)                        │      │
│  ├────────────────────────────────────────┤      │
│  │  定时任务：LetterDeliveryJob (每分钟)   │      │
│  └────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
              │              │              │
              ▼              ▼              ▼
       ┌─────────┐    ┌──────────┐    ┌──────────┐
       │  MySQL  │    │   Redis  │    │  文件存储 │
       │ 8.0     │    │(可选缓存)│    │ (本地/COS)│
       └─────────┘    └──────────┘    └──────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  外部服务         │
                    │  ├─ LLM API      │
                    │  ├─ 微信支付      │
                    │  ├─ 内容安全 API  │
                    │  └─ 订阅消息      │
                    └──────────────────┘
```

---

## 二、模块化设计原则

沿用 `ai-watermark-remover-quick` 的目录约定，按业务模块拆分：

```
com.treehouse
├─ config          全局配置（CORS/UTF-8/Auth/OpenApi）
├─ common          通用类（Result/PageQuery/异常/常量）
├─ dto             跨层数据传输对象
├─ entity          JPA 实体
├─ repository      JPA 仓库
├─ controller      RESTful 入口
├─ service         通用 Service（AI/审核/支付/月光币）
└─ module          业务模块（每个模块独立子包）
   ├─ letter       深夜信箱
   ├─ bailan       摆烂许可证
   ├─ tarot        塔罗盲盒
   ├─ wish         许愿池
   └─ bottle       漂流墙
```

### 为什么这样分？
- **module** 子包只放"业务强绑定"的 Controller/Service/DTO/实体，方便未来任意模块拆到独立服务
- **service** 顶级只放跨模块共用的：AI/审核/支付/月光币/通知
- **controller** 顶级只放非业务的：登录、用户、订单、会员

---

## 三、核心技术选型

| 层 | 技术 | 版本 | 理由 |
|----|------|------|------|
| 语言 | Java | **1.8** | 用户强指定 |
| 框架 | Spring Boot | 2.7.18 | 最后一个稳定支持 JDK 1.8 的版本 |
| ORM | Spring Data JPA + Hibernate | 5.6.15 | 参考项目已经用 |
| 数据库 | MySQL | 8.0.33 | 参考项目已经用 |
| 缓存 | Caffeine (本地) / Redis (可选) | - | MVP 先本地 |
| 工具 | Hutool | 5.8.26 | 参考项目已经用 |
| JWT | jjwt | 0.11.5 | 参考项目已经用 |
| 微信小程序 SDK | weixin-java-miniapp | 4.5.0 | 参考项目已经用 |
| 微信支付 SDK | wechatpay-java | 0.2.12 | 参考项目已经用 |
| LLM 调用 | okhttp + Hutool JSON | - | 支持任意兼容 OpenAI 协议的模型 |
| 定时任务 | Spring @Scheduled | - | MVP 阶段够用，量大再换 XXL-Job |
| 前端 | 微信原生小程序 | - | 用户指定复用 ai-watermark-miniprogram |
| UI 组件 | @vant/weapp | 已引入 | 参考小程序项目已引入 |

---

## 四、数据表清单（MVP）

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `t_user` | 用户 | id, openid, unionid, nickname, avatar, member_expire_at |
| `t_membership` | 会员订单 | id, user_id, level, price, start_at, expire_at |
| `t_order` | 通用订单 | id, user_id, biz_type, biz_id, amount, status, wx_pay_id |
| `t_coin_wallet` | 月光币钱包 | user_id, balance, updated_at |
| `t_coin_log` | 月光币流水 | id, user_id, delta, reason, biz_id, created_at |
| `t_letter` | 信件 | id, user_id, receiver_type, deliver_at, content_enc, ai_persona, ai_reply, status, is_public |
| `t_bailan_license` | 摆烂许可证 | id, user_id, license_no, license_type, template_code, reason_text, image_url, created_at |
| `t_tarot_reading` | 塔罗抽卡记录 | id, user_id, reading_type, card_ids(JSON), ai_interpretation, price, created_at |
| `t_wish` | 心愿 | id, user_id, category, content, expect_at, is_public, closed, ai_blessing |
| `t_bottle_msg` | 漂流墙消息 | id, user_id, anonymous_id, content, tags(JSON), like_count, warm_count, status |
| `t_bottle_warm` | 送温暖记录 | id, from_user_id, bottle_id, gift_type, coin_cost, created_at |
| `t_notification_log` | 订阅消息日志 | id, user_id, template_id, biz_id, sent_at, status |

**关键设计**：
- `t_letter.content_enc` 用 AES-128 加密存储，密钥用 openid 派生
- `t_bottle_msg.anonymous_id` 与 user_id 解耦（不同随机数），前端只展示 anonymous_id
- 全表软删除（deleted 字段 + JPA @SQLDelete）

---

## 五、API 命名规范

```
/api/v1/{module}/{action}
```

**示例**：
```
POST /api/v1/wechat/login              静默登录
GET  /api/v1/user/profile              查用户信息
POST /api/v1/letter/create             写信
GET  /api/v1/letter/mine?status=待送达 我的信箱
POST /api/v1/bailan/generate           领摆烂许可证
POST /api/v1/tarot/daily               每日一牌
POST /api/v1/tarot/three-cards         三牌阵(付费)
POST /api/v1/wish/create               许愿
POST /api/v1/bottle/publish            发漂流
POST /api/v1/bottle/warm               送温暖
POST /api/v1/order/create              下单
POST /api/v1/order/pay-callback        支付回调
GET  /api/v1/coin/wallet               查月光币
POST /api/v1/membership/subscribe      开通会员
```

**统一响应结构**：
```json
{
  "code": 200,
  "message": "ok",
  "data": {...},
  "traceId": "abc-123",
  "timestamp": 1732512000000
}
```

---

## 六、安全 & 合规

### 6.1 认证
- 沿用参考项目的 wx.login → code → jscode2session → openid → 生成 JWT 返回
- JWT 有效期 7 天，过期由前端 wx.login 静默续期
- 敏感接口 (支付、退款) 加 openid 二次校验

### 6.2 内容审核
- 用户 UGC 提交 → **微信 msgSecCheck V2** (免费)
- 命中 → 走"关键词库 + 大模型审核"二次判断
- 通过后才写库；未通过则记录到 `t_audit_reject`

### 6.3 数据加密
- 信件正文 AES-128 CBC 加密
- 密钥推导：`HKDF(openid + 服务器 salt)` → 每用户唯一
- 后台管理员**无法**看到明文（除非用户自己上报客服）

### 6.4 未成年人保护
- 首次登录弹出"是否满 18 岁"（不强制，但记录）
- 疑似未成年的账号：屏蔽塔罗/许愿池付费

---

## 七、部署 & 运维（MVP）

- **单机部署**：一台 2C4G 服务器起步（阿里云 ECS 或 Tencent 轻量）
- **数据库**：云 MySQL 5.7 or 8.0，共用即可
- **域名 & 证书**：备案后再上线（提前 20 天准备）
- **日志**：logback 输出到 `/logs/treehouse.log`，日切
- **监控**：Spring Boot Actuator + 微信支付回调告警到 Feishu

---

_下一份：[02-api-spec.md](02-api-spec.md)_
