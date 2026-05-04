/**
 * Validate database schema version against expected version.
 * Usage: npx tsx scripts/validate-schema.ts
 *
 * Checks:
 * 1. Database connectivity
 * 2. All expected tables exist
 * 3. Column structure matches schema_version.json
 * 4. Schema version in DB matches expected version
 *
 * Requires SUPABASE_DB_URL env var.
 */
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DB_URL = process.env.SUPABASE_DB_URL

if (!DB_URL) {
    console.error('✗ SUPABASE_DB_URL not set')
    process.exit(1)
}

interface SchemaVersion {
    version: number
    description: string
    tables: string[]
    checksums: Record<string, string[]>
}

function loadExpectedSchema(): SchemaVersion {
    const path = resolve(ROOT, 'docs', 'data', 'schema_version.json')
    return JSON.parse(readFileSync(path, 'utf-8'))
}

const pool = new Pool({
    connectionString: DB_URL,
    max: 2,
    connectionTimeoutMillis: 10_000,
})

async function validate(): Promise<void> {
    const expected = loadExpectedSchema()
    let passed = true

    console.log(`Expected schema version: ${expected.version} (${expected.description})`)

    // 1. Connectivity
    try {
        const { rows } = await pool.query('SELECT NOW() AS t, current_database() AS db')
        console.log(`✓ Connected to: ${rows[0].db}`)
    } catch (err) {
        console.error(`✗ Cannot connect to database: ${(err as Error).message}`)
        process.exit(1)
    }

    // 2. Schema version check
    try {
        const { rows } = await pool.query(
            'SELECT version, applied_at, description FROM schema_migrations ORDER BY version DESC LIMIT 1'
        )
        if (rows.length === 0) {
            console.error('✗ No schema_migrations records found. Apply schema.sql first.')
            passed = false
        } else {
            const dbVersion = rows[0].version
            if (dbVersion === expected.version) {
                console.log(`✓ Schema version: ${dbVersion} (applied ${rows[0].applied_at.toISOString()})`)
            } else {
                console.error(`✗ Schema version mismatch: DB has ${dbVersion}, expected ${expected.version}`)
                passed = false
            }
        }
    } catch {
        console.error('✗ schema_migrations table not found. Apply schema.sql first.')
        passed = false
    }

    // 3. Table existence check
    const { rows: tableRows } = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    )
    const existingTables = new Set(tableRows.map((r: { table_name: string }) => r.table_name))

    const missingTables = expected.tables.filter(t => !existingTables.has(t))
    const extraTables = [...existingTables].filter(t => !expected.tables.includes(t))

    if (missingTables.length > 0) {
        console.error(`✗ Missing tables: ${missingTables.join(', ')}`)
        passed = false
    } else {
        console.log(`✓ All expected tables present: ${expected.tables.join(', ')}`)
    }
    if (extraTables.length > 0) {
        console.log(`  ℹ Extra tables (not validated): ${extraTables.join(', ')}`)
    }

    // 4. Column structure validation
    for (const [table, expectedCols] of Object.entries(expected.checksums)) {
        if (!existingTables.has(table)) continue

        const { rows: colRows } = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
            [table]
        )
        const actualCols = colRows.map((r: { column_name: string }) => r.column_name)

        const missing = expectedCols.filter(c => !actualCols.includes(c))
        if (missing.length > 0) {
            console.error(`✗ ${table}: missing columns: ${missing.join(', ')}`)
            passed = false
        } else {
            console.log(`✓ ${table}: columns valid (${actualCols.length} columns)`)
        }
    }

    await pool.end()

    console.log('')
    if (passed) {
        console.log('✓ Schema validation passed')
        process.exit(0)
    } else {
        console.log('✗ Schema validation failed')
        process.exit(1)
    }
}

validate().catch((err) => {
    console.error(`✗ Unexpected error: ${(err as Error).message}`)
    pool.end()
    process.exit(1)
})
