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

// Longest phrases first so e.g. "清蒸" is removed whole rather than leaving a stray "清"
// behind after "蒸" is stripped. Cooking method words are NOT stripped for the primary
// match attempt — 炒/炸/煎 in particular add significant oil/calories, so a food-matching
// entry that keeps the cooking method (if one exists in the database) is more accurate than
// one that doesn't. This is only meant to be tried as a fallback when the full name fails to
// match anything, on the theory that a user/model who didn't name a specific dish variant
// ("炒麵" without saying which noodle) has no stronger claim to any one ingredient anyway.
const cookingMethodWords = [
  '清蒸', '紅燒', '乾煎', '清炒', '醬燒', '水煮', '涼拌', '油炸', '快炒',
  '蒸', '煮', '炒', '炸', '烤', '滷', '燉', '燙', '煎', '燒', '拌', '滾'
]

export function stripCookingMethod(value: string): string {
  let stripped = value
  for (const word of cookingMethodWords) stripped = stripped.replaceAll(word, '')
  return stripped.trim()
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

// Edit-distance based similarity, not bigram-set overlap: Chinese food names commonly
// differ by a single inserted/dropped/swapped character between what an AI says and what
// TFDA calls it (e.g. "白米飯" vs "白飯", "牛肉麵" vs "牛肉湯麵"). Bigram overlap scores
// those as near-zero (no shared 2-character pairs once the insertion shifts everything),
// which meant almost nothing ever matched in practice. Levenshtein distance treats a
// single-character edit as a small, proportional penalty instead.
function similarity(left: string, right: string) {
  if (left === right) return 1
  if (!left.length || !right.length) return 0
  if (left.includes(right) || right.includes(left)) return Math.min(left.length, right.length) / Math.max(left.length, right.length)
  const distance = levenshteinDistance(left, right)
  return 1 - distance / Math.max(left.length, right.length)
}

function levenshteinDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  let current = previous.slice()
  for (let i = 1; i <= left.length; i++) {
    current[0] = i
    for (let j = 1; j <= right.length; j++) {
      current[j] = left[i - 1] === right[j - 1]
        ? previous[j - 1]
        : 1 + Math.min(previous[j - 1], previous[j], current[j - 1])
    }
    ;[previous, current] = [current, previous]
  }
  return previous[right.length]
}
