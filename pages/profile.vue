<script setup lang="ts">
import type { Profile } from '~/types/diet'

const { profile, goal, goalDescription, notify } = useDietApp()
const { post } = useApi()
const editorOpen = ref(false)
const selectedGoal = ref(goal.value)
const reminderEnabled = ref(true)

const sexLabel = computed(() => profile.value.sex === 'male' ? '男性' : '女性')
const activityLabel = computed(() => ({
  1.2: '久坐為主－幾乎沒有運動',
  1.375: '輕度活動－每週運動 1～3 天',
  1.55: '中度活動－每週運動 3～5 天',
  1.725: '高度活動－每週運動 6～7 天'
}[profile.value.activity] ?? '自訂活動量'))

const basics = computed(() => [
  ['年齡', `${profile.value.age} 歲`],
  ['生理性別', sexLabel.value],
  ['身高', `${profile.value.height} cm`],
  ['體重', `${profile.value.weight} kg`],
  ['體脂率', profile.value.bodyFat === null ? '未提供' : `${profile.value.bodyFat} %`],
  ['日常活動量', activityLabel.value]
])

async function saveProfile(value: Profile) {
  try {
    await post('/api/profile', value)
    profile.value = value
    editorOpen.value = false
    notify('個人資料與身體指標快照已儲存')
  } catch {
    notify('儲存失敗，請先登入或稍後再試')
  }
}

function saveGoal() {
  goal.value = selectedGoal.value
  notify('健康目標已更新')
}

useSeoMeta({ title: '我的｜一食之選' })
</script>

<template>
  <div class="profile-page">
    <PageHeading title="我的" description="管理個人資料、健康目標與提醒設定" />
    <section class="profile-hero"><div class="profile-photo">我</div><div><h2>Workspace 使用者</h2><p>登入識別以 HMAC 匿名保存</p><div><span>健康目標：{{ goal }}</span><span>{{ activityLabel }}</span></div></div></section>

    <div class="profile-columns">
      <section class="profile-card">
        <header><div><h2>基本資料</h2><p>用於估算每日營養與熱量需求</p></div><button type="button" class="button button--soft button--small" @click="editorOpen = true"><Icon name="solar:pen-linear" /> 編輯</button></header>
        <dl class="basic-grid"><div v-for="item in basics" :key="item[0]"><dt>{{ item[0] }}</dt><dd>{{ item[1] }}</dd></div></dl>
      </section>

      <section class="profile-card metrics-card">
        <header><div><h2>個人身體指標</h2><p>依目前個人資料自動推估</p></div></header>
        <BodyMetrics :profile="profile" />
      </section>
    </div>

    <SectionHeading id="goal" title="偏好設定" description="調整推薦邏輯與提醒偏好" />
    <section class="settings-panel">
      <div class="setting-block">
        <div class="setting-icon"><Icon name="solar:target-linear" /></div>
        <div><h3>健康目標</h3><p>{{ goalDescription }}</p></div>
        <select v-model="selectedGoal" aria-label="健康目標" @change="saveGoal"><option>均衡飲食</option><option>對自己好點</option><option>健康樂活</option></select>
      </div>
      <div class="setting-block">
        <div class="setting-icon"><Icon name="solar:bell-linear" /></div>
        <div><h3>用餐提醒</h3><p>早餐 08:30、午餐 12:00、晚餐 18:30；EIP 點餐 09:00</p></div>
        <label class="switch"><input v-model="reminderEnabled" type="checkbox" aria-label="啟用用餐提醒"><span /></label>
      </div>
    </section>
    <ProfileEditor :open="editorOpen" :profile="profile" @close="editorOpen = false" @save="saveProfile" />
  </div>
</template>
