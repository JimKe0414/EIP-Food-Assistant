<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const emit = defineEmits<{ saved: [payload: MealInput] }>()
const listening = ref(false)
const transcript = ref('')
const loading = ref(false)
const error = ref('')
const candidates = ref<MealCandidate[]>([])
const summary = ref<string | null>(null)
const { transcribeAudio, analyzeText } = useApi()
let recorder: MediaRecorder | undefined
let stream: MediaStream | undefined
let chunks: Blob[] = []

async function toggle() {
  error.value = ''
  if (!navigator.onLine) { error.value = '語音分析需要網路連線'; return }
  if (listening.value) {
    recorder?.stop()
    listening.value = false
    return
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { error.value = '此瀏覽器不支援錄音'; return }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = analyzeRecording
    recorder.start()
    listening.value = true
  } catch { error.value = '無法取得麥克風權限' }
}

async function analyzeRecording() {
  stream?.getTracks().forEach(track => track.stop())
  loading.value = true
  try {
    const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
    const result = await transcribeAudio(await fileToBase64(blob), blob.type)
    transcript.value = result.text
    const analysis = await analyzeText(result.text)
    candidates.value = analysis.candidates
    summary.value = analysis.summary
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '語音分析失敗'
  } finally { loading.value = false }
}

function confirm(candidate: MealCandidate) {
  emit('saved', {
    mealDate: new Date().toISOString().slice(0, 10), mealType: 'lunch', source: 'voice',
    name: candidate.name, confidence: candidate.confidence, confirmed: true, nutrients: candidate.nutrients,
    summary: summary.value
  })
  candidates.value = []
  summary.value = null
}

onBeforeUnmount(() => stream?.getTracks().forEach(track => track.stop()))
</script>

<template>
  <div class="voice-card">
    <div class="voice-orb" :class="{ listening }"><Icon name="solar:microphone-2-linear" /></div>
    <h2>{{ listening ? '正在聆聽…' : loading ? '正在轉錄並分析…' : '說出剛才吃了什麼' }}</h2>
    <p>例如：「早餐吃了一份鮪魚蛋吐司和一杯無糖豆漿。」</p>
    <button type="button" class="button button--primary" :disabled="loading" @click="toggle">{{ listening ? '停止錄音' : '開始錄音' }}</button>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="transcript" class="transcript"><span>辨識文字</span><p>{{ transcript }}</p></div>
    <section v-if="candidates.length" class="candidate-list">
      <article v-for="candidate in candidates" :key="candidate.name" class="detected-food"><Icon name="solar:check-circle-linear" /><div><input v-model="candidate.name" aria-label="候選餐點名稱"><span>信心值 {{ Math.round(candidate.confidence * 100) }}%</span></div><button type="button" class="button button--primary button--small" @click="confirm(candidate)">確認</button></article>
    </section>
  </div>
</template>
