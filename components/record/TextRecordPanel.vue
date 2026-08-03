<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const props = defineProps<{
  mealType: MealInput['mealType']
  mealDate: string
  mealTime: string
}>()
const emit = defineEmits<{ saved: [payloads: MealInput[], onSuccess: () => void] }>()
const content = ref('')
const loading = ref(false)
const error = ref('')
const queueDepth = ref<number>()
const candidates = ref<MealCandidate[]>([])
const summary = ref<string | null>(null)
const { analyzeText } = useApi()

async function analyze() {
  error.value = ''
  if (!navigator.onLine) {
    error.value = '餐食分析需要網路連線；系統不會以 0 kcal 假資料建立紀錄'
    return
  }
  loading.value = true
  queueDepth.value = undefined
  try {
    const result = await analyzeText(content.value, progress => { queueDepth.value = progress.queueDepth })
    candidates.value = result.candidates
    summary.value = result.summary
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '分析失敗，請確認已登入後再試一次'
  } finally {
    loading.value = false
    queueDepth.value = undefined
  }
}

function confirm(payloads: MealInput[]) {
  emit('saved', payloads, () => {
    content.value = ''
    candidates.value = []
    summary.value = null
  })
}
</script>

<template>
  <form class="text-record-card" @submit.prevent="analyze">
    <label>餐點內容<textarea v-model="content" required rows="6" placeholder="例如：雞胸肉便當，飯半碗，青菜兩份" /></label>
    <label>備註<input placeholder="可補充份量、烹調方式等"></label>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <button class="button button--primary button--wide" type="submit" :disabled="loading">{{ loading ? '分析中…' : '分析餐食內容' }}</button>
    <p v-if="queueDepth" class="queue-hint">前面還有 {{ queueDepth }} 個任務在處理，請耐心等候</p>
    <p v-if="!loading && !candidates.length && summary" class="empty-note">{{ summary }}</p>
    <MealCandidateSelector
      v-if="candidates.length"
      :candidates="candidates"
      :summary="summary"
      source="manual"
      :meal-type="props.mealType"
      :meal-date="props.mealDate"
      :meal-time="props.mealTime"
      @saved="confirm"
    />
  </form>
</template>
