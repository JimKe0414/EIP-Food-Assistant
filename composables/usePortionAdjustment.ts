import type { NutrientSummary } from '~/shared/domain/ai'

// AI/資料庫算出來的 candidate.nutrients 當作「一份」基準；使用者可以用這組選項調整
// 份量倍率，因為目前還沒有「一碗/一杯精確等於幾克」的參考資料庫，讓使用者自己修正
// 比完全信任 AI 猜的份量更實際（見 FEATURE-PLAN.md 第二期）。
export const portionMultiplierOptions = [
  { value: 0.25, label: '四分之一份' },
  { value: 0.5, label: '半份' },
  { value: 1, label: '一份（AI 估計）' },
  { value: 1.5, label: '一份半' },
  { value: 2, label: '兩份' }
] as const

export function scaleNutrients(nutrients: NutrientSummary, factor: number): NutrientSummary {
  const scale = (value: number | null) => value === null ? null : Math.round(value * factor * 100) / 100
  return {
    caloriesKcal: scale(nutrients.caloriesKcal) ?? 0,
    proteinG: scale(nutrients.proteinG),
    fatG: scale(nutrients.fatG),
    carbsG: scale(nutrients.carbsG),
    fiberG: scale(nutrients.fiberG),
    sodiumMg: scale(nutrients.sodiumMg)
  }
}

export function usePortionAdjustment() {
  const multipliers = ref<Record<string, number>>({})
  // Raw text of the gram <input>, kept separate from the derived multiplier so the field
  // can hold in-progress/invalid typing without fighting the user's cursor.
  const gramsInputs = ref<Record<string, string>>({})

  function multiplierFor(name: string) {
    return multipliers.value[name] ?? 1
  }

  function setMultiplier(name: string, value: number) {
    multipliers.value[name] = value
    gramsInputs.value[name] = ''
  }

  function gramsInputFor(name: string) {
    return gramsInputs.value[name] ?? ''
  }

  // referenceGrams is candidate.estimatedGrams — what the current (pre-scale) nutrients
  // correspond to. Without it we have no basis to convert a gram amount into a multiplier.
  function setGrams(name: string, grams: string, referenceGrams: number | null) {
    gramsInputs.value[name] = grams
    const parsed = Number(grams)
    if (!referenceGrams || referenceGrams <= 0 || !Number.isFinite(parsed) || parsed <= 0) return
    multipliers.value[name] = parsed / referenceGrams
  }

  function reset() {
    multipliers.value = {}
    gramsInputs.value = {}
  }

  return { multiplierFor, setMultiplier, gramsInputFor, setGrams, reset }
}
