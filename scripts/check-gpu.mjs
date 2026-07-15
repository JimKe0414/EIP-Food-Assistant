import { execFileSync } from 'node:child_process'

if (process.env.GPU_ENABLED !== 'true') process.exit(0)
if (Number(process.env.GPU_CONCURRENCY) !== 1) throw new Error('GPU_CONCURRENCY must be exactly 1')

let memoryMiB
try {
  const output = execFileSync('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8' })
  memoryMiB = Math.max(...output.trim().split(/\r?\n/).map(Number).filter(Number.isFinite))
} catch {
  throw new Error('GPU mode requested but nvidia-smi is unavailable')
}

const visionModel = process.env.AI_VISION_MODEL || ''
const audioProvider = process.env.AI_AUDIO_PROVIDER || ''
const requiredGiB = /llava:13b/i.test(visionModel) ? 10 : audioProvider === 'local-whisper' ? 8 : 6
if (memoryMiB < requiredGiB * 1024) {
  throw new Error(`GPU has ${Math.round(memoryMiB / 1024)} GiB VRAM; ${requiredGiB} GiB is required for this configuration`)
}
console.log(`[gpu-check] ${Math.round(memoryMiB / 1024)} GiB available; requirement ${requiredGiB} GiB`)
