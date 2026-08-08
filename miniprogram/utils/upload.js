// utils/upload.js — 图片上传工具（wx.uploadFile 封装）
// 与后端 POST /api/v1/upload/image 对齐，自动带 Authorization: Bearer {token}
//
// 关键修正：不依赖 getApp()，复用 utils/request.js 的 uploadFile（含 401 重登重试）
var config = require('./config.js')
var request = require('./request.js')

/**
 * 上传本地文件（Canvas 生成的临时图片、相册选中的照片）到后端
 *
 * @param {Object} options
 * @param {string} options.filePath  本地文件路径（canvasToTempFilePath / chooseMedia 返回的 tempFilePath）
 * @param {string} [options.bizType] 业务类型：bailan / letter / tarot / avatar，默认 general
 * @param {string} [options.bizId]   关联业务 ID（如 licenseNo），可选
 * @param {boolean} [options.quiet]  true 时失败不弹 toast
 * @returns {Promise<{url:string, filename:string}>} 服务端返回的可访问 URL
 */
function uploadImage(options) {
  var formData = { bizType: options.bizType || 'general' }
  if (options.bizId) formData.bizId = options.bizId

  return request.uploadFile(
    config.apiPaths.uploadImage,
    options.filePath,
    formData,
    { quiet: options.quiet }
  )
}

/**
 * 从 Canvas 节点上传：先 canvasToTempFilePath → 再 uploadImage
 *
 * @param {Object} options
 * @param {Object} options.canvas     canvas 节点（createSelectorQuery().select().fields({node:true}) 返回的 node）
 * @param {string} [options.bizType]
 * @param {string} [options.bizId]
 * @param {Object} [options.pageThis] Page 实例（wx.canvasToTempFilePath 需要）
 * @param {boolean} [options.quiet]
 * @returns {Promise<{url:string, filename:string}>}
 */
function uploadCanvas(options) {
  return new Promise(function (resolve, reject) {
    wx.canvasToTempFilePath(
      {
        canvas: options.canvas,
        fileType: 'png',
        success: function (res) {
          uploadImage({
            filePath: res.tempFilePath,
            bizType: options.bizType,
            bizId: options.bizId,
            quiet: options.quiet
          }).then(resolve, reject)
        },
        fail: function (err) {
          reject(err)
        }
      },
      options.pageThis
    )
  })
}

/**
 * 拼接服务端返回的相对 URL 为完整可访问地址
 * 后端 context-path=/api/v1，ResourceHandler 映射到 /api/v1/uploads/**
 * @param {string} relativeUrl 如 '/uploads/xxx.png'
 */
function resolveUrl(relativeUrl) {
  if (!relativeUrl) return ''
  if (relativeUrl.indexOf('http') === 0) return relativeUrl
  return config.baseUrl + relativeUrl
}

module.exports = {
  uploadImage: uploadImage,
  uploadCanvas: uploadCanvas,
  resolveUrl: resolveUrl
}
