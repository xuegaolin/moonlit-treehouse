# 今夜树屋 · API 接口规范 (MVP)

**版本**：v1.0  
**更新时间**：2026-07-25  
**Base URL**：`https://api.treehouse.example.com/api/v1`

---

## 通用约定

### 请求头
```
Content-Type: application/json; charset=utf-8
Authorization: Bearer {JWT}   （登录接口除外）
X-Trace-Id: {前端 UUID}       （可选）
```

### 响应结构
```json
{ "code": 200, "message": "ok", "data": {...}, "traceId": "abc", "timestamp": 1732512000000 }
```

### 错误码（详见 04-interaction-copy.md）
```
200 成功  40101 未登录  40201 违规  40301 无权限  40401 不存在
42901 频繁  50001 内部错  50002 AI失败
```

---

## 一、登录 & 用户

### `POST /wechat/login`
```json
Req  { "code": "wx.login返回的code" }
Res  { "token": "jwt...", "openid": "ox_xxx", "isNewUser": true, "member": null }
```

### `GET /user/profile`
```json
Res  { "openid": "...", "nickname": "小月", "avatar": "https://...", "coinBalance": 128, "memberExpireAt": null }
```

### `POST /user/update-profile`
```json
Req  { "nickname": "小月", "avatar": "wx-avatar-url" }
Res  { "ok": true }
```

---

## 二、深夜信箱

### `POST /letter/create`
```json
Req  {
  "receiverType": "self_future|self_now|missed_one|stranger",
  "deliverAt": 1735689600000,
  "content": "用户正文...",
  "envelopeCode": "default|kraft|sakura|...",
  "aiEnabled": true,
  "aiPersona": "SISTER|BESTIE|PROF|BUDDHA|STAR",
  "publicToWall": false
}
Res  { "letterId": "L20260725001", "status": "PENDING", "cost": 0 }
```

### `GET /letter/mine?status=&page=&size=`
```json
Res  {
  "list": [
    { "letterId": "L001", "status": "DELIVERED", "receiverType": "self_future",
      "deliverAt": 1735689600000, "hasReply": true, "envelopeCode": "sakura", "createdAt": ... }
  ],
  "total": 12
}
```

### `GET /letter/detail?letterId=L001`
```json
Res  {
  "letterId": "L001", "content": "…(已解密)…", "aiPersona": "SISTER",
  "aiReply": "亲爱的，…", "deliveredAt": ..., "canShare": true
}
```

---

## 三、摆烂许可证

### `POST /bailan/generate`
```json
Req  { "type": "monday|period|breakup|no_reason|ai_custom",
       "template": "gov|handwrite|palace|cyber|dunhuang|film",
       "nickname": "小月", "avatar": "wx-avatar", "customReason": null }
Res  {
  "licenseId": "B20260725001",
  "licenseNo": "ML-20260725-0001",
  "imageUrl": "https://cdn/licenses/xxx.png",
  "reasonText": "根据《人间打工人保护法》第 3 章第 8 条…",
  "coinReward": 5
}
```

### `GET /bailan/mine?page=&size=`
```json
Res  { "list": [ {...} ], "total": 42, "streakDays": 7, "badges": ["moxie-newbie"] }
```

### `GET /bailan/calendar?month=202607`
```json
Res  { "days": [ { "date": "2026-07-01", "licenseId": "B001" }, … ] }
```

---

## 四、塔罗盲盒

### `POST /tarot/daily`
```json
Req  { }
Res  {
  "readingId": "T20260725001",
  "cards": [ { "cardId": 19, "cardName": "太阳", "position": "upright",
               "keywords": ["希望", "热情", "成功"] } ],
  "shortInterpretation": "今天的太阳照进你心里…(30字)",
  "unlockPrice": 9.9,
  "unlocked": false
}
```

### `POST /tarot/unlock`
```json
Req  { "readingId": "T001", "orderId": "O001" }
Res  { "fullInterpretation": "…(200字)", "advice": [...], "luckyColor": "#F5D76E",
       "luckyNumber": 7, "songUrl": "https://..." }
```

### `POST /tarot/three-cards`
```json
Req  { "question": "我的复合有可能吗?" }
Res  { "readingId": "T002", "cards": [past, present, future], "price": 9.9 }
```

---

## 五、许愿池

### `POST /wish/mokugyo/tap`（木鱼敲击 · 批量上报）
```json
Req  { "count": 10 }
Res  { "totalMerit": 1024, "todayLeft": 40, "coinReward": 0 }
```

### `POST /wish/create`
```json
Req  { "category": "study|career|love|health|other", "content": "…",
       "expectAt": 1740000000000, "publicToWall": false }
Res  { "wishId": "W001" }
```

### `POST /wish/close`（结愿）
```json
Req  { "wishId": "W001", "achieved": true, "aiBlessing": true }
Res  { "blessing": "月光女神为你写下…", "cost": 4.9 }
```

---

## 六、漂流墙

### `POST /bottle/publish`
```json
Req  { "content": "…", "tags": ["emo", "失恋"], "anonymousId": null }
Res  { "bottleId": "M001", "status": "PENDING_AUDIT" }
```

### `GET /bottle/feed?tag=&sort=latest|hot&page=`
```json
Res  { "list": [ { "bottleId": "M001", "content": "…", "tags": [...], "warmCount": 12, "createdAt": ..., "anonymousId": "路人-A7B3" } ] }
```

### `POST /bottle/warm`
```json
Req  { "bottleId": "M001", "giftType": "hug|candy|candle", "coinCost": 6 }
Res  { "warmedTotal": 13 }
```

---

## 七、订单 & 支付

### `POST /order/create`
```json
Req  { "bizType": "letter_ai|tarot_unlock|bailan_template|membership_month|…",
       "bizId": "…", "amount": 9.9 }
Res  { "orderId": "O001", "wxPayParams": { "timeStamp":"...", "nonceStr":"...",
       "package":"prepay_id=xxx", "signType":"RSA", "paySign":"..." } }
```

### `POST /order/notify`（微信支付回调，不需要 JWT）
```
微信规范 XML/JSON，Spring Boot 内解析
```

### `GET /order/mine?page=&size=`
```json
Res  { "list": [ { "orderId": "O001", "bizType": "…", "amount": 9.9, "status": "PAID", ... } ] }
```

---

## 八、会员

### `GET /membership/plans`
```json
Res  { "plans": [
  { "code": "MONTH", "price": 19, "days": 30, "benefits": [...] },
  { "code": "YEAR",  "price": 128, "days": 365, "recommend": true },
  { "code": "LIFE",  "price": 388, "days": 999999 }
] }
```

### `POST /membership/subscribe`
```json
Req  { "planCode": "YEAR" }
Res  { "orderId": "O_MEM_001", "wxPayParams": {...} }
```

---

## 九、月光币

### `GET /coin/wallet`
```json
Res  { "balance": 128, "todayEarned": 30, "todayLimit": 100 }
```

### `GET /coin/logs?page=&size=`
```json
Res  { "list": [ { "delta": +10, "reason": "SIGN_IN", "createdAt": ... } ] }
```

---

_数据表 DDL 见 [03-database.md](03-database.md)_
