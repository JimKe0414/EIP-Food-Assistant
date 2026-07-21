<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const emit = defineEmits<{ saved: [payload: MealInput] }>()
const route = useRoute()
const meal = ref(String(route.query.meal ?? 'breakfast'))
const content = ref('')
const loading = ref(false)
const error = ref('')
const candidates = ref<MealCandidate[]>([])
const summary = ref<string | null>(null)
const { analyzeText } = useApi()
const { multiplierFor, setMultiplier, reset: resetPortions } = usePortionAdjustment()

async function analyze() {
  error.value = ''
  resetPortions()
  if (!navigator.onLine) {
    candidates.value = [{ name: content.value, portionDescription: null, confidence: 1, nutrients: { caloriesKcal: 0, proteinG: null, fatG: null, carbsG: null, fiberG: null, sodiumMg: null } }]
    summary.value = null
    return
  }
  loading.value = true
  try {
    const result = await analyzeText(content.value)
    candidates.value = result.candidates
    summary.value = result.summary
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '分析失敗，請確認已登入後再試一次'
  } finally {
    loading.value = false
  }
}

function confirm(candidate: MealCandidate) {
  const factor = multiplierFor(candidate.name)
  emit('saved', {
    mealDate: new Date().toISOString().slice(0, 10),
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
    <button class="button button--primary button--wide" type="submit" :disabled="loading">{{ loading ? '分析中…' : '產生候選並分析' }}</button>
    <section v-if="candidates.length" class="candidate-list" aria-label="餐食候選清單">
      <article v-for="candidate in candidates" :key="candidate.name" class="candidate-result">
        <div class="detected-food">
          <Icon name="solar:check-circle-linear" />
          <div><input v-model="candidate.name" aria-label="候選餐點名稱"><span>信心值 {{ Math.round(candidate.confidence * 100) }}%・{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).caloriesKcal }} kcal</span></div>
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
      </article>
    </section>
  </form>
</template>
