<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const emit = defineEmits<{ saved: [payload: MealInput] }>()
const route = useRoute()
const meal = ref(String(route.query.meal ?? 'breakfast'))
const content = ref('')
const loading = ref(false)
const error = ref('')
const queueDepth = ref<number>()
const candidates = ref<MealCandidate[]>([])
const summary = ref<string | null>(null)
const { analyzeText } = useApi()
const { todayDate } = useAppDate()
const { multiplierFor, setMultiplier, gramsInputFor, setGrams, reset: resetPortions } = usePortionAdjustment()
const totalCalories = computed(() => candidates.value.reduce((sum, candidate) => sum + scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).caloriesKcal, 0))

async function analyze() {
  error.value = ''
  resetPortions()
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

function confirm(candidate: MealCandidate) {
  const factor = multiplierFor(candidate.name)
  emit('saved', {
    mealDate: todayDate(),
    mealType: meal.value as MealInput['mealType'],
    source: 'manual',
    name: candidate.name,
    confidence: candidate.confidence,
    confirmed: true,
    nutrients: scaleNutrients(candidate.nutrients, factor),
    summary: summary.value
  })
  content.value = ''
  candidates.value = []
  summary.value = null
  resetPortions()
}
</script>

<template>
  <form class="text-record-card" @submit.prevent="analyze">
    <label>餐別<select v-model="meal"><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">點心</option></select></label>
    <label>餐點內容<textarea v-model="content" required rows="6" placeholder="例如：雞胸肉便當，飯半碗，青菜兩份" /></label>
    <label>備註<input placeholder="可補充份量、烹調方式等"></label>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <button class="button button--primary button--wide" type="submit" :disabled="loading">{{ loading ? '分析中…' : '分析餐食內容' }}</button>
    <p v-if="queueDepth" class="queue-hint">前面還有 {{ queueDepth }} 個任務在處理，請耐心等候</p>
    <p v-if="!loading && !candidates.length && summary" class="empty-note">{{ summary }}</p>
    <section v-if="candidates.length" class="candidate-list" aria-label="餐食分析結果">
      <div v-if="candidates.length > 1" class="candidate-total"><span>本次辨識共 {{ candidates.length }} 項食材，總熱量</span><b>{{ Math.round(totalCalories) }} kcal</b></div>
      <article v-for="candidate in candidates" :key="candidate.name" class="candidate-result">
        <div class="detected-food">
          <Icon name="solar:check-circle-linear" />
          <div><input v-model="candidate.name" aria-label="餐點名稱"><span>辨識參考值 {{ Math.round(candidate.confidence * 100) }}%</span></div>
          <button type="button" class="button button--primary button--small" @click="confirm(candidate)">確認</button>
        </div>
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
      </article>
    </section>
  </form>
</template>
