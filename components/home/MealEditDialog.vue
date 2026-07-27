<script setup lang="ts">
import type { MealUpdateInput } from '~/shared/domain/meals'
import type { DashboardMeal } from '~/types/dashboard'

const props = withDefaults(defineProps<{
  open: boolean
  meal: DashboardMeal | null
  saving?: boolean
}>(), {
  saving: false
})
const emit = defineEmits<{
  close: []
  save: [input: MealUpdateInput]
}>()
const panel = ref<HTMLElement | null>(null)
const draft = reactive({
  name: '',
  mealType: 'breakfast' as DashboardMeal['mealType'],
  mealDate: '',
  mealTime: '',
  caloriesKcal: 0 as number | string,
  proteinG: null as number | string | null,
  fatG: null as number | string | null,
  carbsG: null as number | string | null,
  fiberG: null as number | string | null,
  sodiumMg: null as number | string | null,
  summary: ''
})

useFocusTrap(() => props.open, panel, () => emit('close'))

watch(() => [props.open, props.meal] as const, ([open, meal]) => {
  if (!open || !meal) return
  Object.assign(draft, {
    name: meal.name,
    mealType: meal.mealType,
    mealDate: meal.mealDate,
    mealTime: meal.mealTime.slice(0, 5),
    caloriesKcal: meal.caloriesKcal,
    proteinG: meal.proteinG,
    fatG: meal.fatG,
    carbsG: meal.carbsG,
    fiberG: meal.fiberG,
    sodiumMg: meal.sodiumMg,
    summary: meal.summary ?? ''
  })
}, { immediate: true })

function optionalNumber(value: number | string | null) {
  return value === '' || value === null ? null : Number(value)
}

function save() {
  emit('save', {
    mealDate: draft.mealDate,
    mealTime: draft.mealTime,
    mealType: draft.mealType,
    name: draft.name.trim(),
    nutrients: {
      caloriesKcal: Number(draft.caloriesKcal),
      proteinG: optionalNumber(draft.proteinG),
      fatG: optionalNumber(draft.fatG),
      carbsG: optionalNumber(draft.carbsG),
      fiberG: optionalNumber(draft.fiberG),
      sodiumMg: optionalNumber(draft.sodiumMg)
    },
    summary: draft.summary.trim() || null
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open && meal" class="modal-backdrop" @click.self="$emit('close')">
        <section ref="panel" class="profile-editor meal-editor" role="dialog" aria-modal="true" aria-labelledby="meal-editor-title">
          <header>
            <div>
              <h2 id="meal-editor-title">修改餐食</h2>
              <p>原始辨識來源與紀錄時間會保留，只更新下列用餐資料。</p>
            </div>
            <button type="button" aria-label="關閉修改餐食" :disabled="saving" @click="$emit('close')">
              <Icon name="solar:close-circle-linear" />
            </button>
          </header>
          <form @submit.prevent="save">
            <div class="form-grid">
              <label class="full">餐點名稱<input v-model="draft.name" maxlength="160" required></label>
              <label>時段<select v-model="draft.mealType"><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">點心</option></select></label>
              <label>實際用餐日期<input v-model="draft.mealDate" type="date" required></label>
              <label>實際用餐時間<input v-model="draft.mealTime" type="time" required></label>
              <label>熱量<input v-model="draft.caloriesKcal" type="number" min="0" step="0.01" required><small>kcal</small></label>
              <label>蛋白質<input v-model="draft.proteinG" type="number" min="0" step="0.01"><small>g，選填</small></label>
              <label>脂肪<input v-model="draft.fatG" type="number" min="0" step="0.01"><small>g，選填</small></label>
              <label>碳水化合物<input v-model="draft.carbsG" type="number" min="0" step="0.01"><small>g，選填</small></label>
              <label>膳食纖維<input v-model="draft.fiberG" type="number" min="0" step="0.01"><small>g，選填</small></label>
              <label>鈉<input v-model="draft.sodiumMg" type="number" min="0" step="0.01"><small>mg，選填</small></label>
              <label class="full">備註<textarea v-model="draft.summary" maxlength="500" rows="3" /></label>
            </div>
            <div class="meal-editor__actions">
              <button type="button" class="button button--secondary" :disabled="saving" @click="$emit('close')">取消</button>
              <button type="submit" class="button button--primary" :disabled="saving">{{ saving ? '儲存中…' : '儲存修改' }}</button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
