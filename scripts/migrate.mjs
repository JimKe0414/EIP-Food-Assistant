import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')
const sql = postgres(databaseUrl, { max: 1, prepare: false })

try {
  await sql`select pg_advisory_lock(hashtext('first-choice-food-migrations'))`
  await sql`
    create table if not exists app_migrations (
      name text primary key,
      checksum varchar(64) not null,
      applied_at timestamptz not null default now()
    )
  `

  const files = (await readdir(migrationsDirectory)).filter(name => name.endsWith('.sql')).sort()
  for (const name of files) {
    const source = await readFile(join(migrationsDirectory, name), 'utf8')
    const checksum = createHash('sha256').update(source).digest('hex')
    const [applied] = await sql`select checksum from app_migrations where name = ${name}`
    if (applied?.checksum && applied.checksum !== checksum) {
      throw new Error(`Applied migration ${name} was modified`)
    }
    if (applied) continue

    await sql.begin(async transaction => {
      await transaction.unsafe(source)
      await transaction`insert into app_migrations (name, checksum) values (${name}, ${checksum})`
    })
    console.log(`[migration] applied ${name}`)
  }
} finally {
  await sql`select pg_advisory_unlock(hashtext('first-choice-food-migrations'))`.catch(() => undefined)
  await sql.end({ timeout: 5 })
}
