// scripts/gen-tarot-sfx.js — 生成塔罗音效（wav 格式，Node 原生无依赖）
//
// 输出：
//   miniprogram/images/tarot-shuffle.wav  1.6s，3 段"沙沙"白噪音（间隔 200ms）
//   miniprogram/images/tarot-flip.wav     0.3s，单声"啪"（短促衰减）
//
// 采样率 22050Hz、16-bit 单声道，文件分别约 70KB / 13KB。
// 小程序 InnerAudioContext 支持 wav，体积虽比 mp3 大但加载快。
//
// 为什么不直接用 mp3：mp3 编码要 lamejs 之类二进制依赖，wav 直接写 PCM。

const fs = require('fs')
const path = require('path')

const OUT_DIR = path.resolve(__dirname, '../miniprogram/images')
const SAMPLE_RATE = 22050
const BITS = 16
const CHANNELS = 1

// ---- WAV header (PCM 16-bit) ----
function wavHeader(numSamples) {
  const byteRate = SAMPLE_RATE * CHANNELS * (BITS / 8)
  const blockAlign = CHANNELS * (BITS / 8)
  const dataSize = numSamples * blockAlign
  const buf = Buffer.alloc(44)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)            // fmt chunk size
  buf.writeUInt16LE(1, 20)             // PCM
  buf.writeUInt16LE(CHANNELS, 22)
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(byteRate, 28)
  buf.writeUInt16LE(blockAlign, 32)
  buf.writeUInt16LE(BITS, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}

/**
 * 生成白噪音样本数组（带包络，避免刺耳）
 * @param {number} durSec 时长
 * @param {number} volume 0-1
 * @param {function} envelopeFn  (t: 0-1) => 0-1
 */
function makeNoise(durSec, volume, envelopeFn) {
  const n = Math.floor(SAMPLE_RATE * durSec)
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = envelopeFn ? envelopeFn(t) : 1
    // 白噪音 + 一点点低通让声音更"软"（移动平均 4 样本）
    const noise = (Math.random() * 2 - 1) * volume * env
    out[i] = Math.max(-32768, Math.min(32767, Math.floor(noise * 32767)))
  }
  return out
}

/** 简单低通滤波（移动平均） */
function lowpass(samples, windowSize) {
  const out = new Int16Array(samples.length)
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i]
    if (i >= windowSize) sum -= samples[i - windowSize]
    out[i] = Math.floor(sum / Math.min(i + 1, windowSize))
  }
  return out
}

/** 把多段音频拼接成一个 buffer */
function concat(...chunks) {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Int16Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

/** 静音段 */
function silence(durSec) {
  return new Int16Array(Math.floor(SAMPLE_RATE * durSec))
}

function toWavFile(samples, outPath) {
  const header = wavHeader(samples.length)
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(samples[i], i * 2)
  }
  fs.writeFileSync(outPath, Buffer.concat([header, data]))
  console.log(`✓ ${path.basename(outPath)}  ${(fs.statSync(outPath).size / 1024).toFixed(1)}KB  ${(samples.length / SAMPLE_RATE).toFixed(2)}s`)
}

// ============== 1. shuffle: 3 段"沙沙" ==============
function buildShuffle() {
  // 3 段白噪音，每段 0.35s，间隔 0.2s 静音
  // 每段：attack 30ms → sustain 250ms → release 70ms
  const burst = (vol) => makeNoise(0.35, vol, (t) => {
    if (t < 0.08) return t / 0.08            // attack
    if (t > 0.85) return (1 - t) / 0.15      // release
    return 1
  })
  const filtered = (s) => lowpass(s, 24)     // 软化
  return concat(
    filtered(burst(0.18)),
    silence(0.2),
    filtered(burst(0.22)),
    silence(0.2),
    filtered(burst(0.20))
  )
}

// ============== 2. flip: 单声"啪" ==============
function buildFlip() {
  // 0.3s：短促爆破 → 快速衰减（带一点金属感 = 高频混合）
  // 用噪声 + 短促正弦模拟
  const n = Math.floor(SAMPLE_RATE * 0.3)
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / n
    // 整体包络：超快 attack、指数衰减
    const env = Math.exp(-t * 18)
    // 噪声 + 1.2kHz 嗡鸣
    const noise = (Math.random() * 2 - 1) * 0.6
    const sine = Math.sin(2 * Math.PI * 1200 * t) * 0.4
    const sample = (noise + sine) * env * 0.5
    out[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)))
  }
  return out
}

// ============== main ==============
fs.mkdirSync(OUT_DIR, { recursive: true })

// 写完后把 tarot.js 里的 src 从 .mp3 改成 .wav
// （先确认要不要改 .js — 这里只负责生成文件，由调用方按需改）
const shuffle = buildShuffle()
const flip = buildFlip()

toWavFile(shuffle, path.join(OUT_DIR, 'tarot-shuffle.wav'))
toWavFile(flip, path.join(OUT_DIR, 'tarot-flip.wav'))

console.log('\n生成完成。需要在 tarot.js 里把 .mp3 改成 .wav，或保留 .mp3 后缀由本脚本按需改。')
