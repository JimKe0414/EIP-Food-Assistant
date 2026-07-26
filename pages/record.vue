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
    notify('這項餐點已確認。若要儲存紀錄，請改用文字輸入；照片和語音功能需要保持網路連線。')
    return
  }
  try {
    const persistedPayload: MealInput = {
      ...payload,
      clientRequestId: payload.clientRequestId ?? crypto.randomUUID()
    }
    if (!navigator.onLine) {
      await queueMeal(persistedPayload)
      notify('已暫存，連線後自動上傳')
    } else {
      await post('/api/meals', persistedPayload)
      notify(payload.summary ? `餐食已加入今日紀錄：${payload.summary}` : '餐食已加入今日紀錄')
      await refreshNuxtData('meal-summary')
    }
  } catch {
    notify('儲存失敗，請先登入或稍後再試')
  }
}

useSeoMeta({ title: '餐食記錄｜一食之選' })
</script>

<template>
  <div class="record-page">
    <PageHeading title="記錄餐食" description="輸入或辨識餐點後，請確認內容再儲存。" />
    <div class="mode-tabs" role="tablist" aria-label="選擇餐食輸入方式">
      <button v-for="mode in modes" :key="mode.value" type="button" role="tab" :aria-selected="recordMode === mode.value" :class="{ active: recordMode === mode.value }" @click="recordMode = mode.value">
        <Icon :name="mode.icon" />{{ mode.label }}
      </button>
    </div>
    <Transition name="panel" mode="out-in">
      <PhotoRecordPanel v-if="recordMode === 'photo'" key="photo" @saved="saved" />
      <VoiceRecordPanel v-else-if="recordMode === 'voice'" key="voice" @saved="saved" />
      <TextRecordPanel v-else key="text" @saved="saved" />
    </Transition>
  </div>
</template>
