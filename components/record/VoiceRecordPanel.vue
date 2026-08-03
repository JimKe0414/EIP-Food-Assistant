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
const recordingSeconds = ref(0)
const recordedAudio = shallowRef<Blob>()
const recordedAudioUrl = ref('')
const browserRecorderSupported = ref(false)
const showDeviceRecorderFallback = ref(false)
const audioInput = ref<HTMLInputElement | null>(null)
const { transcribeAudio, analyzeText } = useApi()
let recorder: MediaRecorder | undefined
let stream: MediaStream | undefined
let chunks: Blob[] = []
let recordingTimer: number | undefined

const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const supportedMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/webm'
]

const recordingTime = computed(() => {
  const minutes = Math.floor(recordingSeconds.value / 60)
  const seconds = recordingSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const title = computed(() => {
  if (listening.value) return `正在錄音 ${recordingTime.value}`
  if (loading.value) return '正在轉錄並分析…'
  if (recordedAudio.value) return '錄音完成，請先播放確認'
  return '說出剛才吃了什麼'
})

function stopStream() {
  stream?.getTracks().forEach(track => track.stop())
  stream = undefined
}

function stopRecordingTimer() {
  if (recordingTimer !== undefined) window.clearInterval(recordingTimer)
  recordingTimer = undefined
}

function revokeRecordedAudioUrl() {
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
  recordedAudioUrl.value = ''
}

function clearAnalysis() {
  transcript.value = ''
  candidates.value = []
  summary.value = null
}

function discardRecording() {
  revokeRecordedAudioUrl()
  recordedAudio.value = undefined
  chunks = []
}

function useRecordedAudio(audio: Blob) {
  if (!audio.size) {
    error.value = '沒有錄到聲音，請重新錄音'
    return
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    error.value = '錄音檔過大，請控制在 20 MB 以內'
    return
  }
  discardRecording()
  clearAnalysis()
  recordedAudio.value = audio
  recordedAudioUrl.value = URL.createObjectURL(audio)
}

async function toggle() {
  error.value = ''
  if (listening.value) {
    stopRecording()
    return
  }
  if (!navigator.onLine) { error.value = '語音分析需要網路連線'; return }
  if (!browserRecorderSupported.value) {
    error.value = window.isSecureContext
      ? '此瀏覽器無法直接錄音，請改用裝置錄音或選擇音訊檔'
      : '目前網址不是受信任的 HTTPS，瀏覽器無法直接使用麥克風；請改用裝置錄音，或改從受信任的 HTTPS 網址開啟'
    openAudioInput()
    return
  }
  try {
    discardRecording()
    clearAnalysis()
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks = []
    const mimeType = supportedMimeTypes.find(type => MediaRecorder.isTypeSupported(type))
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = prepareRecording
    recorder.onerror = () => {
      error.value = '錄音過程發生錯誤，請重新錄音'
      listening.value = false
      stopRecordingTimer()
      stopStream()
    }
    recorder.start(250)
    recordingSeconds.value = 0
    recordingTimer = window.setInterval(() => { recordingSeconds.value += 1 }, 1000)
    listening.value = true
  } catch (cause) {
    stopStream()
    showDeviceRecorderFallback.value = true
    error.value = cause instanceof DOMException && cause.name === 'NotAllowedError'
      ? '麥克風權限被拒絕。若網址列顯示憑證錯誤或「不安全」，瀏覽器會自動拒絕麥克風，須先讓裝置信任該站憑證；否則請到網站設定允許麥克風後重試，或改用裝置錄音'
      : cause instanceof DOMException && cause.name === 'NotFoundError'
        ? '找不到可用的麥克風裝置'
        : '無法取得麥克風權限'
  }
}

function stopRecording() {
  if (recorder?.state !== 'inactive') recorder?.stop()
  listening.value = false
  stopRecordingTimer()
}

function prepareRecording() {
  const mimeType = recorder?.mimeType || chunks.find(chunk => chunk.type)?.type || 'audio/webm'
  stopStream()
  stopRecordingTimer()
  listening.value = false
  recorder = undefined
  useRecordedAudio(new Blob(chunks, { type: mimeType }))
}

function openAudioInput() {
  audioInput.value?.click()
}

function selectAudio(event: Event) {
  error.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.type && !file.type.startsWith('audio/')) {
    error.value = '請選擇音訊檔'
    return
  }
  useRecordedAudio(file)
}

async function analyzeRecording() {
  const audio = recordedAudio.value
  if (!audio) {
    error.value = '請先完成錄音'
    return
  }
  error.value = ''
  loading.value = true
  queueDepth.value = undefined
  try {
    const onProgress = (progress: { queueDepth?: number }) => { queueDepth.value = progress.queueDepth }
    const result = await transcribeAudio(
      await fileToBase64(audio),
      audio.type || 'audio/webm',
      onProgress
    )
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
    discardRecording()
    transcript.value = ''
    candidates.value = []
    summary.value = null
  })
}

function recordAgain() {
  discardRecording()
  error.value = ''
  if (browserRecorderSupported.value) void toggle()
  else openAudioInput()
}

onMounted(() => {
  browserRecorderSupported.value = window.isSecureContext
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && Boolean(window.MediaRecorder)
  showDeviceRecorderFallback.value = !browserRecorderSupported.value
})

onBeforeUnmount(() => {
  if (recorder) {
    recorder.ondataavailable = null
    recorder.onstop = null
    recorder.onerror = null
    if (recorder.state !== 'inactive') recorder.stop()
    recorder = undefined
  }
  stopRecordingTimer()
  stopStream()
  revokeRecordedAudioUrl()
})
</script>

<template>
  <div class="voice-card">
    <input
      ref="audioInput"
      class="visually-hidden"
      type="file"
      accept="audio/*"
      capture
      tabindex="-1"
      aria-hidden="true"
      @change="selectAudio"
    >
    <div class="voice-orb" :class="{ listening }"><Icon name="solar:microphone-2-linear" /></div>
    <h2 aria-live="polite">{{ title }}</h2>
    <p v-if="!recordedAudio">例如：「早餐吃了一份鮪魚蛋吐司和一杯無糖豆漿。」</p>
    <div v-if="!recordedAudio" class="voice-actions">
      <button type="button" class="button button--primary" :disabled="loading" @click="toggle">
        {{ listening ? '停止錄音' : browserRecorderSupported ? '開始錄音' : '使用裝置錄音' }}
      </button>
      <button
        v-if="!listening && browserRecorderSupported"
        type="button"
        class="button button--secondary"
        @click="openAudioInput"
      >{{ showDeviceRecorderFallback ? '改用裝置錄音' : '選擇音訊檔' }}</button>
    </div>
    <div v-if="recordedAudio && recordedAudioUrl" class="recording-preview">
      <audio :src="recordedAudioUrl" controls preload="metadata" aria-label="錄音預覽" />
      <div class="voice-actions">
        <button type="button" class="button button--primary" :disabled="loading" @click="analyzeRecording">
          {{ loading ? '辨識中…' : '辨識並分析餐食' }}
        </button>
        <button type="button" class="button button--secondary" :disabled="loading" @click="recordAgain">重新錄音</button>
        <button type="button" class="button button--secondary" :disabled="loading" @click="discardRecording">刪除錄音</button>
      </div>
    </div>
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
