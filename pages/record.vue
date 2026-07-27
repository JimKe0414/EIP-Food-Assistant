<script setup lang="ts">
import type { RecordMode } from '~/types/diet'
import type { MealInput } from '~/shared/domain/meals'

const { recordMode, notify } = useDietApp()
const { post } = useApi()
const { queueMeal } = useOfflineMeals()
const { mealType, eatenAt, mealDate, mealTime } = useMealRecordDetails()
const modes: { value: RecordMode, label: string, icon: string }[] = [
  { value: 'photo', label: '拍照', icon: 'solar:camera-linear' },
  { value: 'voice', label: '語音', icon: 'solar:microphone-2-linear' },
  { value: 'text', label: '文字', icon: 'solar:pen-new-square-linear' }
]

async function saved(payloads?: MealInput[], onSuccess?: () => void) {
  if (!payloads?.length) {
    notify('沒有選擇可儲存的餐點')
    return
  }
  try {
    const persistedPayloads = payloads.map(payload => ({
      ...payload,
      clientRequestId: payload.clientRequestId ?? crypto.randomUUID()
    }))
    if (!navigator.onLine) {
      for (const payload of persistedPayloads) await queueMeal(payload)
      notify(`已暫存 ${persistedPayloads.length} 個餐點，連線後自動上傳`)
    } else {
      await post('/api/meals/batch', { meals: persistedPayloads })
      notify(`已儲存 ${persistedPayloads.length} 個餐點`)
      await refreshNuxtData('meal-summary')
    }
    onSuccess?.()
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
    <MealRecordDetails v-model:meal-type="mealType" v-model:eaten-at="eatenAt" />
    <Transition name="panel" mode="out-in">
      <PhotoRecordPanel v-if="recordMode === 'photo'" key="photo" :meal-type="mealType" :meal-date="mealDate" :meal-time="mealTime" @saved="saved" />
      <VoiceRecordPanel v-else-if="recordMode === 'voice'" key="voice" :meal-type="mealType" :meal-date="mealDate" :meal-time="mealTime" @saved="saved" />
      <TextRecordPanel v-else key="text" :meal-type="mealType" :meal-date="mealDate" :meal-time="mealTime" @saved="saved" />
    </Transition>
  </div>
</template>
