/**
 * Validate environment variables for deployment.
 * Usage: npx tsx scripts/validate-env.ts [--backend|--frontend]
 *
 * --backend   Validate backend/.env (default if neither flag)
 * --frontend  Validate frontend/.env
 * (no flags)  Validate both
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

interface VarSpec {
    name: string
    required: boolean
    pattern?: RegExp
    hint?: string
}

const BACKEND_VARS: VarSpec[] = [
    { name: 'PORT', required: false, pattern: /^\d{2,5}$/, hint: 'Must be a valid port number' },
    { name: 'FRONTEND_URL', required: true, pattern: /^https?:\/\/.+/, hint: 'Must be a valid URL (http:// or https://)' },
    { name: 'GOOGLE_CLIENT_ID', required: true, pattern: /.+\.apps\.googleusercontent\.com$/, hint: 'Must end with .apps.googleusercontent.com' },
    { name: 'JWT_SECRET', required: true, pattern: /^.{16,}$/, hint: 'Must be at least 16 characters' },
    { name: 'SUPABASE_DB_URL', required: true, pattern: /^postgresql:\/\/.+/, hint: 'Must start with postgresql://' },
    { name: 'RESTRICT_DOMAIN', required: false },
    { name: 'EVENT_DEADLINE_ISO', required: false, pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, hint: 'Must be a valid ISO 8601 datetime' },
    { name: 'TRACK_PER_QUESTION_TIME', required: false, pattern: /^(true|false)$/ },
]

const FRONTEND_VARS: VarSpec[] = [
    { name: 'VITE_API_BASE_URL', required: true, pattern: /^https?:\/\/.+/, hint: 'Must be a valid URL' },
    { name: 'VITE_GOOGLE_CLIENT_ID', required: true, pattern: /.+\.apps\.googleusercontent\.com$/, hint: 'Must end with .apps.googleusercontent.com' },
]

function parseEnvFile(filePath: string): Record<string, string> {
    if (!existsSync(filePath)) return {}
    const content = readFileSync(filePath, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
        }
        env[key] = val
    }
    return env
}

interface ValidationResult {
    passed: boolean
    errors: string[]
    warnings: string[]
}

function validateVars(vars: VarSpec[], env: Record<string, string>, label: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    for (const spec of vars) {
        const value = env[spec.name]

        if (!value || value === '') {
            if (spec.required) {
                errors.push(`[${label}] ${spec.name}: MISSING (required)`)
            }
            continue
        }

        // Skip pattern check for placeholder values
        if (value.includes('your-') || value.includes('YOUR_')) {
            if (spec.required) {
                errors.push(`[${label}] ${spec.name}: Contains placeholder value "${value}"`)
            } else {
                warnings.push(`[${label}] ${spec.name}: Placeholder value detected`)
            }
            continue
        }

        if (spec.pattern && !spec.pattern.test(value)) {
            errors.push(`[${label}] ${spec.name}: Invalid format "${value}". ${spec.hint || ''}`)
        }
    }

    return { passed: errors.length === 0, errors, warnings }
}

function main(): void {
    const args = process.argv.slice(2)
    const checkBackend = args.length === 0 || args.includes('--backend')
    const checkFrontend = args.length === 0 || args.includes('--frontend')

    let allPassed = true
    const allErrors: string[] = []
    const allWarnings: string[] = []

    if (checkBackend) {
        const envPath = resolve(ROOT, 'backend', '.env')
        console.log(`\nValidating backend env: ${envPath}`)
        if (!existsSync(envPath)) {
            console.log(`  ⚠ No .env file found, checking process.env`)
        }
        const env = { ...parseEnvFile(envPath), ...process.env }
        const result = validateVars(BACKEND_VARS, env, 'backend')
        if (result.warnings.length > 0) {
            result.warnings.forEach(w => console.log(`  ⚠ ${w}`))
        }
        if (result.errors.length > 0) {
            result.errors.forEach(e => console.log(`  ✗ ${e}`))
            allPassed = false
        } else {
            console.log('  ✓ All backend environment variables valid')
        }
        allErrors.push(...result.errors)
        allWarnings.push(...result.warnings)
    }

    if (checkFrontend) {
        const envPath = resolve(ROOT, 'frontend', '.env')
        console.log(`\nValidating frontend env: ${envPath}`)
        if (!existsSync(envPath)) {
            console.log(`  ⚠ No .env file found, checking process.env`)
        }
        const env = { ...parseEnvFile(envPath), ...process.env }
        const result = validateVars(FRONTEND_VARS, env, 'frontend')
        if (result.warnings.length > 0) {
            result.warnings.forEach(w => console.log(`  ⚠ ${w}`))
        }
        if (result.errors.length > 0) {
            result.errors.forEach(e => console.log(`  ✗ ${e}`))
            allPassed = false
        } else {
            console.log('  ✓ All frontend environment variables valid')
        }
        allErrors.push(...result.errors)
        allWarnings.push(...result.warnings)
    }

    console.log('')
    if (allPassed) {
        console.log('✓ Environment validation passed')
        process.exit(0)
    } else {
        console.log(`✗ Environment validation failed (${allErrors.length} error(s))`)
        process.exit(1)
    }
}

main()
