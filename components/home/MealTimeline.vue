<script setup lang="ts">
import type { DashboardMeal } from '~/types/dashboard'
import { compareMealsByTypeThenRecordedAt } from '~/shared/domain/meals'

const props = defineProps<{ meals: DashboardMeal[] }>()
defineEmits<{
  edit: [meal: DashboardMeal]
  delete: [meal: DashboardMeal]
}>()
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
const orderedMeals = computed(() => [...props.meals].sort(compareMealsByTypeThenRecordedAt))
const mainMealTypes = ['breakfast', 'lunch', 'dinner'] as const
const mealsFor = (mealType: DashboardMeal['mealType']) => orderedMeals.value.filter(meal => meal.mealType === mealType)
</script>

<template>
  <div class="meal-timeline">
    <template v-for="mealType in mainMealTypes" :key="mealType">
      <article v-for="meal in mealsFor(mealType)" :key="meal.id">
        <time :datetime="`${meal.mealDate}T${meal.mealTime}`">{{ meal.mealTime.slice(0, 5) }}</time>
        <div>
          <b>{{ meal.name }}</b>
          <span>{{ mealTypeLabels[meal.mealType] }}・{{ sourceLabels[meal.source] }}・{{ formatTime(meal.createdAt) }} 記錄<template v-if="meal.confidence !== null">・辨識參考值 {{ Math.round(meal.confidence * 100) }}%</template></span>
        </div>
        <strong>{{ Math.round(meal.caloriesKcal) }} kcal</strong>
        <div class="meal-timeline__actions">
          <button type="button" :aria-label="`修改 ${meal.name}`" @click="$emit('edit', meal)">修改</button>
          <button type="button" class="meal-timeline__delete" :aria-label="`刪除 ${meal.name}`" @click="$emit('delete', meal)">刪除</button>
        </div>
      </article>
      <NuxtLink v-if="!mealsFor(mealType).length" :to="`/record?meal=${mealType}`">
        <span class="meal-timeline__empty">＋</span>
        <div><b>{{ mealTypeLabels[mealType] }}尚未記錄</b><span>新增後會立即更新本頁</span></div>
        <strong>—</strong>
      </NuxtLink>
    </template>
    <article v-for="meal in mealsFor('snack')" :key="meal.id">
      <time :datetime="`${meal.mealDate}T${meal.mealTime}`">{{ meal.mealTime.slice(0, 5) }}</time>
      <div>
        <b>{{ meal.name }}</b>
        <span>{{ mealTypeLabels[meal.mealType] }}・{{ sourceLabels[meal.source] }}・{{ formatTime(meal.createdAt) }} 記錄<template v-if="meal.confidence !== null">・辨識參考值 {{ Math.round(meal.confidence * 100) }}%</template></span>
      </div>
      <strong>{{ Math.round(meal.caloriesKcal) }} kcal</strong>
      <div class="meal-timeline__actions">
        <button type="button" :aria-label="`修改 ${meal.name}`" @click="$emit('edit', meal)">修改</button>
        <button type="button" class="meal-timeline__delete" :aria-label="`刪除 ${meal.name}`" @click="$emit('delete', meal)">刪除</button>
      </div>
    </article>
  </div>
</template>
