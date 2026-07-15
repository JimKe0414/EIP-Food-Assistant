<script setup lang="ts">
import { navigation } from '~/data/navigation'

const route = useRoute()
const { openQuickRecord } = useDietApp()
const visibleItems = navigation.filter(item => item.to !== '/record')

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav class="bottom-nav" aria-label="行動版主要導覽">
    <NuxtLink
      v-for="item in visibleItems.slice(0, 2)"
      :key="item.to"
      :to="item.to"
      :class="{ active: isActive(item.to) }"
    >
      <Icon :name="item.icon" /><span>{{ item.label.replace('午餐', '') }}</span>
    </NuxtLink>
    <button type="button" class="bottom-nav__add" aria-label="新增餐食紀錄" @click="openQuickRecord">
      <span><Icon name="solar:add-circle-linear" /></span><small>記錄</small>
    </button>
    <NuxtLink
      v-for="item in visibleItems.slice(2)"
      :key="item.to"
      :to="item.to"
      :class="{ active: isActive(item.to) }"
    >
      <Icon :name="item.icon" /><span>{{ item.label.replace('營養', '') }}</span>
    </NuxtLink>
  </nav>
</template>
