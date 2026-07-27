<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const props = defineProps<{
  mealType: MealInput['mealType']
  mealDate: string
  mealTime: string
}>()
const emit = defineEmits<{ saved: [payloads: MealInput[], onSuccess: () => void] }>()
const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const previewName = ref('')
const previewUrl = ref('')
const dragging = ref(false)
const selectedFile = ref<File | null>(null)
const candidates = ref<MealCandidate[]>([])
const summary = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
const queueDepth = ref<number>()
const { analyzeImage } = useApi()

function replacePreview(file: File) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
}

function openFilePicker(input: HTMLInputElement | null) {
  if (!input) return
  input.value = ''
  input.click()
}

function selectFile(file?: File) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = '僅支援 JPEG、PNG 或 WebP 圖片'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    error.value = '圖片不可超過 10 MB'
    return
  }
  selectedFile.value = file
  previewName.value = file.name
  replacePreview(file)
  candidates.value = []
  summary.value = null
  error.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  selectFile(event.dataTransfer?.files[0])
}

function onPaste(event: ClipboardEvent) {
  selectFile([...event.clipboardData?.files ?? []].find(file => file.type.startsWith('image/')))
}

async function analyze() {
  if (!selectedFile.value) return
  if (!navigator.onLine) { error.value = '照片分析需要網路連線'; return }
  loading.value = true
  error.value = ''
  queueDepth.value = undefined
  try {
    const result = await analyzeImage(await fileToBase64(selectedFile.value), selectedFile.value.type, undefined, progress => { queueDepth.value = progress.queueDepth })
    candidates.value = result.candidates
    summary.value = result.summary
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '照片分析失敗'
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

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="record-mode-panel" @paste="onPaste">
    <div
      class="capture-card"
      :class="{ dragging, 'has-preview': previewUrl }"
      tabindex="0"
      @dragenter.prevent="dragging = true"
      @dragover.prevent
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
        <figure v-if="previewUrl" class="photo-preview">
          <img :src="previewUrl" :alt="`已選取的餐點照片：${previewName}`">
          <figcaption><span>圖片預覽</span><strong :title="previewName">{{ previewName }}</strong></figcaption>
        </figure>
        <div class="capture-card__body">
          <div v-if="!previewUrl" class="camera-orb"><Icon name="solar:camera-linear" /></div>
          <h2>{{ previewName || '拍下餐點，AI 自動辨識' }}</h2>
          <p>{{ previewName ? '確認圖片內容後開始辨識；也可以重新拍照或更換圖片。' : '拍照或從相簿上傳都可以；桌面也支援拖放、貼上。' }}</p>
          <div class="capture-card__actions">
            <button type="button" class="button" :class="selectedFile ? 'button--secondary' : 'button--primary'" @click="openFilePicker(cameraInput)">
              <Icon name="solar:camera-linear" />{{ selectedFile ? '重新拍照' : '拍照' }}
            </button>
            <button type="button" class="button button--secondary" @click="openFilePicker(galleryInput)">
              <Icon name="solar:upload-linear" />{{ selectedFile ? '更換圖片' : '從相簿上傳' }}
            </button>
            <button v-if="selectedFile" type="button" class="button button--primary" :disabled="loading" @click="analyze">
              <Icon :name="loading ? 'svg-spinners:ring-resize' : 'solar:verified-check-linear'" />{{ loading ? '分析中…' : '辨識照片' }}
            </button>
          </div>
          <p v-if="queueDepth" class="queue-hint">前面還有 {{ queueDepth }} 個任務在處理，請耐心等候</p>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <p v-if="!loading && !candidates.length && summary" class="empty-note">{{ summary }}</p>
        </div>
        <input ref="cameraInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" @change="selectFile(($event.target as HTMLInputElement).files?.[0])">
        <input ref="galleryInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="selectFile(($event.target as HTMLInputElement).files?.[0])">
    </div>
    <div v-if="candidates.length" class="analysis-card">
      <div class="analysis-card__head"><h2>辨識結果</h2><span>可複選並修正</span></div>
      <MealCandidateSelector
        :candidates="candidates"
        :summary="summary"
        source="photo"
        :meal-type="props.mealType"
        :meal-date="props.mealDate"
        :meal-time="props.mealTime"
        @saved="confirm"
      />
    </div>
  </div>
</template>
