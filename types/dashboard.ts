export interface DashboardMeal {
  id: string
  mealDate: string
  mealTime: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  source: 'manual' | 'photo' | 'voice' | 'eip' | 'custom' | 'tfda'
  name: string
  caloriesKcal: number
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
  fiberG: number | null
  sodiumMg: number | null
  confidence: number | null
  summary: string | null
  createdAt: string
}

export interface DashboardSummary {
  today: DailyNutrition
  daily: DailyNutrition[]
  targets: {
    caloriesKcal: number
    proteinG: number
    fatG: number
    carbsG: number
  } | null
  totalMealCount: number
  todayMeals: DashboardMeal[]
}

export interface DailyNutrition {
  date: string
  caloriesKcal: number
  proteinG: number
  fatG: number
  carbsG: number
  fiberG: number
  sodiumMg: number
  mealCount: number
}
