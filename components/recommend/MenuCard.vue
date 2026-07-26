<script setup lang="ts">
import type { MenuItem } from '~/types/diet'

defineProps<{ item: MenuItem, selected: boolean }>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button type="button" class="menu-card" :class="{ selected }" @click="$emit('select')">
    <div class="menu-card__top"><span>{{ item.rank === null ? '菜單餐點' : '推薦餐點' }}</span><strong>{{ item.rank === null ? '—' : `#${item.rank}` }}<small>{{ item.rank === null ? '等待推薦' : '推薦順位' }}</small></strong></div>
    <small v-if="item.restaurantName" class="menu-card__restaurant">{{ item.restaurantName }}</small>
    <h3>{{ item.name }}</h3>
    <p>{{ item.kcal }}・{{ item.reason }}</p>
    <dl><div><dt>蛋白質</dt><dd>{{ item.protein }}</dd></div><div><dt>蔬菜量</dt><dd>{{ item.vegetable }}</dd></div></dl>
    <span class="menu-card__action"><Icon :name="selected ? 'solar:check-circle-bold' : 'solar:add-circle-linear'" /> {{ selected ? '已選擇' : '選擇餐點' }}</span>
  </button>
</template>
