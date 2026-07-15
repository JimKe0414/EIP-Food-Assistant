import type { FoodType, Metric, Vendor } from '~/types/diet'

export const todayMetrics: Metric[] = [
  { icon: '🔥', label: '已攝取熱量', value: '518 kcal', note: '目標 1,920 kcal', progress: 27 },
  { icon: '💪', label: '蛋白質', value: '31 g', note: '目標 92 g', progress: 34 },
  { icon: '🥦', label: '蔬菜攝取', value: '1.2 份', note: '建議至少 3 份', progress: 40 },
  { icon: '💧', label: '飲水量', value: '750 ml', note: '目標 2,000 ml', progress: 38 }
]

export const weeklyMetrics: Metric[] = [
  { label: '蛋白質', value: '86%', note: '平均 79 g／日', progress: 86 },
  { label: '膳食纖維', value: '61%', note: '平均 18 g／日', progress: 61 },
  { label: '飲水量', value: '72%', note: '平均 1,440 ml', progress: 72 },
  { label: '蔬菜', value: '67%', note: '平均 2.0 份／日', progress: 67 }
]

export const vendors: Record<FoodType, Vendor> = {
  meat: {
    name: '好饗廚房',
    description: '本日葷食店家，提供均衡主餐與熱食便當，適合一般上班日午餐選擇。',
    badge: '葷食店家',
    time: '11:30－13:30',
    highlight: '蛋白質選項完整',
    recent: '近 7 日曾點 1 次',
    menus: [
      { name: '舒肥雞胸雙蔬餐盒', kcal: '約 560 kcal', reason: '高蛋白、蔬菜充足，近 7 日未重複', score: 92, protein: '36 g', vegetable: '2.3 份' },
      { name: '香草烤鯖魚便當', kcal: '約 610 kcal', reason: '富含好油脂，搭配兩份時蔬', score: 88, protein: '32 g', vegetable: '2.0 份' },
      { name: '日式壽喜牛肉餐盒', kcal: '約 680 kcal', reason: '口味滿足，建議飯量減半', score: 81, protein: '29 g', vegetable: '1.7 份' }
    ]
  },
  veg: {
    name: '日光蔬房',
    description: '本日素食店家，以原型食物與多樣蔬菜搭配，提供輕盈且有飽足感的午餐。',
    badge: '素食店家',
    time: '11:20－13:20',
    highlight: '膳食纖維充足',
    recent: '近 7 日尚未點選',
    menus: [
      { name: '香煎豆腐五色餐盒', kcal: '約 520 kcal', reason: '豆類蛋白與多色蔬菜搭配完整', score: 94, protein: '24 g', vegetable: '2.8 份' },
      { name: '鷹嘴豆咖哩糙米飯', kcal: '約 590 kcal', reason: '纖維充足，飽足感佳', score: 89, protein: '20 g', vegetable: '2.4 份' },
      { name: '野菇時蔬蕎麥麵', kcal: '約 480 kcal', reason: '清爽低油，補足今日蔬菜', score: 86, protein: '18 g', vegetable: '2.6 份' }
    ]
  }
}

export const trendBars = [68, 82, 74, 91, 79, 70, 38]
