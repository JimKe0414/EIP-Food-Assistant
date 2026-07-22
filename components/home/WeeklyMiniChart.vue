<script setup lang="ts">
const { data: summary } = await useFetch('/api/meals/summary')

const bars = computed(() => {
  const daily = summary.value?.daily ?? []
  const target = summary.value?.targets?.caloriesKcal
  if (!target) return daily.map(() => 0)
  return daily.map(day => Math.min(100, Math.round(day.caloriesKcal / target * 100)))
})

const average = computed(() => {
  const daily = summary.value?.daily ?? []
  if (!daily.length) return 0
  return Math.round(daily.reduce((sum, day) => sum + day.caloriesKcal, 0) / daily.length)
})
</script>

<template>
  <section class="weekly-mini-chart">
    <div><h2>近 7 日熱量</h2><span>平均 {{ average.toLocaleString() }} kcal</span></div>
    <div class="mini-bars" :aria-label="`近七日熱量佔每日目標的百分比：${bars.join('、')}`">
      <i v-for="(value, index) in bars" :key="index" :style="{ height: `${value}%` }" />
    </div>
    <NuxtLink to="/trend">查看完整營養趨勢 <Icon name="solar:arrow-right-linear" /></NuxtLink>
  </section>
</template>
