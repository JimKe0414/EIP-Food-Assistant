<script setup lang="ts">
import type { Metric } from '~/types/diet'
import type { DashboardSummary } from '~/types/dashboard'
import type { MealUpdateInput } from '~/shared/domain/meals'

const { openQuickRecord, notify } = useDietApp()
const { post } = useApi()
const { todayDate, formatCalendarDate, formatTime } = useAppDate()
const { data: summary, refresh: refreshSummary } = await useFetch<DashboardSummary>('/api/meals/summary', { key: 'meal-summary' })
const editingMeal = ref<DashboardSummary['todayMeals'][number] | null>(null)
const deletingMeal = ref<DashboardSummary['todayMeals'][number] | null>(null)
const savingEdit = ref(false)
const deleting = ref(false)

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
    { icon: '🥦', label: '蔬菜攝取', value: '—', note: '目前尚未提供蔬菜份數紀錄', progress: 0, comingSoon: true },
    { icon: '💧', label: '飲水量', value: '—', note: '目前尚未提供飲水紀錄', progress: 0, comingSoon: true }
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
  if (!totals?.mealCount) return '新增餐食後，首頁與近 7 日趨勢會自動更新。'
  if (!targets) return '完成個人資料後，系統才會顯示剩餘熱量與營養目標。'
  const proteinRemaining = Math.max(0, Math.round(targets.proteinG - totals.proteinG))
  return proteinRemaining
    ? `目前蛋白質尚差約 ${proteinRemaining} g；數值依今天已記錄的餐食加總。`
    : '今日蛋白質已達參考目標；數值依今天已記錄的餐食加總。'
})

const latestMeal = computed(() => {
  const meals = summary.value?.todayMeals ?? []
  return meals.reduce<(typeof meals)[number] | null>((latest, meal) => {
    if (!latest) return meal
    return new Date(meal.createdAt).getTime() > new Date(latest.createdAt).getTime() ? meal : latest
  }, null)
})
const mealCountDescription = computed(() => `今天已記錄 ${summary.value?.today.mealCount ?? 0} 餐`)

async function saveMeal(input: MealUpdateInput) {
  if (!editingMeal.value || savingEdit.value) return
  savingEdit.value = true
  try {
    await post(`/api/meals/${editingMeal.value.id}/update`, { ...input })
    await refreshSummary()
    editingMeal.value = null
    notify('餐食紀錄已更新')
  } catch {
    notify('修改失敗，請稍後再試')
  } finally {
    savingEdit.value = false
  }
}

async function deleteMeal() {
  if (!deletingMeal.value || deleting.value) return
  deleting.value = true
  try {
    await post(`/api/meals/${deletingMeal.value.id}/delete`, {})
    await refreshSummary()
    deletingMeal.value = null
    notify('餐食紀錄已刪除')
  } catch {
    notify('刪除失敗，請稍後再試')
  } finally {
    deleting.value = false
  }
}

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
        <SectionHeading title="今日進度" description="依今天的餐食紀錄與最新個人資料計算" to="/trend" action-label="近 7 日趨勢" />
        <div class="metric-grid">
          <MetricCard v-for="metric in todayMetrics" :key="metric.label" :metric="metric" />
        </div>
      </div>
      <WeeklyMiniChart />
    </div>

    <SectionHeading title="最新一筆紀錄" description="依記錄時間顯示" to="/record" action-label="新增" />
    <article v-if="latestMeal" class="featured-food">
      <div class="food-illustration" aria-hidden="true">🍽️</div>
      <div><h2>{{ latestMeal.name }}</h2><p>{{ latestMeal.summary || '已加入餐食紀錄' }}<br>實際用餐 {{ latestMeal.mealTime.slice(0, 5) }}・{{ Math.round(latestMeal.caloriesKcal) }} kcal</p></div>
      <time class="score" :datetime="latestMeal.createdAt">{{ formatTime(latestMeal.createdAt) }}</time>
    </article>
    <p v-else class="empty-note">今天還沒有餐食紀錄。</p>

    <SectionHeading title="今日餐食" :description="mealCountDescription" to="/record" action-label="新增" />
    <MealTimeline
      :meals="summary?.todayMeals ?? []"
      @edit="editingMeal = $event"
      @delete="deletingMeal = $event"
    />
    <MealEditDialog
      :open="Boolean(editingMeal)"
      :meal="editingMeal"
      :saving="savingEdit"
      @close="!savingEdit && (editingMeal = null)"
      @save="saveMeal"
    />
    <MealDeleteDialog
      :open="Boolean(deletingMeal)"
      :meal="deletingMeal"
      :deleting="deleting"
      @close="!deleting && (deletingMeal = null)"
      @confirm="deleteMeal"
    />
  </div>
</template>
