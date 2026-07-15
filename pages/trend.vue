<script setup lang="ts">
import { trendBars, weeklyMetrics } from '~/data/mock'

const labels = ['一', '二', '三', '四', '五', '六', '日']
useSeoMeta({ title: '營養趨勢｜一食之選' })
</script>

<template>
  <div class="trend-page">
    <PageHeading title="營養趨勢" description="掌握近 7 日飲食與營養變化">
      <button type="button" class="period-select">近 7 日 <Icon name="solar:alt-arrow-down-linear" /></button>
    </PageHeading>

    <div class="trend-grid">
      <section class="chart-card calories-chart">
        <header><div><span>每日熱量</span><h2>平均 1,836 kcal</h2></div><small>目標 1,920</small></header>
        <div class="bars" aria-label="每日熱量長條圖，週四最高，週日目前最低">
          <div v-for="(value, index) in trendBars" :key="labels[index]" class="bar-column">
            <div><i :style="{ height: `${value}%` }"><span>{{ value }}%</span></i></div><small>{{ labels[index] }}</small>
          </div>
        </div>
      </section>

      <section class="chart-card nutrient-chart">
        <header><div><span>營養素分布</span><h2>本週平均比例</h2></div></header>
        <div class="donut" aria-label="蛋白質百分之二十八，碳水百分之四十七，脂肪百分之二十五"><div><b>1,836</b><span>kcal／日</span></div></div>
        <ul><li><i class="protein" />蛋白質 <b>28%</b></li><li><i class="carbs" />碳水 <b>47%</b></li><li><i class="fat" />脂肪 <b>25%</b></li></ul>
      </section>

      <section class="chart-card weight-chart">
        <header><div><span>體重趨勢</span><h2>本月 −0.6 kg</h2></div><small>目前 68.2 kg</small></header>
        <svg viewBox="0 0 300 150" role="img" aria-label="本月體重由六十八點八公斤緩降至六十八點二公斤">
          <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#16866a" stop-opacity=".28"/><stop offset="1" stop-color="#16866a" stop-opacity="0"/></linearGradient></defs>
          <path d="M10,42 C55,50 67,60 105,65 S165,84 195,90 S250,104 290,112 L290,145 L10,145 Z" fill="url(#area)" />
          <path d="M10,42 C55,50 67,60 105,65 S165,84 195,90 S250,104 290,112" fill="none" stroke="#16866a" stroke-width="4" stroke-linecap="round" />
        </svg>
      </section>
    </div>

    <section class="score-insight">
      <div class="score-ring"><b>78</b><span>均衡分數</span></div>
      <div><span>本週表現良好</span><h2>熱量控制穩定，蛋白質平均達成 86%</h2><p>蔬菜與飲水量仍有進步空間。晚餐可沿用午餐的「一份主蛋白＋兩份蔬菜」組合。</p></div>
    </section>

    <SectionHeading title="本週營養達成" description="依每日平均值計算" />
    <div class="metric-grid weekly"><MetricCard v-for="metric in weeklyMetrics" :key="metric.label" :metric="metric" /></div>
  </div>
</template>
