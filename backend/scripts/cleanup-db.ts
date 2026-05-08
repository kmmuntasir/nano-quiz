// Reset quiz progress for a user so they can retake the quiz in dev.
// Usage:
//   tsx scripts/cleanup-db.ts <email>
//   tsx scripts/cleanup-db.ts --all        # Reset ALL users
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

import pg from 'pg'

const { Pool } = pg

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL
if (!SUPABASE_DB_URL) {
    console.error('Error: SUPABASE_DB_URL not set. Check backend/.env.')
    process.exit(1)
}

const pool = new Pool({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
})

async function main() {
    const arg = process.argv[2]

    if (!arg) {
        console.error('Usage: tsx scripts/cleanup-db.ts <email> | --all')
        process.exit(1)
    }

    try {
        if (arg === '--all') {
            console.log('Resetting ALL users quiz progress...')
            await pool.query('BEGIN')
            await pool.query('DELETE FROM user_sessions')
            await pool.query(`UPDATE users SET started_at = NULL, completed_at = NULL, score = NULL, duration_seconds = NULL`)
            await pool.query('COMMIT')
            console.log('Done. All users reset.')
        } else {
            console.log(`Resetting quiz progress for: ${arg}`)
            await pool.query('BEGIN')
            await pool.query('DELETE FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)', [arg])
            await pool.query(`UPDATE users SET started_at = NULL, completed_at = NULL, score = NULL, duration_seconds = NULL WHERE email = $1`, [arg])
            await pool.query('COMMIT')
            console.log(`Done. ${arg} can now retake the quiz.`)
        }
    } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err))
        await pool.query('ROLLBACK').catch(() => {})
        process.exit(1)
    } finally {
        await pool.end()
    }
}

main()
