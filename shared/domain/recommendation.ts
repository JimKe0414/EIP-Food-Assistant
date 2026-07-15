export type RecommendationSource = 'eip' | 'custom' | 'tfda'

export interface RecommendationCandidate {
  id: string
  source: RecommendationSource
  name: string
}

export function chooseRecommendationCandidates(
  eip: RecommendationCandidate[],
  custom: RecommendationCandidate[],
  tfda: RecommendationCandidate[],
  tfdaAllowed = true
) {
  if (eip.length) return eip
  if (custom.length) return custom
  return tfdaAllowed ? tfda : []
}

export function restrictRecommendationIds(requestedIds: string[], allowedIds: string[]) {
  const allowed = new Set(allowedIds)
  return [...new Set(requestedIds)].filter(id => allowed.has(id))
}
