import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://food_app:local-only-change-me@localhost:5432/first_choice_food'
  },
  strict: true,
  verbose: true
})
