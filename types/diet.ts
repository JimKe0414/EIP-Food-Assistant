export type RecordMode = 'photo' | 'voice' | 'text'
export type FoodType = 'meat' | 'veg'
export type Sex = 'male' | 'female'

export interface Metric {
  icon?: string
  label: string
  value: string
  note: string
  progress: number
  // No real tracking exists yet for this metric (e.g. water intake, vegetable servings) —
  // render it as a visibly disabled placeholder instead of a fabricated number.
  comingSoon?: boolean
}

export interface MenuItem {
  id: string
  source: 'eip' | 'custom' | 'tfda'
  name: string
  kcal: string
  reason: string
  rank: number | null
  protein: string
  vegetable: string
  nutrients: {
    caloriesKcal: number
    proteinG: number | null
    fatG: number | null
    carbsG: number | null
    fiberG: number | null
    sodiumMg: number | null
  }
}

export interface Profile {
  age: number
  sex: Sex
  height: number
  weight: number
  bodyFat: number | null
  muscle: number | null
  activity: number
}
