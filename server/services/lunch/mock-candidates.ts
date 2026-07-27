import type { LunchCandidateContext, LunchFoodType } from '~/shared/domain/ai'

const mockLunchCandidatesByFoodType: Record<LunchFoodType, LunchCandidateContext[]> = {
  meat: [
    { id: 'mock:chicken', source: 'mock', name: '烤雞胸藜麥餐盒', caloriesKcal: 520, proteinG: 42, fatG: 14, carbsG: 56 },
    { id: 'mock:beef', source: 'mock', name: '黑胡椒牛肉便當', caloriesKcal: 760, proteinG: 33, fatG: 31, carbsG: 82 },
    { id: 'mock:salmon', source: 'mock', name: '味噌鮭魚糙米餐', caloriesKcal: 610, proteinG: 36, fatG: 22, carbsG: 65 }
  ],
  veg: [
    { id: 'mock:tofu', source: 'mock', name: '香煎豆腐五色餐盒', caloriesKcal: 520, proteinG: 24, fatG: 16, carbsG: 70 },
    { id: 'mock:chickpea', source: 'mock', name: '鷹嘴豆咖哩糙米飯', caloriesKcal: 590, proteinG: 20, fatG: 17, carbsG: 88 },
    { id: 'mock:mushroom-soba', source: 'mock', name: '野菇時蔬蕎麥麵', caloriesKcal: 480, proteinG: 18, fatG: 12, carbsG: 76 }
  ]
}

export function getMockLunchCandidates(foodType: LunchFoodType) {
  return mockLunchCandidatesByFoodType[foodType]
}
