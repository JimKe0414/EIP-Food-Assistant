<script setup lang="ts">
import type { Profile } from '~/types/diet'

const props = defineProps<{ profile: Profile }>()
const profileRef = computed(() => props.profile)
const metrics = useBodyMetrics(profileRef)

const items = computed(() => [
  { name: '身體質量指數（BMI）', description: '體重（kg）÷ 身高（m）²', value: metrics.value.bmi, note: metrics.value.bmiLabel },
  { name: '體脂肪重量', description: '體重 × 體脂率', value: metrics.value.fatMass, note: 'Fat Mass' },
  { name: '除脂體重（LBM）', description: '體重 − 體脂肪重量', value: metrics.value.lbm, note: 'Lean Body Mass' },
  { name: '基礎代謝率（BMR）', description: metrics.value.usesEstimatedBmr ? '未提供體脂率，使用 Mifflin-St Jeor 估算' : '370 + 21.6 × 除脂體重', value: metrics.value.bmr, note: metrics.value.usesEstimatedBmr ? '估算值，精度較低' : 'Katch-McArdle' },
  { name: '每日總消耗熱量（TDEE）', description: 'BMR × 活動量係數', value: metrics.value.tdee, note: '每日參考熱量' },
  { name: '理想體重（IBW）', description: '22 × 身高（m）²', value: metrics.value.ibw, note: 'Ideal Body Weight' }
])
</script>

<template>
  <div class="indicator-list">
    <article v-for="item in items" :key="item.name">
      <div><b>{{ item.name }}</b><span>{{ item.description }}</span></div>
      <div><strong>{{ item.value }}</strong><small>{{ item.note }}</small></div>
    </article>
  </div>
</template>
