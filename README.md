# 🌙 今夜树屋 · Moonlit Treehouse

> 一个专治深夜情绪的多模块微信小程序。
>
> **一句话定位：** 白天你在人间打拼，晚上来树屋躲一躲。

---

## 项目结构

```
moonlit-treehouse/
├─ docs/
│  ├─ 01-product/       产品文档（PRD、信息架构、功能清单、页面流）
│  ├─ 02-architecture/  技术架构（模块划分、接口协议、数据表设计）
│  ├─ 03-diagrams/      图（信息架构、页面流、时序图，Excalidraw + SVG）
│  ├─ 04-business/      商业化（收入模型、拉新、会员体系）
│  ├─ 05-brand/         品牌（命名、Slogan、Logo、视觉规范）
│  └─ 06-content/       内容（AI Prompt、模板文案、投放素材）
├─ miniprogram/         小程序骨架（原生微信小程序，参考 ai-watermark-miniprogram）
└─ backend/             Spring Boot 后端骨架（JDK 1.8，参考 ai-watermark-remover-quick）
```

## 交付清单

| # | 交付物 | 位置 | 状态 |
|---|--------|------|------|
| 1 | 完整产品文档 | `docs/01-product/` `docs/02-architecture/` | ✅ |
| 2 | 信息架构图 + 页面流程图 | `docs/03-diagrams/` | ✅ |
| 3 | MVP 代码骨架 | `miniprogram/` + `backend/` | ✅ |
| 4 | 收入模型 Excel | `docs/04-business/revenue-model.xlsx` | ✅ |
| 5 | 产品名 / Slogan / Logo 概念 | `docs/05-brand/` | ✅ |

## 快速开始

1. 阅读 [`docs/01-product/01-PRD.md`](docs/01-product/01-PRD.md) 了解产品全貌
2. 查看 [`docs/03-diagrams/`](docs/03-diagrams/) 中的信息架构与流程图
3. 参考 [`docs/02-architecture/01-tech-arch.md`](docs/02-architecture/01-tech-arch.md) 开始搭建

---

## MVP 骨架说明（2026-07-26 追加）

代码骨架已按 `docs/02-architecture/` 的技术架构与 API 规范落地，两端均已通过编译/语法验证。

### miniprogram/（原生微信小程序）

- **全局**：`app.js`（baseUrl + apiPaths 全局配置、wx.login 静默登录）、`app.json`（tabBar：树屋/我的 两个 tab，5 模块均从首页进入）、主题色月光紫 `#6B5CE7`
- **utils**：`request.js`（Promise 封装、自动带 `Authorization: Bearer`、401/40101 静默重登重试一次）、`auth.js`（code 换 token、缓存恢复、forceLogin）、`coin.js`（月光币本地缓存 + 服务端同步 + 乐观更新）
- **页面**：`home`（5 模块入口卡片 + 时段问候）、`bailan`（**MVP 核心，完整可跑**：领取许可证 → Canvas 2D 绘制证书 → 保存相册 / 分享，接口失败自动降级本地 mock）、`letter`/`tarot`/`wish`/`bottle`（统一 coming-soon 占位页）、`user`（月光币钱包、会员套餐入口、头像昵称编辑、我的证书入口）
- **components**：`module-card`、`coming-soon`、`coin-badge`

### backend/（Spring Boot 2.7.18 + JDK 1.8）

- **完整链路（可编译，已通过 `mvn compile`）**：微信登录（`POST /api/v1/wechat/login`，jscode2session → JWT 7 天）+ 摆烂许可证（领取/我的列表/日历，每日限一张 + 首次 +5 月光币）+ 月光币（钱包/流水/每日上限）+ 会员套餐（19 元月卡 / 128 元年卡，支付为占位 TODO）
- **包结构** `com.treehouse`：`common`（R 统一返回体 / ResultCode / BizException / GlobalExceptionHandler / JwtUtil / BaseController）、`config`（CorsFilter / AuthInterceptor / WebConfig）、`controller`（wechat、user、coin、membership）、`service`（UserService / CoinService / WechatMaService / MembershipService）、`entity` + `repository`（User、CoinAccount、CoinTransaction、MemberOrder + `module/bailan` 下 BailanLicense）
- **module/**：`bailan` 完整实现；`letter` / `tarot` / `wish` / `bottle` 各一个占位 Controller（类注释写明版本规划与依赖）

### 如何跑起来

**后端**：`cd backend && mvn spring-boot:run`（需先建 MySQL 库 `treehouse` 并改 `application.yml` 数据源；无微信 appid 时可用 `POST /api/v1/wechat/test-login` 签发测试 token 联调）

**小程序**：微信开发者工具导入 `miniprogram/`（appid 已用测试号 `touristappid`），`app.js` 的 `baseUrl` 改为本机局域网 IP；后端未启动时摆烂页自动走本地 mock 数据，Canvas 证书照常可玩。

---

_更新时间：2026-07-27 · 全部 5 项交付完成_
