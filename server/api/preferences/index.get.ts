import { eq } from 'drizzle-orm'
import { userPreferences } from '~/db/schema'
import { DEFAULT_USER_PREFERENCES } from '~/shared/domain/preferences'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const preferences = await withUserScope(user.id, async database => {
    await database.insert(userPreferences).values({
      userId: user.id,
      healthGoal: DEFAULT_USER_PREFERENCES.healthGoal,
      reminderEnabled: DEFAULT_USER_PREFERENCES.reminderEnabled
    }).onConflictDoNothing()
    const [row] = await database.select().from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
    return row
  })

  return {
    preferences: preferences
      ? {
          healthGoal: preferences.healthGoal,
          reminderEnabled: preferences.reminderEnabled
        }
      : DEFAULT_USER_PREFERENCES,
    persisted: Boolean(preferences),
    updatedAt: preferences?.updatedAt ?? null
  }
})
