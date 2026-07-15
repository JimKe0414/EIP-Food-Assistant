<script setup lang="ts">
import type { RecordMode } from '~/types/diet'

const { quickRecordOpen, closeQuickRecord, chooseRecordMode } = useDietApp()
const panel = ref<HTMLElement | null>(null)

const choices: { mode: RecordMode, icon: string, title: string, note: string }[] = [
  { mode: 'photo', icon: 'solar:camera-linear', title: '拍照辨識', note: 'AI 自動分析' },
  { mode: 'voice', icon: 'solar:microphone-2-linear', title: '語音輸入', note: '快速說出餐點' },
  { mode: 'text', icon: 'solar:pen-new-square-linear', title: '文字輸入', note: '自行補充內容' }
]

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeQuickRecord()
  if (event.key !== 'Tab' || !panel.value) return
  const nodes = [...panel.value.querySelectorAll<HTMLElement>('button, a[href]')]
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first?.focus()
  }
}

watch(quickRecordOpen, async (open) => {
  if (!import.meta.client) return
  document.body.classList.toggle('no-scroll', open)
  if (open) {
    await nextTick()
    panel.value?.querySelector<HTMLElement>('button')?.focus()
  }
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('no-scroll')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="quickRecordOpen" class="modal-backdrop" @click.self="closeQuickRecord">
        <section ref="panel" class="quick-record" role="dialog" aria-modal="true" aria-labelledby="quick-record-title">
          <div class="sheet-handle" aria-hidden="true" />
          <button class="modal-close" type="button" aria-label="關閉" @click="closeQuickRecord">
            <Icon name="solar:close-circle-linear" />
          </button>
          <h2 id="quick-record-title">新增餐食紀錄</h2>
          <p>選擇最方便的輸入方式</p>
          <div class="quick-record__grid">
            <button v-for="choice in choices" :key="choice.mode" type="button" @click="chooseRecordMode(choice.mode)">
              <span><Icon :name="choice.icon" /></span>
              <b>{{ choice.title }}</b>
              <small>{{ choice.note }}</small>
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
