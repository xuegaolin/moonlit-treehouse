// utils/subscribe.js — 微信一次性订阅消息封装
//
// 何时调用：寄出 PENDING 信后立即弹授权（信到时是 PUSH 触发，不是授权触发）。
// 失效场景：选择 1 年后送达的信，push_token 30 天后过期 → 投递时 log 标 EXPIRED，不报错。
//
// 失败回滚策略：任何环节失败都不阻断寄信本身，仅 wx.showToast 提示用户。

var config = require('./config.js')
var request = require('./request.js')

/**
 * 弹 wx.requestSubscribeMessage 授权弹窗，用户接受后回灌 push_token 给后端。
 *
 * @param {string} letterId 信件编号 L-yyyyMMdd-xxxx
 * @param {string} templateId 后端注入的 template_id（dev 场景为空字符串）
 * @returns {Promise<{granted:boolean, status:string}>}
 *   - granted: 是否用户接受
 *   - status: 'PENDING'(成功入库) / 'REJECTED'(用户拒) / 'FAILED'(网络或后端错) / 'NO_TEMPLATE'(dev)
 */
function requestSubscribe(letterId, templateId) {
  return new Promise(function (resolve) {
    if (!templateId) {
      // dev 没填 template_id，不弹授权，直接走 no-op
      console.info('[subscribe] dev 场景：未配置 template_id，跳过授权弹窗')
      resolve({ granted: false, status: 'NO_TEMPLATE' })
      return
    }
    if (typeof wx.requestSubscribeMessage !== 'function') {
      // 旧基础库或非真机环境
      console.warn('[subscribe] wx.requestSubscribeMessage 不可用（基础库 < 2.8.2 或非真机）')
      resolve({ granted: false, status: 'UNAVAILABLE' })
      return
    }
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: function (res) {
        var accept = res && res[templateId] === 'accept'
        if (!accept) {
          console.info('[subscribe] 用户拒授权：', res)
          resolve({ granted: false, status: 'REJECTED' })
          return
        }
        // 把 push_token 送给后端入库
        var pushToken = res[templateId] // 注：accept 时返回的值就是 push_token
        request
          .post(config.apiPaths.letterSubscribeGrant, {
            letterId: letterId,
            pushToken: pushToken
          }, { quiet: true })
          .then(function (data) {
            console.info('[subscribe] 授权入库成功：', data)
            resolve({ granted: true, status: (data && data.status) || 'PENDING' })
          })
          .catch(function (err) {
            console.warn('[subscribe] 授权入库失败（不影响寄信）：', err && (err.errMsg || err.message))
            resolve({ granted: false, status: 'FAILED' })
          })
      },
      fail: function (err) {
        // 用户关弹窗 / 系统拒 / 设备关推送 → 视为 REJECTED，不报错
        console.warn('[subscribe] 弹窗失败：', err && (err.errMsg || err))
        resolve({ granted: false, status: 'REJECTED' })
      }
    })
  })
}

/**
 * 查某封信的订阅推送状态（信箱详情页 / banner 用）
 * @param {string} letterId
 * @returns {Promise<{subscribed:boolean, status?:string, expireAt?:number, errorMsg?:string}>}
 */
function getSubscribeStatus(letterId) {
  return request
    .get(config.apiPaths.letterSubscribeStatus, { letterId: letterId }, { quiet: true })
    .then(function (data) {
      return data || { subscribed: false }
    })
    .catch(function (err) {
      console.warn('[subscribe] 状态查询失败：', err && (err.errMsg || err.message))
      return { subscribed: false }
    })
}

/**
 * 把订阅结果转成对用户友好的提示文案（写完信后弹一行 toast）。
 * @param {{granted:boolean, status:string}} result
 * @returns {{toast:string, level:'success'|'warn'|'none'}}
 */
function buildResultToast(result) {
  if (!result) return { toast: '', level: 'none' }
  if (result.granted) return { toast: '已开启：信到时通知你', level: 'success' }
  if (result.status === 'REJECTED') return { toast: '未开启通知：信到时不会推送', level: 'none' }
  if (result.status === 'UNAVAILABLE') return { toast: '当前设备不支持订阅消息', level: 'warn' }
  if (result.status === 'NO_TEMPLATE') return { toast: '信已寄出（待配置推送通道后将通知你）', level: 'none' }
  if (result.status === 'FAILED') return { toast: '信已寄出（通知授权失败，不影响）', level: 'warn' }
  return { toast: '', level: 'none' }
}

module.exports = {
  requestSubscribe: requestSubscribe,
  getSubscribeStatus: getSubscribeStatus,
  buildResultToast: buildResultToast
}
