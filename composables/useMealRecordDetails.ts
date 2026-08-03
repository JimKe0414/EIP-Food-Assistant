import type { MealInput } from '~/shared/domain/meals'

const mealTypes: MealInput['mealType'][] = ['breakfast', 'lunch', 'dinner', 'snack']

export function useMealRecordDetails() {
  const route = useRoute()
  const { nowDateTimeLocal } = useAppDate()
  const eatenAt = ref(nowDateTimeLocal())
  const requestedMealType = Array.isArray(route.query.meal) ? route.query.meal[0] : route.query.meal
  const mealType = ref<MealInput['mealType']>(
    mealTypes.includes(requestedMealType as MealInput['mealType'])
      ? requestedMealType as MealInput['mealType']
      : inferMealType(eatenAt.value)
  )

  const mealDate = computed(() => eatenAt.value.slice(0, 10))
  const mealTime = computed(() => eatenAt.value.slice(11, 16))

  return { mealType, eatenAt, mealDate, mealTime }
}

function inferMealType(dateTimeLocal: string): MealInput['mealType'] {
  const hour = Number(dateTimeLocal.slice(11, 13))
  if (hour >= 5 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 16) return 'lunch'
  if (hour >= 16 && hour < 22) return 'dinner'
  return 'snack'
}
