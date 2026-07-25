<script setup lang="ts">
import type { Metric } from '~/types/diet'
import type { DashboardSummary } from '~/types/dashboard'

const labels = ['一', '二', '三', '四', '五', '六', '日']
const { data: summary } = await useFetch<DashboardSummary>('/api/meals/summary', { key: 'meal-summary' })

const daily = computed(() => summary.value?.daily ?? [])
const targets = computed(() => summary.value?.targets ?? null)

const calorieBars = computed(() => {
  const target = targets.value?.caloriesKcal
  if (!target) return daily.value.map(() => 0)
  return daily.value.map(day => Math.min(100, Math.round(day.caloriesKcal / target * 100)))
})

const averageCalories = computed(() => {
  if (!daily.value.length) return 0
  return Math.round(daily.value.reduce((sum, day) => sum + day.caloriesKcal, 0) / daily.value.length)
})

// Atwater factors convert grams to kcal contribution, so the donut reflects each macro's
// actual share of calories consumed this week — not just a raw gram average.
const macroShare = computed(() => {
  const totals = daily.value.reduce((sum, day) => ({
    protein: sum.protein + day.proteinG,
    fat: sum.fat + day.fatG,
    carbs: sum.carbs + day.carbsG
  }), { protein: 0, fat: 0, carbs: 0 })
  const proteinKcal = totals.protein * 4
  const fatKcal = totals.fat * 9
  const carbsKcal = totals.carbs * 4
  const total = proteinKcal + fatKcal + carbsKcal
  if (!total) return { protein: 0, fat: 0, carbs: 0 }
  return {
    protein: Math.round(proteinKcal / total * 100),
    fat: Math.round(fatKcal / total * 100),
    carbs: Math.round(carbsKcal / total * 100)
  }
})

const weeklyMetrics = computed<Metric[]>(() => {
  const proteinTarget = targets.value?.proteinG
  const avgProtein = daily.value.length ? daily.value.reduce((sum, day) => sum + day.proteinG, 0) / daily.value.length : 0
  const avgFiber = daily.value.length ? daily.value.reduce((sum, day) => sum + day.fiberG, 0) / daily.value.length : 0

  return [
    proteinTarget
      ? { label: '蛋白質', value: `${Math.round(avgProtein / proteinTarget * 100)}%`, note: `平均 ${avgProtein.toFixed(1)} g／日`, progress: Math.min(100, Math.round(avgProtein / proteinTarget * 100)) }
      : { label: '蛋白質', value: `${avgProtein.toFixed(1)} g`, note: '請先在「我的」填寫個人資料以計算目標', progress: 0 },
    { label: '膳食纖維', value: `${avgFiber.toFixed(1)} g`, note: '平均每日攝取量，尚無個人建議目標可比較', progress: 0, comingSoon: true },
    { label: '飲水量', value: '—', note: '尚未支援飲水量追蹤', progress: 0, comingSoon: true },
    { label: '蔬菜', value: '—', note: '尚未支援蔬菜份數追蹤', progress: 0, comingSoon: true }
  ]
})

useSeoMeta({ title: '營養趨勢｜一食之選' })
</script>

<template>
  <div class="trend-page">
    <PageHeading title="營養趨勢" description="掌握近 7 日飲食與營養變化">
      <button type="button" class="period-select">近 7 日 <Icon name="solar:alt-arrow-down-linear" /></button>
    </PageHeading>

    <div class="trend-grid">
      <section class="chart-card calories-chart">
        <header><div><span>每日熱量</span><h2>平均 {{ averageCalories.toLocaleString() }} kcal</h2></div><small>{{ targets ? `目標 ${targets.caloriesKcal.toLocaleString()}` : '尚未設定目標' }}</small></header>
        <div class="bars" aria-label="每日熱量佔目標百分比長條圖">
          <div v-for="(value, index) in calorieBars" :key="labels[index]" class="bar-column">
            <div><i :style="{ height: `${value}%` }"><span>{{ value }}%</span></i></div><small>{{ labels[index] }}</small>
          </div>
        </div>
      </section>

      <section class="chart-card nutrient-chart">
        <header><div><span>營養素分布</span><h2>本週平均比例</h2></div></header>
        <div
          class="donut"
          :style="{ background: `conic-gradient(var(--primary) 0 ${macroShare.protein}%, #f0b54e ${macroShare.protein}% ${macroShare.protein + macroShare.carbs}%, #79a3d6 ${macroShare.protein + macroShare.carbs}% 100%)` }"
          :aria-label="`蛋白質百分之${macroShare.protein}，碳水百分之${macroShare.carbs}，脂肪百分之${macroShare.fat}`"
        ><div><b>{{ averageCalories.toLocaleString() }}</b><span>kcal／日</span></div></div>
        <ul><li><i class="protein" />蛋白質 <b>{{ macroShare.protein }}%</b></li><li><i class="carbs" />碳水 <b>{{ macroShare.carbs }}%</b></li><li><i class="fat" />脂肪 <b>{{ macroShare.fat }}%</b></li></ul>
      </section>

      <section class="chart-card weight-chart">
        <header><div><span>體重趨勢</span><h2>尚未推出</h2></div></header>
        <p class="subnote">目前系統尚未支援每日體重記錄，僅有個人資料頁的身體數值快照。</p>
      </section>
    </div>

    <section class="score-insight">
      <div class="score-ring"><b>—</b><span>尚未推出</span></div>
      <div><span>均衡分數</span><h2>這項功能尚未推出</h2><p>目前先提供實際攝取數字，AI 綜合評分與洞察之後會再補上。</p></div>
    </section>

    <SectionHeading title="本週營養達成" description="依每日平均值計算" />
    <div class="metric-grid weekly"><MetricCard v-for="metric in weeklyMetrics" :key="metric.label" :metric="metric" /></div>
  </div>
</template>
