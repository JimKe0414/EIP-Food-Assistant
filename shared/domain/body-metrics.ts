import { z } from 'zod'

export const profileInputSchema = z.object({
  age: z.coerce.number().int().min(18).max(100),
  sex: z.enum(['male', 'female']),
  height: z.coerce.number().min(120).max(230),
  weight: z.coerce.number().min(30).max(250),
  bodyFat: z.coerce.number().min(3).max(60).nullable().optional().default(null),
  muscle: z.coerce.number().min(10).max(80).nullable().optional().default(null),
  activity: z.coerce.number().min(1.2).max(1.9)
})

export type ProfileInput = z.infer<typeof profileInputSchema>

export function calculateBodyMetrics(input: ProfileInput) {
  const profile = profileInputSchema.parse(input)
  const heightM = profile.height / 100
  const bmi = profile.weight / heightM ** 2
  const fatMass = profile.bodyFat === null ? null : profile.weight * profile.bodyFat / 100
  const lbm = fatMass === null ? null : profile.weight - fatMass
  const bmr = lbm === null
    ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.sex === 'male' ? 5 : -161)
    : 370 + 21.6 * lbm

  return {
    bmi: round(bmi),
    bmiLabel: bmi < 18.5 ? '體重偏輕' : bmi < 24 ? '正常範圍' : bmi < 27 ? '體重偏重' : '建議留意',
    fatMass: fatMass === null ? null : round(fatMass),
    lbm: lbm === null ? null : round(lbm),
    bmr: Math.round(bmr),
    tdee: Math.round(bmr * profile.activity),
    ibw: round(22 * heightM ** 2),
    usesEstimatedBmr: lbm === null
  }
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
