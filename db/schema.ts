import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

export const sexEnum = pgEnum('sex', ['male', 'female'])
export const mealTypeEnum = pgEnum('meal_type', ['breakfast', 'lunch', 'dinner', 'snack'])
export const mealSourceEnum = pgEnum('meal_source', ['manual', 'photo', 'voice', 'eip', 'custom', 'tfda'])
export const foodTypeEnum = pgEnum('food_type', ['meat', 'veg', 'unknown'])
export const syncStatusEnum = pgEnum('sync_status', ['success', 'no_change', 'failed'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  identityHmac: varchar('identity_hmac', { length: 64 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  pushSubscription: jsonb('push_subscription'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('users_identity_hmac_uidx').on(table.identityHmac)])

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  healthGoal: varchar('health_goal', { length: 40 }).notNull().default('均衡飲食'),
  reminderEnabled: boolean('reminder_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const profileSnapshots = pgTable('profile_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  age: integer('age').notNull(),
  sex: sexEnum('sex').notNull(),
  heightCm: numeric('height_cm', { precision: 5, scale: 1 }).notNull(),
  weightKg: numeric('weight_kg', { precision: 5, scale: 1 }).notNull(),
  bodyFatPercent: numeric('body_fat_percent', { precision: 4, scale: 1 }),
  muscleKg: numeric('muscle_kg', { precision: 5, scale: 1 }),
  activityFactor: numeric('activity_factor', { precision: 4, scale: 3 }).notNull(),
  measuredAt: timestamp('measured_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('profile_snapshots_user_measured_idx').on(table.userId, table.measuredAt)])

export const meals = pgTable('meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mealDate: date('meal_date', { mode: 'string' }).notNull(),
  mealType: mealTypeEnum('meal_type').notNull(),
  source: mealSourceEnum('source').notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  caloriesKcal: numeric('calories_kcal', { precision: 8, scale: 2 }).notNull(),
  proteinG: numeric('protein_g', { precision: 7, scale: 2 }),
  fatG: numeric('fat_g', { precision: 7, scale: 2 }),
  carbsG: numeric('carbs_g', { precision: 7, scale: 2 }),
  fiberG: numeric('fiber_g', { precision: 7, scale: 2 }),
  sodiumMg: numeric('sodium_mg', { precision: 9, scale: 2 }),
  confidence: numeric('confidence', { precision: 4, scale: 3 }),
  summary: varchar('summary', { length: 500 }),
  clientRequestId: varchar('client_request_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('meals_user_date_idx').on(table.userId, table.mealDate),
  uniqueIndex('meals_user_client_request_uidx').on(table.userId, table.clientRequestId)
])

export const customFoods = pgTable('custom_foods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  caloriesKcal: numeric('calories_kcal', { precision: 8, scale: 2 }).notNull(),
  proteinG: numeric('protein_g', { precision: 7, scale: 2 }),
  fatG: numeric('fat_g', { precision: 7, scale: 2 }),
  carbsG: numeric('carbs_g', { precision: 7, scale: 2 }),
  sodiumMg: numeric('sodium_mg', { precision: 9, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('custom_foods_user_idx').on(table.userId)])

export const eipRestaurants = pgTable('eip_restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  normalizedName: varchar('normalized_name', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  uniqueIndex('eip_restaurants_normalized_name_uidx').on(table.normalizedName),
  index('eip_restaurants_name_idx').on(table.name)
])

export const eipMenuItems = pgTable('eip_menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => eipRestaurants.id, { onDelete: 'cascade' }),
  foodType: foodTypeEnum('food_type').notNull().default('unknown'),
  name: varchar('name', { length: 160 }).notNull(),
  normalizedName: varchar('normalized_name', { length: 160 }).notNull(),
  caloriesKcal: numeric('calories_kcal', { precision: 8, scale: 2 }).notNull(),
  proteinG: numeric('protein_g', { precision: 7, scale: 2 }),
  fatG: numeric('fat_g', { precision: 7, scale: 2 }),
  carbsG: numeric('carbs_g', { precision: 7, scale: 2 }),
  fiberG: numeric('fiber_g', { precision: 7, scale: 2 }),
  sodiumMg: numeric('sodium_mg', { precision: 9, scale: 2 }),
  nutritionEstimated: boolean('nutrition_estimated').notNull().default(false),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  uniqueIndex('eip_menu_restaurant_name_uidx').on(table.restaurantId, table.normalizedName),
  index('eip_menu_restaurant_food_type_idx').on(table.restaurantId, table.foodType)
])

export const userDailyRestaurantSelections = pgTable('user_daily_restaurant_selections', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceDate: date('service_date', { mode: 'string' }).notNull(),
  restaurantId: uuid('restaurant_id').notNull().references(() => eipRestaurants.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  primaryKey({ columns: [table.userId, table.serviceDate], name: 'user_daily_restaurant_selections_pk' }),
  index('user_daily_restaurant_selections_restaurant_idx').on(table.restaurantId)
])

export const eipOrders = pgTable('eip_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mealDate: date('meal_date', { mode: 'string' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  caloriesKcal: numeric('calories_kcal', { precision: 8, scale: 2 }).notNull(),
  proteinG: numeric('protein_g', { precision: 7, scale: 2 }),
  fatG: numeric('fat_g', { precision: 7, scale: 2 }),
  carbsG: numeric('carbs_g', { precision: 7, scale: 2 }),
  sodiumMg: numeric('sodium_mg', { precision: 9, scale: 2 }),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('eip_orders_user_date_idx').on(table.userId, table.mealDate)])

export const nutrients = pgTable('nutrients', {
  sampleId: varchar('sample_id', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  aliases: text('aliases'),
  description: text('description'),
  wastePercent: numeric('waste_percent', { precision: 7, scale: 3 }),
  caloriesKcal: numeric('calories_kcal', { precision: 10, scale: 3 }),
  adjustedCaloriesKcal: numeric('adjusted_calories_kcal', { precision: 10, scale: 3 }),
  waterG: numeric('water_g', { precision: 10, scale: 3 }),
  proteinG: numeric('protein_g', { precision: 10, scale: 3 }),
  fatG: numeric('fat_g', { precision: 10, scale: 3 }),
  saturatedFatG: numeric('saturated_fat_g', { precision: 10, scale: 3 }),
  ashG: numeric('ash_g', { precision: 10, scale: 3 }),
  carbsG: numeric('carbs_g', { precision: 10, scale: 3 }),
  fiberG: numeric('fiber_g', { precision: 10, scale: 3 }),
  sugarG: numeric('sugar_g', { precision: 10, scale: 3 }),
  optionalNutrients: jsonb('optional_nutrients').notNull().default({}),
  traceFields: jsonb('trace_fields').notNull().default([]),
  versionHash: varchar('version_hash', { length: 64 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('nutrients_name_idx').on(table.name)])

export const nutrientsStaging = pgTable('nutrients_staging', {
  sampleId: varchar('sample_id', { length: 32 }).primaryKey(),
  payload: jsonb('payload').notNull(),
  versionHash: varchar('version_hash', { length: 64 }).notNull()
})

export const nutrientVersions = pgTable('nutrient_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileHash: varchar('file_hash', { length: 64 }).notNull(),
  columnsHash: varchar('columns_hash', { length: 64 }).notNull(),
  sourceEtag: text('source_etag'),
  sourceLastModified: text('source_last_modified'),
  rowCount: integer('row_count').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('nutrient_versions_file_hash_uidx').on(table.fileHash)])

export const nutrientSyncLogs = pgTable('nutrient_sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: syncStatusEnum('status').notNull(),
  message: text('message').notNull(),
  fileHash: varchar('file_hash', { length: 64 }),
  rowCount: integer('row_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const mealImportBatches = pgTable('meal_import_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileHash: varchar('file_hash', { length: 64 }).notNull(),
  rowCount: integer('row_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('meal_import_batches_user_idx').on(table.userId),
  uniqueIndex('meal_import_batches_user_hash_uidx').on(table.userId, table.fileHash)
])

// Tracks food names the AI produced that either matched nothing in `nutrients`, or only
// matched weakly (findBestFoodMatch found something, but the name is different enough that
// it's likely the wrong dish — e.g. "炒麵" force-matching to "意麵"). TFDA catalogs raw
// ingredients, not composite dishes, so this is expected to happen; the point is to build a
// prioritized worklist of what to add to the database next, not to block the analysis.
export const nutrientMatchGaps = pgTable('nutrient_match_gaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  queryName: varchar('query_name', { length: 160 }).notNull(),
  matchedSampleId: varchar('matched_sample_id', { length: 32 }),
  matchedName: varchar('matched_name', { length: 200 }),
  score: numeric('score', { precision: 4, scale: 3 }),
  occurrences: integer('occurrences').notNull().default(1),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('nutrient_match_gaps_query_name_uidx').on(table.queryName)])

export const aiAuditEvents = pgTable('ai_audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  jobType: varchar('job_type', { length: 40 }).notNull(),
  provider: varchar('provider', { length: 40 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  durationMs: integer('duration_ms'),
  errorCode: varchar('error_code', { length: 80 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export type User = typeof users.$inferSelect
export type Meal = typeof meals.$inferSelect
export type NewMeal = typeof meals.$inferInsert
export type ProfileSnapshot = typeof profileSnapshots.$inferSelect
export type Nutrient = typeof nutrients.$inferSelect
