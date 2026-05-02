import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query, closePool } from './db/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface QuestionJson {
    question: string
    options: { A: string; B: string; C: string; D: string }
    correct_option: 'A' | 'B' | 'C' | 'D'
}

const INSERT_SQL = `
    INSERT INTO questions (category, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (category, question_text) DO NOTHING
`

async function seedFile(filename: string, category: string): Promise<number> {
    const filePath = resolve(__dirname, '..', 'data', filename)
    const raw = readFileSync(filePath, 'utf-8')
    const questions: QuestionJson[] = JSON.parse(raw)

    let inserted = 0
    for (const q of questions) {
        const result = await query(INSERT_SQL, [
            category,
            q.question,
            q.options.A,
            q.options.B,
            q.options.C,
            q.options.D,
            q.correct_option,
        ])
        if (result.rowCount && result.rowCount > 0) {
            inserted++
        }
    }

    console.log(`[${category}] ${inserted}/${questions.length} questions inserted (${filename})`)
    return inserted
}

async function seed() {
    if (!process.env.SUPABASE_DB_URL) {
        console.error('Error: SUPABASE_DB_URL environment variable is required')
        process.exit(1)
    }

    console.log('Seeding questions...\n')

    const faqInserted = await seedFile('faq_questions.json', 'faq')
    const triviaInserted = await seedFile('trivia_questions.json', 'trivia')

    console.log(`\nDone. Total inserted: ${faqInserted + triviaInserted}`)
    await closePool()
}

seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
})
