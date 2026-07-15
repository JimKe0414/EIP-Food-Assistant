<script setup lang="ts">
defineProps<{ title: string, description?: string, to?: string, actionLabel?: string }>()
</script>

<template>
  <div class="section-heading">
    <div><h2>{{ title }}</h2><p v-if="description">{{ description }}</p></div>
    <NuxtLink v-if="to" :to="to">{{ actionLabel }}</NuxtLink>
    <slot />
  </div>
</template>
