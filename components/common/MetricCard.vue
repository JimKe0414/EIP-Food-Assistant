<script setup lang="ts">
import type { Metric } from '~/types/diet'

defineProps<{ metric: Metric }>()
</script>

<template>
  <article class="metric-card" :class="{ 'metric-card--soon': metric.comingSoon }">
    <div v-if="metric.icon" class="metric-card__top">
      <span aria-hidden="true">{{ metric.icon }}</span>
      <b v-if="metric.comingSoon">尚未推出</b>
      <b v-else>{{ metric.progress }}%</b>
    </div>
    <small>{{ metric.label }}</small>
    <strong>{{ metric.value }}</strong>
    <p>{{ metric.note }}</p>
    <div v-if="!metric.comingSoon" class="progress" :aria-label="`${metric.label}達成 ${metric.progress}%`">
      <i :style="{ width: `${metric.progress}%` }" />
    </div>
  </article>
</template>
