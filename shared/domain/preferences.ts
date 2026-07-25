import { z } from 'zod'

export const healthGoalSchema = z.enum(['均衡飲食', '對自己好點', '健康樂活'])

export const userPreferencesInputSchema = z.object({
  healthGoal: healthGoalSchema,
  reminderEnabled: z.boolean()
})

export const DEFAULT_USER_PREFERENCES: UserPreferencesInput = {
  healthGoal: '均衡飲食',
  reminderEnabled: true
}

export type HealthGoal = z.infer<typeof healthGoalSchema>
export type UserPreferencesInput = z.infer<typeof userPreferencesInputSchema>
