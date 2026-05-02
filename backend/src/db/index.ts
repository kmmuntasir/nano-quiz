import { Pool, type QueryResult, type QueryResultRow } from 'pg'

const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
    console.error('Unexpected idle client error:', err.message)
})

export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
): Promise<QueryResult<T>> {
    return pool.query<T>(text, params)
}

export async function getClient() {
    const client = await pool.connect()
    return client
}

export async function closePool(): Promise<void> {
    await pool.end()
}

export { pool }
