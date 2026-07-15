import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import * as schema from '~/db/schema'

let sqlClient: Sql | undefined
let database: PostgresJsDatabase<typeof schema> | undefined

export function useDatabase() {
  if (database) return database

  const config = useRuntimeConfig()
  const databaseUrl = config.databaseUrl || process.env.DATABASE_URL
  if (!databaseUrl) {
    throw createError({ statusCode: 503, statusMessage: 'Database is not configured' })
  }

  sqlClient = postgres(databaseUrl, {
    max: Number(process.env.DB_POOL_SIZE ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  })
  database = drizzle(sqlClient, { schema })
  return database
}

export function useSqlClient() {
  useDatabase()
  return sqlClient!
}

export async function closeDatabase() {
  await sqlClient?.end({ timeout: 5 })
  sqlClient = undefined
  database = undefined
}
