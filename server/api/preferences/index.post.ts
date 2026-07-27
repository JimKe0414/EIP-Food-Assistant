import { userPreferences } from '~/db/schema'
import { userPreferencesInputSchema } from '~/shared/domain/preferences'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => userPreferencesInputSchema.parse(value))
  const [preferences] = await withUserScope(user.id, database => database.insert(userPreferences).values({
    userId: user.id,
    healthGoal: input.healthGoal,
    reminderEnabled: input.reminderEnabled,
    updatedAt: new Date()
  }).onConflictDoUpdate({
    target: userPreferences.userId,
    set: {
      healthGoal: input.healthGoal,
      reminderEnabled: input.reminderEnabled,
      updatedAt: new Date()
    }
  }).returning())
  return {
    preferences: {
      healthGoal: preferences.healthGoal,
      reminderEnabled: preferences.reminderEnabled
    },
    updatedAt: preferences.updatedAt
  }
})
