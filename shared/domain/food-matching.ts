export interface FoodMatchCandidate {
  id: string
  name: string
  aliases?: string | null
}

const synonymGroups = [
  ['番茄', '蕃茄', '西紅柿'],
  ['馬鈴薯', '洋芋', '土豆'],
  ['花椰菜', '椰菜花', '菜花'],
  ['地瓜', '甘藷', '番薯']
]

export function findBestFoodMatch(query: string, candidates: FoodMatchCandidate[]) {
  const normalizedQuery = normalizeFoodName(query)
  const scored = candidates.map(candidate => {
    const names = [candidate.name, ...(candidate.aliases?.split(/[、,，;/]/) ?? [])]
    const score = Math.max(...names.map(name => similarity(normalizedQuery, normalizeFoodName(name))))
    return { candidate, score }
  }).sort((left, right) => right.score - left.score)
  return scored[0] && scored[0].score >= 0.45 ? scored[0] : null
}

export function convertToGrams(amount: number, unit: string, gramsPerServing?: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be positive')
  const normalized = unit.trim().toLowerCase()
  if (normalized === 'g' || normalized === '公克' || normalized === '克') return amount
  if (normalized === 'kg' || normalized === '公斤') return amount * 1000
  if (normalized === 'mg' || normalized === '毫克') return amount / 1000
  if (['份', 'serving', 'servings'].includes(normalized) && gramsPerServing) return amount * gramsPerServing
  throw new Error(`Unsupported food unit: ${unit}`)
}

export function normalizeFoodName(value: string) {
  let normalized = value.normalize('NFKC').toLowerCase().replace(/[\s\-_()（）]/g, '')
  for (const group of synonymGroups) {
    const canonical = group[0]
    for (const synonym of group) normalized = normalized.replaceAll(synonym, canonical)
  }
  return normalized
}

function similarity(left: string, right: string) {
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return Math.min(left.length, right.length) / Math.max(left.length, right.length)
  const leftPairs = bigrams(left)
  const rightPairs = bigrams(right)
  let overlap = 0
  const remaining = [...rightPairs]
  for (const pair of leftPairs) {
    const index = remaining.indexOf(pair)
    if (index >= 0) { overlap += 1; remaining.splice(index, 1) }
  }
  return leftPairs.length + rightPairs.length ? 2 * overlap / (leftPairs.length + rightPairs.length) : 0
}

function bigrams(value: string) {
  if (value.length < 2) return [value]
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2))
}
