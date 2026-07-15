<script setup lang="ts">
import { trendBars } from '~/data/mock'
</script>

<template>
  <section class="weekly-mini-chart">
    <div><h2>近 7 日熱量</h2><span>平均 1,836 kcal</span></div>
    <div class="mini-bars" aria-label="近七日熱量介於目標的百分之三十八至九十一">
      <i v-for="(value, index) in trendBars" :key="index" :style="{ height: `${value}%` }" />
    </div>
    <NuxtLink to="/trend">查看完整營養趨勢 <Icon name="solar:arrow-right-linear" /></NuxtLink>
  </section>
</template>
