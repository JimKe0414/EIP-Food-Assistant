<script setup lang="ts">
import type { MealCandidate } from '~/shared/domain/ai'
import type { MealInput } from '~/shared/domain/meals'

const props = defineProps<{
  candidates: MealCandidate[]
  summary: string | null
  source: MealInput['source']
  mealType: MealInput['mealType']
  mealDate: string
  mealTime: string
}>()

const emit = defineEmits<{ saved: [payloads: MealInput[]] }>()
const selectedIndexes = ref<number[]>([])
const { multiplierFor, setMultiplier, gramsInputFor, setGrams, reset: resetPortions } = usePortionAdjustment()

watch(() => props.candidates, (candidates) => {
  selectedIndexes.value = candidates.map((_, index) => index)
  resetPortions()
}, { immediate: true })

const selectedCount = computed(() => selectedIndexes.value.length)
const canSave = computed(() => {
  if (!selectedCount.value) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(props.mealDate) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(props.mealTime)) return false
  return selectedIndexes.value.every(index => Boolean(props.candidates[index]?.name.trim()))
})
const totalCalories = computed(() => selectedIndexes.value.reduce((sum, index) => {
  const candidate = props.candidates[index]
  return candidate
    ? sum + scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).caloriesKcal
    : sum
}, 0))

function saveSelected() {
  if (!canSave.value) return
  const payloads = selectedIndexes.value
    .sort((left, right) => left - right)
    .map((index): MealInput | null => {
      const candidate = props.candidates[index]
      if (!candidate) return null
      return {
        mealDate: props.mealDate,
        mealTime: props.mealTime,
        mealType: props.mealType,
        source: props.source,
        name: candidate.name,
        confidence: candidate.confidence,
        confirmed: true,
        nutrients: scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)),
        summary: props.summary
      }
    })
    .filter((meal): meal is MealInput => meal !== null)

  if (payloads.length) emit('saved', payloads)
}
</script>

<template>
  <section class="candidate-list" aria-label="餐食分析結果">
    <div class="candidate-total">
      <span>已選 {{ selectedCount }}／{{ candidates.length }} 項，合計熱量</span>
      <b>{{ Math.round(totalCalories) }} kcal</b>
    </div>
    <article
      v-for="(candidate, index) in candidates"
      :key="index"
      class="candidate-result"
      :class="{ 'candidate-result--unselected': !selectedIndexes.includes(index) }"
    >
      <div class="detected-food">
        <label class="candidate-check" :aria-label="`選擇 ${candidate.name}`">
          <input v-model="selectedIndexes" type="checkbox" :value="index">
        </label>
        <div>
          <input v-model="candidate.name" aria-label="餐點名稱">
          <span>辨識參考值 {{ Math.round(candidate.confidence * 100) }}%</span>
        </div>
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
            type="number"
            min="1"
            inputmode="numeric"
            :value="gramsInputFor(candidate.name)"
            placeholder="克"
            @input="setGrams(candidate.name, ($event.target as HTMLInputElement).value, candidate.estimatedGrams)"
          >
        </label>
      </div>
      <div class="nutrition-grid">
        <div class="kcal"><span>熱量</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).caloriesKcal }}</b></div>
        <div><span>蛋白質</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).proteinG ?? '—' }} g</b></div>
        <div><span>碳水</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).carbsG ?? '—' }} g</b></div>
        <div><span>脂肪</span><b>{{ scaleNutrients(candidate.nutrients, multiplierFor(candidate.name)).fatG ?? '—' }} g</b></div>
      </div>
    </article>
    <button
      type="button"
      class="button button--primary button--wide candidate-save"
      :disabled="!canSave"
      @click="saveSelected"
    >
      儲存已選的 {{ selectedCount }} 個餐點
    </button>
  </section>
</template>
