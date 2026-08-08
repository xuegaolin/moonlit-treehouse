# 小程序自检工具

后端没起来也能提前发现问题的三个静态/运行时检查。改完代码在 DevTools 编译前先跑一遍。

## 用法

```bash
cd D:\clawd_workspace\projects\moonlit-treehouse\n\n# 1. WXML/WXSS 深度检查（能抓到 DevTools 编译错误）\nnode tools/lint-wxml.js miniprogram\n\n# 2. 结构检查（页面注册、组件路径、tabBar 图标、跳转目标）
cd miniprogram && node ../tools/check-miniprogram.js

# 3. 运行时模拟（App/Page 生命周期真实跑一遍，抓 TypeError）
cd .. && node tools/simulate-launch.js miniprogram
```

## lint-wxml.js 能抓什么

| 检查项 | 后果 |
|--------|------|
| 标签未配平 / 多余闭合 | ❌ WXML 编译错误 |
| `wx:else-if` 等非法指令 | ❌ 编译错误：微信只认 `wx:elif` |
| `wx:elif/wx:else` 前无同级 `wx:if` | ❌ 编译错误 `wx:if not found` |
| 插值里调方法 `{{fn(x)}}` `{{x.toLowerCase()}}` | ⚠️ 静默渲染为空（最坑） |
| 插值内含双引号 | ⚠️ 属性值被截断 |
| 字面 `\n` | ⚠️ 原样显示成两个字符 |
| `wx:for` 缺 `wx:key` | ⚠️ DevTools 告警 |
| 事件绑定函数在 js 里不存在 | ⚠️ 点击无反应 |
| WXSS 括号不配平 / `@import` 找不到 | ❌ 样式失效 |

CSS 函数（`linear-gradient`/`rgba`/`calc` 等）已在白名单，不会误报。

## simulate-launch.js 能抓什么

用 Node 搭最小 `wx`/`App`/`Page`/`Component`/`getApp` 沙箱，真实 `require` 业务代码并跑
`App() → onLaunch → onShow → 各页面 onLoad/onShow/onReady → 组件加载`。

模拟「后端未启动」（wx.request 走 fail），验证所有兜底路径不会崩。

典型能抓到的：
- `onLaunch` 里用 `getApp()`（此时返回 `undefined` → TypeError → 白屏）
- 兜底分支里的空指针
- 重复请求（看第 5 段异步日志的 wx.request 次数）

## 已知历史坑（都已修）

1. **启动白屏**：`app.js` onLaunch 调 `auth.ensureLogin()`，而 auth 内部读
   `getApp().globalData.baseUrl` → App 构造期 `getApp()` 是 undefined。
   → 配置收进 `utils/config.js`，登录挪到 `onShow`。
2. **WXML 编译失败**：`letter-detail.wxml` 用了 `wx:else-if`。
3. **14 处静默空白**：WXML 里调 `formatDate()` / `.toLowerCase()` / `.indexOf()` / `Date.now()`。
   → 全部改为 JS 预算字段（`statusText`/`statusClass`/`deliverAtText`/`tagOptions` 等）。
4. **页面未注册**：`letter-detail` 不在 `app.json` pages 里 → navigateTo 失败。
5. **事件名不匹配**：`letter.wxml` 绑 `onNewContentInput`，JS 里叫 `onContentInput`。
