// utils/tarot-share.js — 塔罗分享卡（Canvas 2D 海报）
//
// 跟 bailan 一样的紫色渐变 + 金边 + 月牙风格。
// 单张牌 = 每日一抽；三张牌 = 三牌阵。
// 绘制完成后由页面调 exportToAlbum(canvasId) 保存到相册。
//
// 接口：
//   drawShareCard({ canvasId, reading, activeTab }) -> Promise<void>
//   exportToAlbum(canvasId) -> Promise<void>

/**
 * 绘制分享卡
 * @param {Object} opts
 * @param {string} opts.canvasId  WXML 里 <canvas id="..."> 的 id
 * @param {Object} opts.reading   TarotReadingVO
 * @param {'daily'|'three'} opts.activeTab
 */
function drawShareCard(opts) {
  var canvasId = opts.canvasId
  var reading = opts.reading || {}
  var activeTab = opts.activeTab || 'daily'

  return new Promise(function (resolve, reject) {
    var query = wx.createSelectorQuery()
    query.select('#' + canvasId)
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('canvas 节点未找到：' + canvasId))
          return
        }
        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        var dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2) || 2
        var W = res[0].width
        var H = res[0].height
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        try {
          // 1. 背景
          var bg = ctx.createLinearGradient(0, 0, 0, H)
          bg.addColorStop(0, '#3D3663')
          bg.addColorStop(1, '#221E3D')
          ctx.fillStyle = bg
          roundRect(ctx, 0, 0, W, H, 14)
          ctx.fill()

          // 2. 金边
          ctx.strokeStyle = '#F5D76E'
          ctx.lineWidth = 2
          roundRect(ctx, 10, 10, W - 20, H - 20, 10)
          ctx.stroke()

          // 3. 月牙
          drawMoon(ctx, W / 2, 56)

          // 4. 标题
          ctx.textAlign = 'center'
          ctx.fillStyle = '#F5D76E'
          ctx.font = 'bold 26px serif'
          ctx.fillText(activeTab === 'three' ? '三牌阵' : '塔罗盲盒', W / 2, 108)
          ctx.fillStyle = '#B9B3E8'
          ctx.font = '10px sans-serif'
          ctx.fillText('MOONLIT  TAROT', W / 2, 128)

          // 5. 分隔线
          ctx.strokeStyle = 'rgba(245,215,110,0.5)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(40, 142)
          ctx.lineTo(W - 40, 142)
          ctx.stroke()

          // 6. 牌面
          var cards = reading.cards || []
          if (activeTab === 'three' && cards.length === 3) {
            // 三牌阵：横排
            drawThreeCards(ctx, W, 170, cards)
          } else if (cards.length > 0) {
            // 每日一抽：单张
            drawSingleCard(ctx, W, 170, cards[0])
          }

          // 7. 短解读
          var yAfter = activeTab === 'three' ? 360 : 380
          ctx.textAlign = 'center'
          ctx.fillStyle = '#F5D76E'
          ctx.font = 'bold 13px sans-serif'
          ctx.fillText('✦ 解读 ✦', W / 2, yAfter)
          ctx.fillStyle = '#E8E6F5'
          ctx.font = '13px sans-serif'
          var body = reading.shortInterpretation || '今天的牌，藏着你心里那个隐隐的光。'
          wrapText(ctx, body, 36, yAfter + 22, W - 72, 20, 4, 'center')

          // 8. 幸运色 + 数字（仅每日一抽）
          var luckyY = H - 76
          if (activeTab === 'daily' && (reading.luckyColor || reading.luckyNumber)) {
            ctx.textAlign = 'center'
            ctx.fillStyle = '#9C97B8'
            ctx.font = '11px sans-serif'
            ctx.fillText('— 今日指引 —', W / 2, luckyY - 22)
            var xCenter = W / 2
            if (reading.luckyColor) {
              ctx.fillStyle = reading.luckyColor
              ctx.beginPath()
              ctx.arc(xCenter - 30, luckyY, 12, 0, Math.PI * 2)
              ctx.fill()
              ctx.strokeStyle = 'rgba(245,215,110,0.4)'
              ctx.lineWidth = 1
              ctx.stroke()
              ctx.fillStyle = '#B9B3E8'
              ctx.font = '10px sans-serif'
              ctx.fillText('幸运色', xCenter - 30, luckyY + 24)
            }
            if (reading.luckyNumber) {
              ctx.fillStyle = '#F5D76E'
              ctx.font = 'bold 18px serif'
              ctx.fillText(String(reading.luckyNumber), xCenter + 30, luckyY + 6)
              ctx.fillStyle = '#B9B3E8'
              ctx.font = '10px sans-serif'
              ctx.fillText('幸运数字', xCenter + 30, luckyY + 24)
            }
          }

          // 9. 落款
          ctx.textAlign = 'center'
          ctx.fillStyle = '#9C97B8'
          ctx.font = '10px sans-serif'
          ctx.fillText(formatDate(new Date()), W / 2, H - 32)

          resolve()
        } catch (err) {
          reject(err)
        }
      })
  })
}

// 单张牌：日卡大图
function drawSingleCard(ctx, W, y, card) {
  var cardW = 160
  var cardH = 220
  var x = (W - cardW) / 2
  // 牌面
  var grad = ctx.createLinearGradient(x, y, x, y + cardH)
  if (card.position === 'upright') {
    grad.addColorStop(0, '#6B5CE7')
    grad.addColorStop(1, '#4A3F8F')
  } else {
    grad.addColorStop(0, '#2A2450')
    grad.addColorStop(1, '#1F1C33')
  }
  ctx.fillStyle = grad
  roundRect(ctx, x, y, cardW, cardH, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(245,215,110,0.3)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, cardW, cardH, 14)
  ctx.stroke()

  // emoji
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '64px sans-serif'
  ctx.fillText(card.emoji || '🃏', x + cardW / 2, y + 78)

  // 牌名
  ctx.fillStyle = '#F5D76E'
  ctx.font = 'bold 22px serif'
  ctx.fillText(card.name || '—', x + cardW / 2, y + 124)
  ctx.fillStyle = '#B9B3E8'
  ctx.font = '10px sans-serif'
  ctx.fillText(card.nameEn || '', x + cardW / 2, y + 142)

  // 正逆位
  var posLabel = card.positionName || (card.position === 'upright' ? '正位' : '逆位')
  ctx.fillStyle = card.position === 'upright' ? '#F5D76E' : '#FF6B81'
  ctx.font = '11px sans-serif'
  ctx.fillText(posLabel, x + cardW / 2, y + 168)

  // 关键词
  var kws = (card.keywords || []).slice(0, 3)
  if (kws.length) {
    ctx.fillStyle = '#B9B3E8'
    ctx.font = '10px sans-serif'
    ctx.fillText(kws.join(' · '), x + cardW / 2, y + 192)
  }
}

// 三张牌：横排
function drawThreeCards(ctx, W, y, cards) {
  var cardW = 88
  var cardH = 140
  var gap = 16
  var totalW = cardW * 3 + gap * 2
  var startX = (W - totalW) / 2
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i]
    var x = startX + i * (cardW + gap)
    // 牌面
    var grad = ctx.createLinearGradient(x, y, x, y + cardH)
    if (c.position === 'upright') {
      grad.addColorStop(0, '#6B5CE7')
      grad.addColorStop(1, '#4A3F8F')
    } else {
      grad.addColorStop(0, '#2A2450')
      grad.addColorStop(1, '#1F1C33')
    }
    ctx.fillStyle = grad
    roundRect(ctx, x, y, cardW, cardH, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(245,215,110,0.3)'
    ctx.lineWidth = 1
    roundRect(ctx, x, y, cardW, cardH, 10)
    ctx.stroke()

    // emoji
    ctx.textAlign = 'center'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '32px sans-serif'
    ctx.fillText(c.emoji || '🃏', x + cardW / 2, y + 44)

    // 牌名
    ctx.fillStyle = '#F5D76E'
    ctx.font = 'bold 13px serif'
    ctx.fillText(c.name || '—', x + cardW / 2, y + 76)
    // 位置
    ctx.fillStyle = c.position === 'upright' ? '#F5D76E' : '#FF6B81'
    ctx.font = '9px sans-serif'
    ctx.fillText(c.positionName || '', x + cardW / 2, y + 92)
    // role（过去/现在/未来）
    ctx.fillStyle = '#9C97B8'
    ctx.font = '10px sans-serif'
    ctx.fillText(c.role || '', x + cardW / 2, y + 112)
  }
}

// 月牙装饰
function drawMoon(ctx, cx, cy) {
  ctx.fillStyle = '#F5D76E'
  ctx.beginPath()
  ctx.arc(cx, cy, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3D3663'
  ctx.beginPath()
  ctx.arc(cx + 8, cy - 5, 15, 0, Math.PI * 2)
  ctx.fill()
}

// 圆角矩形路径
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 文本自动换行
// align: 'left' | 'center'
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines, align) {
  if (align === 'center') {
    ctx.textAlign = 'center'
    x = x + maxWidth / 2
  } else {
    ctx.textAlign = 'left'
  }
  // 中文逐字断行
  var line = ''
  var lines = 0
  for (var i = 0; i < text.length; i++) {
    var ch = text[i]
    if (ctx.measureText(line + ch).width > maxWidth) {
      ctx.fillText(line, x, y)
      y += lineHeight
      line = ch
      lines++
      if (lines >= maxLines - 1) {
        while (i < text.length && ctx.measureText(line + '…').width <= maxWidth) {
          line += text[i]
          i++
        }
        ctx.fillText(line + '…', x, y)
        return y
      }
    } else {
      line += ch
    }
  }
  if (line) ctx.fillText(line, x, y)
  return y
}

function formatDate(d) {
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'
}

// 导出到相册
function exportToAlbum(canvasId) {
  return new Promise(function (resolve, reject) {
    var query = wx.createSelectorQuery()
    query.select('#' + canvasId)
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('canvas 节点未找到'))
          return
        }
        var canvas = res[0].node
        wx.canvasToTempFilePath({
          canvas: canvas,
          success: function (r) {
            wx.saveImageToPhotosAlbum({
              filePath: r.tempFilePath,
              success: function () { resolve(r.tempFilePath) },
              fail: function (err) { reject(err) }
            })
          },
          fail: function (err) { reject(err) }
        })
      })
  })
}

module.exports = {
  drawShareCard: drawShareCard,
  exportToAlbum: exportToAlbum
}
