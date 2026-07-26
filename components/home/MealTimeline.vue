<script setup lang="ts">
import type { DashboardMeal } from '~/types/dashboard'

const props = defineProps<{ meals: DashboardMeal[] }>()
const { formatTime } = useAppDate()

const mealTypeLabels: Record<DashboardMeal['mealType'], string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心'
}
const sourceLabels: Record<DashboardMeal['source'], string> = {
  manual: '文字記錄',
  photo: '照片辨識',
  voice: '語音辨識',
  eip: 'EIP 紀錄',
  custom: '自訂食物',
  tfda: 'TFDA 資料'
}
const missingMealTypes = computed(() => (['breakfast', 'lunch', 'dinner'] as const)
  .filter(type => !props.meals.some(meal => meal.mealType === type)))
</script>

<template>
  <div class="meal-timeline">
    <article v-for="meal in meals" :key="meal.id">
      <time :datetime="meal.createdAt">{{ formatTime(meal.createdAt) }}</time>
      <div>
        <b>{{ meal.name }}</b>
        <span>{{ mealTypeLabels[meal.mealType] }}・{{ sourceLabels[meal.source] }}<template v-if="meal.confidence !== null">・辨識參考值 {{ Math.round(meal.confidence * 100) }}%</template></span>
      </div>
      <strong>{{ Math.round(meal.caloriesKcal) }} kcal</strong>
    </article>
    <NuxtLink v-for="mealType in missingMealTypes" :key="mealType" :to="`/record?meal=${mealType}`">
      <span class="meal-timeline__empty">＋</span>
      <div><b>{{ mealTypeLabels[mealType] }}尚未記錄</b><span>新增後會立即更新本頁</span></div>
      <strong>—</strong>
    </NuxtLink>
  </div>
</template>
