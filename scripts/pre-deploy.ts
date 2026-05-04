/**
 * Pre-deployment validation orchestrator.
 * Usage: npx tsx scripts/pre-deploy.ts [--skip-db]
 *
 * Runs all pre-deployment checks:
 * 1. Backend build
 * 2. Frontend build
 * 3. Environment variable validation
 * 4. Database schema validation (skippable with --skip-db)
 *
 * Exit code 0 = all checks passed, ready to deploy.
 */
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const skipDb = args.includes('--skip-db')

interface CheckResult {
    name: string
    passed: boolean
    duration: number
}

function run(label: string, cmd: string, cwd?: string): CheckResult {
    const start = Date.now()
    console.log(`\n${'='.repeat(50)}`)
    console.log(`CHECK: ${label}`)
    console.log(`${'='.repeat(50)}`)
    try {
        execSync(cmd, {
            cwd: cwd || ROOT,
            stdio: 'inherit',
            timeout: 120_000,
        })
        const duration = Date.now() - start
        console.log(`✓ ${label} passed (${duration}ms)`)
        return { name: label, passed: true, duration }
    } catch {
        const duration = Date.now() - start
        console.error(`✗ ${label} failed (${duration}ms)`)
        return { name: label, passed: false, duration }
    }
}

function main(): void {
    console.log('NanoQuiz Pre-Deployment Validation')
    console.log('===================================')

    const results: CheckResult[] = []

    // 1. Backend build
    results.push(run('Backend build', 'npm run build', resolve(ROOT, 'backend')))

    // 2. Frontend build
    results.push(run('Frontend build', 'npm run build', resolve(ROOT, 'frontend')))

    // 3. Environment validation
    results.push(run('Environment variables', 'npx tsx scripts/validate-env.ts', ROOT))

    // 4. Schema validation (skip if --skip-db or no DB URL)
    if (skipDb) {
        console.log('\n⏭ Skipping database schema check (--skip-db)')
    } else if (!process.env.SUPABASE_DB_URL) {
        console.log('\n⏭ Skipping database schema check (SUPABASE_DB_URL not set)')
    } else {
        results.push(run('Database schema', 'npx tsx scripts/validate-schema.ts', ROOT))
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('SUMMARY')
    console.log('='.repeat(50))

    for (const r of results) {
        const icon = r.passed ? '✓' : '✗'
        console.log(`  ${icon} ${r.name} (${r.duration}ms)`)
    }

    const failed = results.filter(r => !r.passed)
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

    console.log('')
    if (failed.length === 0) {
        console.log(`✓ All checks passed (${totalDuration}ms). Ready to deploy.`)
        process.exit(0)
    } else {
        console.log(`✗ ${failed.length} check(s) failed. Fix before deploying.`)
        failed.forEach(f => console.log(`  - ${f.name}`))
        process.exit(1)
    }
}

main()
