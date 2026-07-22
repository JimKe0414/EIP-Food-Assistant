<script setup lang="ts">
import type { Metric } from '~/types/diet'

const { openQuickRecord } = useDietApp()

const { data: summary } = await useFetch('/api/meals/summary')

const today = new Date()
const todayLabel = `${today.getMonth() + 1} 月 ${today.getDate()} 日・${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`

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
    { icon: '🥦', label: '蔬菜攝取', value: '—', note: '尚未支援蔬菜份數追蹤', progress: 0, comingSoon: true },
    { icon: '💧', label: '飲水量', value: '—', note: '尚未支援飲水量追蹤', progress: 0, comingSoon: true }
  ]
})

useSeoMeta({ title: '首頁｜一食之選' })
</script>

<template>
  <div class="home-page">
    <header class="home-greeting">
      <div><span>午安，歡迎回來</span><h1>今天也一起吃得<br>剛剛好</h1></div>
      <time :datetime="today.toISOString().slice(0, 10)">{{ todayLabel }}</time>
    </header>

    <section class="ai-hero">
      <small>AI 今日提醒</small>
      <h2>早餐蛋白質足夠，午餐建議補充蔬菜與纖維</h2>
      <p>已結合今日早餐、近 7 日飲食紀錄與 EIP 午餐菜單完成分析。</p>
      <div>
        <NuxtLink to="/recommend" class="button button--light">查看推薦</NuxtLink>
        <button type="button" class="button button--glass" @click="openQuickRecord">新增餐食</button>
      </div>
    </section>

    <div class="home-dashboard">
      <div>
        <SectionHeading title="今日進度" description="依每日目標自動計算" to="/trend" action-label="近 7 日趨勢" />
        <div class="metric-grid">
          <MetricCard v-for="metric in todayMetrics" :key="metric.label" :metric="metric" />
        </div>
      </div>
      <WeeklyMiniChart />
    </div>

    <SectionHeading title="今日首選" description="符合目標且近 7 日未重複" to="/recommend" action-label="看全部" />
    <NuxtLink class="featured-food" to="/recommend">
      <div class="food-illustration" aria-hidden="true">🥗</div>
      <div><h2>舒肥雞胸雙蔬餐盒</h2><p>綠野食堂・約 560 kcal<br>高蛋白、蔬菜充足、低油脂</p></div>
      <div class="score">92</div>
    </NuxtLink>

    <SectionHeading title="今日餐食" description="已完成 1 餐紀錄" to="/record" action-label="新增" />
    <MealTimeline />
  </div>
</template>
