<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const emit = defineEmits<{ saved: [payload: MealInput] }>()
const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const previewName = ref('')
const dragging = ref(false)
const selectedFile = ref<File | null>(null)
const candidates = ref<MealCandidate[]>([])
const summary = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
const queueDepth = ref<number>()
const { analyzeImage } = useApi()
const { multiplierFor, setMultiplier, gramsInputFor, setGrams, reset: resetPortions } = usePortionAdjustment()
const totalCalories = computed(() => candidates.value.reduce((sum, candidate) => sum + scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).caloriesKcal, 0))

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
  candidates.value = []
  summary.value = null
  resetPortions()
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

function confirm(candidate: MealCandidate) {
  const factor = multiplierFor(candidate.name)
  emit('saved', {
    mealDate: new Date().toISOString().slice(0, 10), mealType: 'lunch', source: 'photo',
    name: candidate.name, confidence: candidate.confidence, confirmed: true, nutrients: scaleNutrients(candidate.nutrients, factor),
    summary: summary.value
  })
  candidates.value = []
  summary.value = null
  resetPortions()
}
</script>

<template>
  <div class="record-mode-panel" @paste="onPaste">
    <div
      class="capture-card"
      :class="{ dragging }"
      tabindex="0"
      @dragenter.prevent="dragging = true"
      @dragover.prevent
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="camera-orb"><Icon name="solar:camera-linear" /></div>
      <h2>{{ previewName || '拍下餐點，AI 自動辨識' }}</h2>
      <p>{{ previewName ? '照片已選取，產生候選後仍須確認才會儲存。' : '拍照或從相簿上傳都可以；桌面也支援拖放、貼上。' }}</p>
      <div class="capture-card__actions">
        <button type="button" class="button button--primary" @click="cameraInput?.click()">拍照</button>
        <button type="button" class="button button--secondary" @click="galleryInput?.click()">從相簿上傳</button>
      </div>
      <input ref="cameraInput" class="visually-hidden" type="file" accept="image/*" capture="environment" @change="selectFile(($event.target as HTMLInputElement).files?.[0])">
      <input ref="galleryInput" class="visually-hidden" type="file" accept="image/*" @change="selectFile(($event.target as HTMLInputElement).files?.[0])">
      <button v-if="selectedFile" type="button" class="button button--secondary" :disabled="loading" @click="analyze">{{ loading ? '分析中…' : '產生辨識候選' }}</button>
      <p v-if="queueDepth" class="queue-hint">前面還有 {{ queueDepth }} 個任務在處理，請耐心等候</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="!loading && !candidates.length && summary" class="empty-note">{{ summary }}</p>
    </div>
    <div v-if="candidates.length" class="analysis-card">
      <div class="analysis-card__head"><h2>候選清單</h2><span>請確認或修正</span></div>
      <div v-if="candidates.length > 1" class="candidate-total"><span>本次辨識共 {{ candidates.length }} 項食材，總熱量</span><b>{{ Math.round(totalCalories) }} kcal</b></div>
      <article v-for="candidate in candidates" :key="candidate.name" class="candidate-result">
        <div class="detected-food"><Icon name="solar:check-circle-linear" /><div><input v-model="candidate.name" aria-label="候選餐點名稱"><span>可信度 {{ Math.round(candidate.confidence * 100) }}%</span></div></div>
        <div class="portion-select" role="radiogroup" :aria-label="`${candidate.name} 份量調整`">
          <button
            v-for="option in portionMultiplierOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="multiplierFor(candidate.name) === option.value"
            :class="{ active: multiplierFor(candidate.name) === option.value }"
            @click="setMultiplier(candidate.name, option.value)"
          >{{ option.label }}</button>
        </div>
        <div v-if="candidate.estimatedGrams" class="portion-grams">
          <label>或直接輸入克數（AI 估計 {{ candidate.estimatedGrams }} 克）
            <input
              type="number" min="1" inputmode="numeric"
              :value="gramsInputFor(candidate.name)"
              placeholder="克"
              @input="setGrams(candidate.name, ($event.target as HTMLInputElement).value, candidate.estimatedGrams)"
            >
          </label>
        </div>
        <div class="nutrition-grid"><div class="kcal"><span>熱量</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).caloriesKcal }}</b></div><div><span>蛋白質</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).proteinG ?? '—' }} g</b></div><div><span>碳水</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).carbsG ?? '—' }} g</b></div><div><span>脂肪</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).fatG ?? '—' }} g</b></div></div>
        <button type="button" class="button button--primary button--wide" @click="confirm(candidate)">確認並儲存本餐</button>
      </article>
    </div>
  </div>
</template>
