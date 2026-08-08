// utils/request.js — 统一请求封装
// 模式复用 ai-watermark-miniprogram + zj-miniprogram：自动带 Authorization: Bearer {token}
//
// 关键修正：
//   1. 不再依赖 getApp()（onLaunch 阶段为 undefined，原版会 TypeError 白屏）
//   2. 后端未启动时（fail）不再无限卡住，10s 超时 + 统一 err.offline 标记
//   3. 401/40101 静默重登后重试一次

var config = require('./config.js')
var auth = require('./auth.js')

/** 拼完整 URL */
function fullUrl(url) {
  return url.indexOf('http') === 0 ? url : config.baseUrl + url
}

/** 统一错误对象 */
function makeError(message, code, offline) {
  var err = new Error(message)
  err.code = code
  err.offline = !!offline
  return err
}

/**
 * 发起请求
 *
 * @param {Object} options
 * @param {string} options.url 接口路径（/ 开头自动拼 baseUrl）或完整 URL
 * @param {string} [options.method] 默认 GET
 * @param {Object} [options.data]
 * @param {Object} [options.header]
 * @param {boolean} [options.quiet] true 时失败不弹 toast
 * @param {number} [options.timeout] 默认 10000
 * @param {boolean} [options._retried] 内部标记：重登后已重试过
 * @returns {Promise<any>} 成功 resolve 响应的 data 字段
 */
function request(options) {
  return auth.ensureLogin()
    .catch(function (err) {
      // 登录失败（常见于后端没起）不阻断请求本身，让它带空 token 打过去，
      // 由后端返回 401 或网络层 fail 统一走兜底逻辑。
      console.warn('[request] 登录未完成，继续尝试请求：', options.url, err && err.errMsg)
      return null
    })
    .then(function () {
      return new Promise(function (resolve, reject) {
        var header = Object.assign(
          {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (auth.getToken() || '')
          },
          options.header || {}
        )

        wx.request({
          url: fullUrl(options.url),
          method: options.method || 'GET',
          data: options.data || {},
          header: header,
          timeout: options.timeout || 10000,
          success: function (res) {
            var body = res.data || {}

            // 成功
            if (res.statusCode === 200 && body.code === 200) {
              resolve(body.data)
              return
            }

            // token 失效 → 静默重登 → 重试一次
            if (res.statusCode === 401 || body.code === 40101) {
              if (options._retried) {
                reject(makeError('登录已过期，请重新进入', 40101))
                return
              }
              // 从来没登录成功过（token 为空）说明登录链路本身坏了，
              // 再 forceLogin 也是同样失败 → 直接返回，避免每个接口刷一轮无效重试
              if (!auth.getToken()) {
                reject(makeError('未登录：登录接口不可用（检查后端 appid 配置或 dev profile）', 40101, true))
                return
              }
              console.warn('[request] token 失效，静默重登后重试：', options.url)
              auth.forceLogin().then(
                function () {
                  options._retried = true
                  resolve(request(options))
                },
                function (e) {
                  reject(makeError('登录失败', 40101, true))
                }
              )
              return
            }

            // 业务错误
            if (!options.quiet) {
              wx.showToast({ title: body.message || '请求失败', icon: 'none' })
            }
            reject(makeError(body.message || 'HTTP ' + res.statusCode, body.code))
          },
          fail: function (err) {
            // 后端没启动 / 断网 / 超时 → offline 标记，页面可据此走本地兜底
            if (!options.quiet) {
              wx.showToast({ title: '网络开小差了', icon: 'none' })
            }
            console.warn('[request] 网络失败：', fullUrl(options.url), err && err.errMsg)
            reject(makeError((err && err.errMsg) || '网络失败', null, true))
          }
        })
      })
    })
}

function get(url, data, options) {
  return request(Object.assign({ url: url, method: 'GET', data: data }, options || {}))
}

function post(url, data, options) {
  return request(Object.assign({ url: url, method: 'POST', data: data }, options || {}))
}

function put(url, data, options) {
  return request(Object.assign({ url: url, method: 'PUT', data: data }, options || {}))
}

function del(url, data, options) {
  return request(Object.assign({ url: url, method: 'DELETE', data: data }, options || {}))
}

/**
 * 上传文件（multipart/form-data）
 * 封装 wx.uploadFile：自动带 token、自动拼 baseUrl、JSON 解析、401 静默重登重试一次
 *
 * @param {string} url 接口路径（如 '/upload/image'）
 * @param {string} filePath 本地临时文件路径（wxfile://...）
 * @param {Object} [formData] 额外表单字段，如 { bizType: 'avatar' }
 * @param {Object} [options] { quiet, _retried }
 * @returns {Promise<{url:string, filename:string}>}
 */
function uploadFile(url, filePath, formData, options) {
  options = options || {}
  return auth.ensureLogin()
    .catch(function () { return null })
    .then(function () {
      return new Promise(function (resolve, reject) {
        wx.uploadFile({
          url: fullUrl(url),
          filePath: filePath,
          name: 'file',
          formData: formData || {},
          header: { Authorization: 'Bearer ' + (auth.getToken() || '') },
          success: function (res) {
            // wx.uploadFile 的 res.data 是字符串，需手动 parse
            var body = {}
            try {
              body = JSON.parse(res.data || '{}')
            } catch (e) {
              reject(makeError('上传响应解析失败'))
              return
            }

            if (res.statusCode === 200 && body.code === 200) {
              resolve(body.data)
              return
            }

            if (res.statusCode === 401 || body.code === 40101) {
              if (options._retried) {
                reject(makeError('登录已过期，请重新进入', 40101))
                return
              }
              auth.forceLogin().then(
                function () {
                  options._retried = true
                  resolve(uploadFile(url, filePath, formData, options))
                },
                function () { reject(makeError('登录失败', 40101, true)) }
              )
              return
            }

            if (!options.quiet) {
              wx.showToast({ title: body.message || '上传失败', icon: 'none' })
            }
            reject(makeError(body.message || 'HTTP ' + res.statusCode, body.code))
          },
          fail: function (err) {
            if (!options.quiet) {
              wx.showToast({ title: '上传失败，网络开小差了', icon: 'none' })
            }
            reject(makeError((err && err.errMsg) || '上传失败', null, true))
          }
        })
      })
    })
}

module.exports = {
  request: request,
  get: get,
  post: post,
  put: put,
  del: del,
  uploadFile: uploadFile,
  fullUrl: fullUrl
}
