import type { Profile } from '~/types/diet'
import { calculateBodyMetrics } from '~/shared/domain/body-metrics'

export function useBodyMetrics(profile: Ref<Profile>) {
  return computed(() => {
    const result = calculateBodyMetrics(profile.value)

    return {
      bmi: result.bmi.toFixed(1),
      bmiLabel: result.bmiLabel,
      fatMass: result.fatMass === null ? '未提供' : `${result.fatMass.toFixed(1)} kg`,
      lbm: result.lbm === null ? '未提供' : `${result.lbm.toFixed(1)} kg`,
      bmr: `${result.bmr.toLocaleString()} kcal`,
      tdee: `${result.tdee.toLocaleString()} kcal`,
      ibw: `${result.ibw.toFixed(1)} kg`,
      usesEstimatedBmr: result.usesEstimatedBmr
    }
  })
}
