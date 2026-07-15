import { mealAnalysisInputSchema } from '~/shared/domain/meals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => mealAnalysisInputSchema.parse(value))

  let jobId: string
  if (input.mode === 'voice') {
    if (!input.audioBase64 || !input.mimeType) throw createError({ statusCode: 400, statusMessage: 'Audio and MIME type are required' })
    jobId = await enqueueAiJob({ type: 'transcribeMeal', userId: user.id, audioBase64: input.audioBase64, mimeType: input.mimeType })
  } else {
    if (input.mode === 'text' && !input.text) throw createError({ statusCode: 400, statusMessage: 'Text is required' })
    if (input.mode === 'photo' && (!input.imageBase64 || !input.mimeType)) throw createError({ statusCode: 400, statusMessage: 'Image and MIME type are required' })
    jobId = await enqueueAiJob({
      type: 'analyzeMeal',
      userId: user.id,
      input: { text: input.text, imageBase64: input.imageBase64, mimeType: input.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | undefined }
    })
  }

  setResponseStatus(event, 202)
  return { jobId, statusUrl: `/api/jobs/${jobId}` }
})
