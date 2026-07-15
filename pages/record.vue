<script setup lang="ts">
import type { RecordMode } from '~/types/diet'
import type { MealInput } from '~/shared/domain/meals'

const { recordMode, notify } = useDietApp()
const { post } = useApi()
const { queueMeal } = useOfflineMeals()
const modes: { value: RecordMode, label: string, icon: string }[] = [
  { value: 'photo', label: '拍照', icon: 'solar:camera-linear' },
  { value: 'voice', label: '語音', icon: 'solar:microphone-2-linear' },
  { value: 'text', label: '文字', icon: 'solar:pen-new-square-linear' }
]

async function saved(payload?: MealInput) {
  if (!payload) {
    notify('候選已確認；請使用文字模式串接正式記錄，照片／語音需保持連線')
    return
  }
  try {
    if (!navigator.onLine) {
      await queueMeal(payload)
      notify('已暫存，連線後自動上傳')
    } else {
      await post('/api/meals', payload)
      const count = Number(localStorage.getItem('food:meal-count') ?? 0) + 1
      localStorage.setItem('food:meal-count', String(count))
      notify('餐食已加入今日紀錄')
    }
  } catch {
    notify('儲存失敗，請先登入或稍後再試')
  }
}

useSeoMeta({ title: '餐食記錄｜一食之選' })
</script>

<template>
  <div class="record-page">
    <PageHeading title="記錄餐食" description="所有輸入先產生候選，確認後才會寫入正式紀錄" />
    <div class="mode-tabs" role="tablist" aria-label="選擇餐食輸入方式">
      <button v-for="mode in modes" :key="mode.value" type="button" role="tab" :aria-selected="recordMode === mode.value" :class="{ active: recordMode === mode.value }" @click="recordMode = mode.value">
        <Icon :name="mode.icon" />{{ mode.label }}
      </button>
    </div>
    <PhotoRecordPanel v-if="recordMode === 'photo'" @saved="saved" />
    <VoiceRecordPanel v-else-if="recordMode === 'voice'" @saved="saved" />
    <TextRecordPanel v-else @saved="saved" />
  </div>
</template>
