import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const baseUrl = process.env.OPENAI_COMPAT_BASE_URL || 'https://api.focusit.tw/openai/v1'
const model = process.env.OPENAI_COMPAT_TEXT_MODEL || 'Qwen3.6-35B-A3B-fast'
const maxTokens = Number(process.env.OPENAI_COMPAT_MAX_TOKENS || '4096')
const secretPath = resolve('secrets/openai_compat_api_key.txt')
const apiKey = process.env.OPENAI_COMPAT_API_KEY || (existsSync(secretPath) ? readFileSync(secretPath, 'utf8').trim() : '')

if (!apiKey) {
  throw new Error('請設定 OPENAI_COMPAT_API_KEY，或建立 secrets/openai_compat_api_key.txt')
}
if (!Number.isInteger(maxTokens) || maxTokens < 1) {
  throw new Error('OPENAI_COMPAT_MAX_TOKENS 必須是正整數')
}

const candidates = [
  { id: 'mock:chicken', source: 'mock', name: '烤雞胸藜麥餐盒', caloriesKcal: 520, proteinG: 42, fatG: 14, carbsG: 56 },
  { id: 'mock:beef', source: 'mock', name: '黑胡椒牛肉便當', caloriesKcal: 760, proteinG: 33, fatG: 31, carbsG: 82 },
  { id: 'mock:salmon', source: 'mock', name: '味噌鮭魚糙米餐', caloriesKcal: 610, proteinG: 36, fatG: 22, carbsG: 65 },
  { id: 'mock:vegetarian', source: 'mock', name: '豆腐時蔬蕎麥麵', caloriesKcal: 480, proteinG: 24, fatG: 13, carbsG: 68 }
]
const context = {
  goal: '均衡、高蛋白，並避免連續吃相同主菜',
  candidateIds: candidates.map(candidate => candidate.id),
  candidates,
  recentMealNames: ['香煎雞腿便當', '雞肉沙拉'],
  nutrientTargets: { caloriesKcal: 650, proteinG: 35 }
}
const system = `Recommend up to three lunch candidates using the goal, candidate nutrition details, recent meals, and nutrient targets. Select only IDs present in candidateIds. Return JSON only:
{"candidateIds":["candidate-id"],"reasonById":{"candidate-id":"short Traditional Chinese reason"}}. Never invent IDs.`

const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
  method: 'POST',
  headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    model,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(context) }]
  }),
  signal: AbortSignal.timeout(30_000)
})
const responseText = await response.text()
if (!response.ok) throw new Error(`FocusIT API 回傳 HTTP ${response.status}: ${responseText.slice(0, 500)}`)

const payload = JSON.parse(responseText)
const content = String(payload.choices?.[0]?.message?.content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
const result = JSON.parse(content)
const allowedIds = new Set(context.candidateIds)
const candidateIds = [...new Set(Array.isArray(result.candidateIds) ? result.candidateIds : [])].filter(id => allowedIds.has(id)).slice(0, 3)
if (!candidateIds.length) throw new Error(`API 未回傳有效候選 ID，原始內容：${content.slice(0, 500)}`)

console.log(JSON.stringify({
  endpoint: baseUrl,
  model,
  maxTokens,
  recommendations: candidateIds.map(id => ({
    ...candidates.find(candidate => candidate.id === id),
    reason: String(result.reasonById?.[id] || '未提供原因')
  }))
}, null, 2))
