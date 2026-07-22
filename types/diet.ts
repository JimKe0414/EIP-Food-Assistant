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
  name: string
  kcal: string
  reason: string
  score: number
  protein: string
  vegetable: string
}

export interface Vendor {
  name: string
  description: string
  badge: string
  time: string
  highlight: string
  recent: string
  menus: MenuItem[]
}

export interface Profile {
  age: number
  sex: Sex
  height: number
  weight: number
  bodyFat: number | null
  muscle: number
  activity: number
}
