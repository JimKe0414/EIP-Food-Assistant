<script setup lang="ts">
import type { Metric } from '~/types/diet'
import type { DashboardSummary } from '~/types/dashboard'

const { openQuickRecord } = useDietApp()
const { todayDate, formatCalendarDate, formatTime } = useAppDate()
const { data: summary } = await useFetch<DashboardSummary>('/api/meals/summary', { key: 'meal-summary' })

const today = todayDate()
const todayLabel = formatCalendarDate(today)

const todayMetrics = computed<Metric[]>(() => {
  const totals = summary.value?.today
  const targets = summary.value?.targets
  const calories = totals?.caloriesKcal ?? 0
  const protein = totals?.proteinG ?? 0

  return [
    {
      icon: '🔥',
      label: '已攝取熱量',
      value: `${Math.round(calories)} kcal`,
      note: targets ? `目標 ${targets.caloriesKcal.toLocaleString()} kcal` : '請先在「我的」填寫個人資料以計算目標',
      progress: targets ? Math.min(100, Math.round(calories / targets.caloriesKcal * 100)) : 0
    },
    {
      icon: '💪',
      label: '蛋白質',
      value: `${Math.round(protein)} g`,
      note: targets ? `目標 ${targets.proteinG} g` : '請先在「我的」填寫個人資料以計算目標',
      progress: targets ? Math.min(100, Math.round(protein / targets.proteinG * 100)) : 0
    },
    { icon: '🥦', label: '蔬菜攝取', value: '—', note: 'DB 尚無蔬菜份數欄位', progress: 0, comingSoon: true },
    { icon: '💧', label: '飲水量', value: '—', note: 'DB 尚無飲水紀錄欄位', progress: 0, comingSoon: true }
  ]
})

const reminderTitle = computed(() => {
  const totals = summary.value?.today
  const targets = summary.value?.targets
  if (!totals?.mealCount) return '今天尚未有餐食紀錄'
  if (!targets) return `今天已記錄 ${totals.mealCount} 餐，共 ${Math.round(totals.caloriesKcal)} kcal`
  const remaining = targets.caloriesKcal - totals.caloriesKcal
  return remaining >= 0
    ? `今天已記錄 ${totals.mealCount} 餐，距目標還有 ${Math.round(remaining)} kcal`
    : `今天已記錄 ${totals.mealCount} 餐，已超過參考目標 ${Math.round(Math.abs(remaining))} kcal`
})

const reminderDescription = computed(() => {
  const totals = summary.value?.today
  const targets = summary.value?.targets
  if (!totals?.mealCount) return '新增餐食後，首頁與近 7 日趨勢會直接從 DB 重新彙總。'
  if (!targets) return '建立個人資料快照後，系統才會顯示剩餘熱量與營養目標。'
  const proteinRemaining = Math.max(0, Math.round(targets.proteinG - totals.proteinG))
  return proteinRemaining
    ? `目前蛋白質尚差約 ${proteinRemaining} g；數值依 DB 中今日餐食加總。`
    : '今日蛋白質已達參考目標；數值依 DB 中今日餐食加總。'
})

const latestMeal = computed(() => summary.value?.todayMeals[0] ?? null)
const mealCountDescription = computed(() => `DB 中已完成 ${summary.value?.today.mealCount ?? 0} 餐紀錄`)

useSeoMeta({ title: '首頁｜一食之選' })
</script>

<template>
  <div class="home-page">
    <header class="home-greeting">
      <div><span>歡迎回來</span><h1>今天也一起吃得<br>剛剛好</h1></div>
      <time :datetime="today">{{ todayLabel }}</time>
    </header>

    <section class="ai-hero">
      <small>今日紀錄摘要</small>
      <h2>{{ reminderTitle }}</h2>
      <p>{{ reminderDescription }}</p>
      <div>
        <NuxtLink to="/recommend" class="button button--light">查看推薦</NuxtLink>
        <button type="button" class="button button--glass" @click="openQuickRecord">新增餐食</button>
      </div>
    </section>

    <div class="home-dashboard">
      <div>
        <SectionHeading title="今日進度" description="由 DB 餐食紀錄與最新個人快照計算" to="/trend" action-label="近 7 日趨勢" />
        <div class="metric-grid">
          <MetricCard v-for="metric in todayMetrics" :key="metric.label" :metric="metric" />
        </div>
      </div>
      <WeeklyMiniChart />
    </div>

    <SectionHeading title="最新一筆紀錄" description="依實際寫入時間顯示" to="/record" action-label="新增" />
    <article v-if="latestMeal" class="featured-food">
      <div class="food-illustration" aria-hidden="true">🍽️</div>
      <div><h2>{{ latestMeal.name }}</h2><p>{{ latestMeal.summary || '已寫入餐食資料庫' }}<br>{{ Math.round(latestMeal.caloriesKcal) }} kcal</p></div>
      <time class="score" :datetime="latestMeal.createdAt">{{ formatTime(latestMeal.createdAt) }}</time>
    </article>
    <p v-else class="empty-note">今天尚未寫入任何餐食，不顯示預設餐點。</p>

    <SectionHeading title="今日餐食" :description="mealCountDescription" to="/record" action-label="新增" />
    <MealTimeline :meals="summary?.todayMeals ?? []" />
  </div>
</template>
