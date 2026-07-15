<script setup lang="ts">
import type { MenuItem } from '~/types/diet'

const props = defineProps<{ open: boolean, item: MenuItem | null }>()
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
          <aside>一食之選只負責推薦與記錄，請記得於 <b>9:30 前</b>進入 EIP 4.0 完成正式點餐。</aside>
          <div><button type="button" class="button button--secondary" @click="$emit('close')">再看看</button><button type="button" class="button button--primary" @click="$emit('confirm')">確認選擇</button></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
