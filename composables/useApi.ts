import type { MealAnalysisResult, TranscriptionResult } from '~/shared/domain/ai'

interface JobResponse<T> {
  state: string
  output?: T
  error?: { code: string, message: string }
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

  async function waitForJob<T>(statusUrl: string, timeoutMs = 65_000): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const job = await $fetch<JobResponse<T>>(statusUrl)
      if (job.state === 'completed' && job.output !== undefined) return job.output
      if (job.state === 'failed') throw new Error(job.error?.message ?? 'AI task failed')
      await new Promise(resolve => window.setTimeout(resolve, 600))
    }
    throw new Error('AI task timed out')
  }

  async function analyzeText(text: string) {
    const queued = await post<{ statusUrl: string }>('/api/meals/analyze', { mode: 'text', text })
    return waitForJob<MealAnalysisResult>(queued.statusUrl, 35_000)
  }

  async function analyzeImage(imageBase64: string, mimeType: string, text?: string) {
    const queued = await post<{ statusUrl: string }>('/api/meals/analyze', { mode: 'photo', imageBase64, mimeType, text })
    return waitForJob<MealAnalysisResult>(queued.statusUrl, 35_000)
  }

  async function transcribeAudio(audioBase64: string, mimeType: string) {
    const queued = await post<{ statusUrl: string }>('/api/meals/analyze', { mode: 'voice', audioBase64, mimeType })
    return waitForJob<TranscriptionResult>(queued.statusUrl, 65_000)
  }

  return { post, postForm, waitForJob, analyzeText, analyzeImage, transcribeAudio }
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
