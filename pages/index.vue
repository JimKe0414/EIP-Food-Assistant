<script setup lang="ts">
import { todayMetrics } from '~/data/mock'

const { openQuickRecord } = useDietApp()

useSeoMeta({ title: '首頁｜一食之選' })
</script>

<template>
  <div class="home-page">
    <header class="home-greeting">
      <div><span>午安，歡迎回來</span><h1>今天也一起吃得<br>剛剛好</h1></div>
      <time datetime="2026-07-15">7 月 15 日・三</time>
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
