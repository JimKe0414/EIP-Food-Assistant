<script setup lang="ts">
import type { MenuItem } from '~/types/diet'

const props = withDefaults(defineProps<{ open: boolean, item: MenuItem | null, saving?: boolean }>(), {
  saving: false
})
const emit = defineEmits<{ close: [], confirm: [] }>()
const panel = ref<HTMLElement | null>(null)
useFocusTrap(() => props.open, panel, () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open && item" class="modal-backdrop" @click.self="$emit('close')">
        <section ref="panel" class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="confirm-dialog__icon"><Icon name="solar:check-circle-linear" /></div>
          <h2 id="confirm-title">確認午餐選擇</h2>
          <p>要將「<b>{{ item.name }}</b>」記錄為本日午餐嗎？</p>
          <ul><li>{{ item.kcal }}</li><li>蛋白質 {{ item.protein }}</li><li>蔬菜 {{ item.vegetable }}</li></ul>
          <aside>一食之選只負責推薦與記錄；正式點餐請依 EIP 當日公告的截止時間完成。</aside>
          <div><button type="button" class="button button--secondary" :disabled="saving" @click="$emit('close')">再看看</button><button type="button" class="button button--primary" :disabled="saving" @click="$emit('confirm')">{{ saving ? '記錄中…' : '確認選擇' }}</button></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
