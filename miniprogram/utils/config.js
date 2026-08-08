// utils/config.js — 环境与接口配置（单一数据源）
//
// 为什么独立成文件：
//   app.js 的 onLaunch 阶段 getApp() 还返回 undefined，任何在 onLaunch 里
//   读 getApp().globalData 的代码都会 TypeError 导致启动白屏。
//   所以 baseUrl / apiPaths 放这里，utils/* 一律 require 本文件，不依赖 getApp()。
//
// 参考 zj-miniprogram/utils/request.js 的 envVersion 分环境写法。

// ---- 环境判定 ----
// develop = 开发者工具/真机调试, trial = 体验版, release = 正式版
var ENV = 'develop';
try {
  var info = wx.getAccountInfoSync();
  ENV = (info && info.miniProgram && info.miniProgram.envVersion) || 'develop';
} catch (e) {
  ENV = 'develop';
}

// ---- Base URL ----
// 开发：本机局域网 IP + 后端端口（application.yml: server.port=8081, context-path=/api/v1）
// 上线：换成 https 备案域名，并在 mp.weixin.qq.com 配置 request 合法域名
// 重要：IP 随热点/路由变动。下面三档是常见顺序：当前热点 / 上次路由 / 缺省 127.0.0.1。
// 启动时优先尝试本机探测（getNetworkType + 本机网卡的 IPv4），失败回落到 hardcode。
var BASE_URLS = {
  develop: 'http://192.168.0.198:8081/api/v1',
  trial: 'https://api.treehouse.example.com/api/v1',   // TODO(上线): 替换真实域名
  release: 'https://api.treehouse.example.com/api/v1'  // TODO(上线): 替换真实域名
};

var baseUrl = BASE_URLS[ENV] || BASE_URLS.develop;

// ---- 离线兜底开关 ----
// 后端没起来时（ECONNREFUSED / 超时），页面走本地静态数据而不是卡在 loading。
// 只在开发环境生效，正式版永远关闭。
var MOCK_FALLBACK = ENV === 'develop';

// ---- 开发环境测试登录降级 ----
// 本地尚未配置真实小程序 appid/secret 时，/wechat/login 会返回
// 40101 invalid appid，导致拿不到 token，后续所有接口全部 401。
// 开启后：develop 环境下真实登录失败会自动降级调 /wechat/test-login
// （后端需 spring.profiles.active=dev，否则返回 403）。
// 填了真实 appid 后本开关可置 false。
var DEV_TEST_LOGIN = ENV === 'develop';

// ---- API 路径（与 docs/02-architecture/02-api-spec.md 对齐，不含 context-path 前缀）----
var apiPaths = {
  login: '/wechat/login',
  testLogin: '/wechat/test-login',
  userProfile: '/user/profile',
  updateProfile: '/user/update-profile',

  // 摆烂许可证
  bailanGenerate: '/bailan/generate',
  bailanMine: '/bailan/mine',
  bailanCalendar: '/bailan/calendar',

  // 签到 / 成长 / 勋章（留存钩子）
  checkinDo: '/checkin/do',
  checkinStatus: '/checkin/status',
  checkinMedals: '/checkin/medals',

  // 深夜信箱
  letterCreate: '/letter/create',
  letterMine: '/letter/mine',
  letterDetail: '/letter/detail',
  letterDeliverNow: '/letter/deliver-now',
  letterCancel: '/letter/cancel',
  // 订阅消息（一次性）
  letterSubscribeGrant: '/letter/subscribe-grant',
  letterSubscribeStatus: '/letter/subscribe-status',

  // 塔罗盲盒
  tarotDaily: '/tarot/daily',
  tarotUnlock: '/tarot/unlock',
  tarotThreeCards: '/tarot/three-cards',
  tarotTodayCheck: '/tarot/today-check',
  tarotHistory: '/tarot/history',

  // 许愿池
  wishMokugyoTap: '/wish/mokugyo/tap',
  wishCreate: '/wish/create',
  wishClose: '/wish/close',
  wishMine: '/wish/mine',

  // 漂流瓶
  bottlePublish: '/bottle/publish',
  bottleFeed: '/bottle/feed',
  bottleWarm: '/bottle/warm',

  // 通用
  coinWallet: '/coin/wallet',
  coinLogs: '/coin/logs',
  membershipPlans: '/membership/plans',
  membershipSubscribe: '/membership/subscribe',
  uploadImage: '/upload/image',

  // v1.5 隐私与社交
  userPrivacy: '/user/privacy',

  // v1.5 功能投票
  featureList: '/feature/list',
  featureMine: '/feature/mine',
  featureCreate: '/feature/create',
  featureVote: '/feature/vote',

  // v1.5 聊天
  chatSessions: '/chat/sessions',
  chatHistory: '/chat/history',
  chatSend: '/chat/send',
  chatMarkRead: '/chat/read',
  chatFriends: '/chat/friends',
  chatAddFriend: '/chat/friend/add',
  chatAcceptFriend: '/chat/friend/accept',

  // v1.5 实名
  realNameVerify: '/user/privacy/real-name',
  realNameCancel: '/user/privacy/real-name/cancel'
};

module.exports = {
  ENV: ENV,
  baseUrl: baseUrl,
  mockFallback: MOCK_FALLBACK,
  devTestLogin: DEV_TEST_LOGIN,
  apiPaths: apiPaths
};
