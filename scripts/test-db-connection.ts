/**
 * Test Supabase PostgreSQL connection.
 * Usage: npx tsx scripts/test-db-connection.ts
 *
 * Set SUPABASE_DB_URL before running:
 *   export SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
 */
import { Pool } from "pg"

const DB_URL = process.env.SUPABASE_DB_URL

if (!DB_URL) {
    console.error("FAIL: SUPABASE_DB_URL not set")
    process.exit(1)
}

// Mask password in output
const masked = DB_URL.replace(/:([^@]+)@/, ":****@")
console.log(`Testing connection: ${masked}`)

const pool = new Pool({
    connectionString: DB_URL,
    max: 2,
    connectionTimeoutMillis: 10_000,
})

async function testConnection() {
    try {
        // Test 1: Basic connectivity
        const { rows } = await pool.query("SELECT NOW() AS current_time, current_database() AS db_name")
        console.log(`\n✓ Connected to database: ${rows[0].db_name}`)
        console.log(`✓ Server time: ${rows[0].current_time.toISOString()}`)

        // Test 2: Check if schema exists
        const tables = await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        )
        const tableNames = tables.rows.map((r) => r.table_name)

        const expected = ["users", "questions", "user_sessions"]
        const present = expected.filter((t) => tableNames.includes(t))
        const missing = expected.filter((t) => !tableNames.includes(t))

        if (present.length > 0) {
            console.log(`\n✓ Tables found: ${present.join(", ")}`)
        }
        if (missing.length > 0) {
            console.log(`\n⚠ Missing tables: ${missing.join(", ")}`)
            console.log("  Apply schema with: psql $SUPABASE_DB_URL -f docs/data/schema.sql")
        }

        // Test 3: UUID extension
        const ext = await pool.query(
            "SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp'"
        )
        if (ext.rows.length > 0) {
            console.log(`\n✓ uuid-ossp extension: v${ext.rows[0].extversion}`)
        } else {
            console.log("\n⚠ uuid-ossp extension not installed")
        }

        // Test 4: Row counts
        for (const table of present) {
            const count = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`)
            console.log(`  ${table}: ${count.rows[0].count} rows`)
        }

        console.log("\n✓ All connection tests passed")
        process.exit(0)
    } catch (err) {
        const error = err as Error
        console.error(`\n✗ Connection failed: ${error.message}`)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

testConnection()
