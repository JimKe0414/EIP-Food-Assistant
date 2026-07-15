<script setup lang="ts">
import type { Metric } from '~/types/diet'

defineProps<{ metric: Metric }>()
</script>

<template>
  <article class="metric-card">
    <div v-if="metric.icon" class="metric-card__top">
      <span aria-hidden="true">{{ metric.icon }}</span><b>{{ metric.progress }}%</b>
    </div>
    <small>{{ metric.label }}</small>
    <strong>{{ metric.value }}</strong>
    <p>{{ metric.note }}</p>
    <div class="progress" :aria-label="`${metric.label}達成 ${metric.progress}%`">
      <i :style="{ width: `${metric.progress}%` }" />
    </div>
  </article>
</template>
