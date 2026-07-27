<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const props = defineProps<{
  mealType: MealInput['mealType']
  mealDate: string
  mealTime: string
}>()
const emit = defineEmits<{ saved: [payloads: MealInput[], onSuccess: () => void] }>()
const listening = ref(false)
const transcript = ref('')
const loading = ref(false)
const error = ref('')
const queueDepth = ref<number>()
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
  } catch (cause) {
    // No permission prompt appears at all when the browser/OS already recorded a decision for
    // this origin (either a prior deny, or the browser app itself lacks OS-level mic access) —
    // NotAllowedError covers both, and the fix lives outside this page (site/app settings),
    // so point the user there instead of implying a retry will show the prompt again.
    error.value = cause instanceof DOMException && cause.name === 'NotAllowedError'
      ? '麥克風權限被拒絕。請到瀏覽器的網站設定（網址列旁的鎖頭／資訊圖示）將麥克風改為允許，若手機是 Android，另外確認瀏覽器 App 本身在系統設定裡也有麥克風權限，再重新整理頁面'
      : cause instanceof DOMException && cause.name === 'NotFoundError'
        ? '找不到可用的麥克風裝置'
        : '無法取得麥克風權限'
  }
}

async function analyzeRecording() {
  stream?.getTracks().forEach(track => track.stop())
  loading.value = true
  queueDepth.value = undefined
  try {
    const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
    const onProgress = (progress: { queueDepth?: number }) => { queueDepth.value = progress.queueDepth }
    const result = await transcribeAudio(await fileToBase64(blob), blob.type, onProgress)
    transcript.value = result.text
    const analysis = await analyzeText(result.text, onProgress)
    candidates.value = analysis.candidates
    summary.value = analysis.summary
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '語音分析失敗'
  } finally {
    loading.value = false
    queueDepth.value = undefined
  }
}

function confirm(payloads: MealInput[]) {
  emit('saved', payloads, () => {
    candidates.value = []
    summary.value = null
  })
}

onBeforeUnmount(() => stream?.getTracks().forEach(track => track.stop()))
</script>

<template>
  <div class="voice-card">
    <div class="voice-orb" :class="{ listening }"><Icon name="solar:microphone-2-linear" /></div>
    <h2>{{ listening ? '正在聆聽…' : loading ? '正在轉錄並分析…' : '說出剛才吃了什麼' }}</h2>
    <p>例如：「早餐吃了一份鮪魚蛋吐司和一杯無糖豆漿。」</p>
    <button type="button" class="button button--primary" :disabled="loading" @click="toggle">{{ listening ? '停止錄音' : '開始錄音' }}</button>
    <p v-if="queueDepth" class="queue-hint">前面還有 {{ queueDepth }} 個任務在處理，請耐心等候</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="transcript" class="transcript"><span>辨識文字</span><p>{{ transcript }}</p></div>
    <p v-if="!loading && !candidates.length && summary" class="empty-note">{{ summary }}</p>
    <MealCandidateSelector
      v-if="candidates.length"
      :candidates="candidates"
      :summary="summary"
      source="voice"
      :meal-type="props.mealType"
      :meal-date="props.mealDate"
      :meal-time="props.mealTime"
      @saved="confirm"
    />
  </div>
</template>
