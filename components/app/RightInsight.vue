<script setup lang="ts">
import type { DashboardSummary } from '~/types/dashboard'

const { todayDate, formatCalendarDate } = useAppDate()
const { data: summary } = await useFetch<DashboardSummary>('/api/meals/summary', { key: 'meal-summary' })
const dateLabel = formatCalendarDate(todayDate())

const targetProgress = computed(() => {
  const target = summary.value?.targets?.caloriesKcal
  if (!target) return 0
  return Math.min(100, Math.round((summary.value?.today.caloriesKcal ?? 0) / target * 100))
})
const remainingLabel = computed(() => {
  const target = summary.value?.targets?.caloriesKcal
  if (!target) return '尚未建立個人熱量目標'
  const remaining = target - (summary.value?.today.caloriesKcal ?? 0)
  return remaining >= 0
    ? `距離目標還有 ${Math.round(remaining).toLocaleString()} kcal`
    : `超過目標 ${Math.round(Math.abs(remaining)).toLocaleString()} kcal`
})
const tip = computed(() => {
  if (!summary.value?.today.mealCount) return '今天尚未有餐食紀錄，新增後會在這裡顯示即時進度。'
  if (!summary.value.targets) return '請先完成個人資料，才能計算每日參考目標。'
  const proteinRemaining = summary.value.targets.proteinG - summary.value.today.proteinG
  return proteinRemaining > 0
    ? `蛋白質距參考目標尚差約 ${Math.round(proteinRemaining)} g。`
    : '今日蛋白質已達參考目標。'
})
</script>

<template>
  <aside class="right-insight">
    <div class="right-insight__date"><span>今日</span><b>{{ dateLabel }}</b><small>台灣時間</small></div>
    <section>
      <div
        class="radial-progress"
        :style="{ background: `conic-gradient(var(--primary) 0 ${targetProgress}%, #dfe9e5 ${targetProgress}% 100%)` }"
        :aria-label="`今日熱量目標已達成百分之${targetProgress}`"
      >
        <div><b>{{ targetProgress }}%</b><span>今日達成</span></div>
      </div>
      <p><strong>{{ remainingLabel }}</strong></p>
    </section>
    <section class="right-insight__tip">
      <span>今日飲食提醒</span>
      <p>{{ tip }}</p>
    </section>
  </aside>
</template>
