import type { MealAnalysisResult, TranscriptionResult } from '~/shared/domain/ai'
import type { FoodType } from '~/types/diet'

interface JobResponse<T> {
  state: string
  output?: T
  queueDepth?: number
  error?: { code: string, message: string }
}

export type JobProgress = { queueDepth?: number }

interface LunchCandidateResponse {
  id: string
  name: string
  caloriesKcal: number
  proteinG: number | null
}

interface LunchRecommendationOutput {
  candidateIds: string[]
  reasonById: Record<string, string>
}

export function useApi() {
  let csrfToken: string | undefined

  async function post<T>(url: string, body?: Record<string, any>) {
    csrfToken ||= (await $fetch<{ token: string }>('/api/csrf-token')).token
    return $fetch<T>(url, { method: 'POST', body, headers: { 'x-csrf-token': csrfToken } })
  }

  async function postForm<T>(url: string, body: FormData) {
    csrfToken ||= (await $fetch<{ token: string }>('/api/csrf-token')).token
    return $fetch<T>(url, { method: 'POST', body, headers: { 'x-csrf-token': csrfToken } })
  }

  async function waitForJob<T>(statusUrl: string, timeoutMs: number, onProgress?: (progress: JobProgress) => void): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const job = await $fetch<JobResponse<T>>(statusUrl)
      onProgress?.({ queueDepth: job.queueDepth })
      if (job.state === 'completed' && job.output !== undefined) return job.output
      if (job.state === 'failed') throw new Error(job.error?.message ?? 'AI task failed')
      await new Promise(resolve => window.setTimeout(resolve, 600))
    }
    throw new Error('AI task timed out')
  }

  // All three job types share one AI queue processed strictly one-at-a-time (see
  // worker/index.ts), so a slow photo/thinking-model analysis ahead of yours pushes out
  // everyone behind it — the client budget has to cover queue wait time, not just this job's
  // own processing time, hence the generous ceiling (well above the 90s server-side provider
  // timeout on its own).
  async function analyzeText(text: string, onProgress?: (progress: JobProgress) => void) {
    const queued = await post<{ statusUrl: string }>('/api/meals/analyze', { mode: 'text', text })
    return waitForJob<MealAnalysisResult>(queued.statusUrl, 240_000, onProgress)
  }

  async function analyzeImage(imageBase64: string, mimeType: string, text?: string, onProgress?: (progress: JobProgress) => void) {
    const queued = await post<{ statusUrl: string }>('/api/meals/analyze', { mode: 'photo', imageBase64, mimeType, text })
    return waitForJob<MealAnalysisResult>(queued.statusUrl, 240_000, onProgress)
  }

  async function transcribeAudio(audioBase64: string, mimeType: string, onProgress?: (progress: JobProgress) => void) {
    const queued = await post<{ statusUrl: string }>('/api/meals/analyze', { mode: 'voice', audioBase64, mimeType })
    return waitForJob<TranscriptionResult>(queued.statusUrl, 240_000, onProgress)
  }

  async function recommendLunch(goal: string, foodType: FoodType, useMockData = false) {
    const queued = await post<{
      statusUrl: string
      candidates: LunchCandidateResponse[]
      dataMode: 'live' | 'mock'
      warning?: string
    }>('/api/recommend-lunch', {
      goal,
      foodType,
      useMockData,
      serviceDate: new Date().toISOString().slice(0, 10)
    })
    const output = await waitForJob<LunchRecommendationOutput>(queued.statusUrl, 30_000)
    return { ...queued, output }
  }

  return { post, postForm, waitForJob, analyzeText, analyzeImage, transcribeAudio, recommendLunch }
}

export async function fileToBase64(file: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}
