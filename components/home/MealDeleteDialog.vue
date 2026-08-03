<script setup lang="ts">
import type { DashboardMeal } from '~/types/dashboard'

const props = withDefaults(defineProps<{
  open: boolean
  meal: DashboardMeal | null
  deleting?: boolean
}>(), {
  deleting: false
})
const emit = defineEmits<{
  close: []
  confirm: []
}>()
const panel = ref<HTMLElement | null>(null)

useFocusTrap(() => props.open, panel, () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open && meal" class="modal-backdrop" @click.self="$emit('close')">
        <section ref="panel" class="confirm-dialog meal-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="meal-delete-title" aria-describedby="meal-delete-description">
          <div class="confirm-dialog__icon"><Icon name="solar:trash-bin-trash-linear" /></div>
          <h2 id="meal-delete-title">刪除餐食紀錄？</h2>
          <p id="meal-delete-description">「<b>{{ meal.name }}</b>」刪除後，首頁與趨勢統計會立即重新計算。</p>
          <aside>此動作無法復原；不會影響原始 EIP 訂餐資料或餐點目錄。</aside>
          <div>
            <button type="button" class="button button--secondary" :disabled="deleting" @click="$emit('close')">保留紀錄</button>
            <button type="button" class="button button--danger" :disabled="deleting" @click="$emit('confirm')">{{ deleting ? '刪除中…' : '確認刪除' }}</button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
