<script setup lang="ts">
import type { Profile } from '~/types/diet'

const props = defineProps<{ open: boolean, profile: Profile | null }>()
const emit = defineEmits<{ close: [], save: [profile: Profile] }>()
const draft = reactive({
  age: null as number | null,
  sex: 'male' as Profile['sex'],
  height: null as number | null,
  weight: null as number | null,
  bodyFat: null as number | null,
  muscle: null as number | null,
  activity: 1.2
})
const panel = ref<HTMLElement | null>(null)
useFocusTrap(() => props.open, panel, () => emit('close'))

watch(() => props.open, (open) => {
  if (open) Object.assign(draft, props.profile ?? {
    age: null,
    sex: 'male',
    height: null,
    weight: null,
    bodyFat: null,
    muscle: null,
    activity: 1.2
  })
})

function save() {
  if (draft.age === null || draft.height === null || draft.weight === null) return
  emit('save', {
    age: Number(draft.age),
    sex: draft.sex,
    height: Number(draft.height),
    weight: Number(draft.weight),
    bodyFat: draft.bodyFat === null ? null : Number(draft.bodyFat),
    muscle: draft.muscle === null ? null : Number(draft.muscle),
    activity: Number(draft.activity)
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
        <section ref="panel" class="profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
          <header><div><h2 id="profile-editor-title">編輯個人紀錄</h2><p>儲存後會重新計算身體指標；結果僅供日常健康管理參考。</p></div><button type="button" aria-label="關閉" @click="$emit('close')"><Icon name="solar:close-circle-linear" /></button></header>
          <form @submit.prevent="save">
            <div class="form-grid">
              <label>年齡<input v-model.number="draft.age" type="number" min="18" max="100" required><small>單位：歲</small></label>
              <label>生理性別<select v-model="draft.sex"><option value="male">男性</option><option value="female">女性</option></select><small>僅在未提供體脂率時用於 BMR 估算</small></label>
              <label>身高<input v-model.number="draft.height" type="number" min="120" max="230" step="0.1" required><small>單位：cm</small></label>
              <label>體重<input v-model.number="draft.weight" type="number" min="30" max="250" step="0.1" required><small>單位：kg</small></label>
              <label>體脂率（選填）<input v-model.number="draft.bodyFat" type="number" min="3" max="60" step="0.1"><small>留空時改用估算 BMR，精度較低</small></label>
              <label>骨骼肌量（選填）<input v-model.number="draft.muscle" type="number" min="10" max="80" step="0.1"><small>單位：kg</small></label>
              <label class="full">日常活動量<select v-model.number="draft.activity"><option :value="1.2">久坐為主－幾乎沒有運動</option><option :value="1.375">輕度活動－每週運動 1～3 天</option><option :value="1.55">中度活動－每週運動 3～5 天</option><option :value="1.725">高度活動－每週運動 6～7 天</option></select></label>
            </div>
            <div class="profile-editor__actions"><button type="button" class="button button--secondary" @click="$emit('close')">取消</button><button class="button button--primary" type="submit">儲存並重新計算</button></div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
