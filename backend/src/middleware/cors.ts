import { Request, Response, NextFunction } from 'express'

function getAllowedOrigin(): string | undefined {
    return process.env.FRONTEND_URL
}

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization'
const MAX_AGE = 86400

function setCorsHeaders(res: Response, origin: string): void {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS)
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
    res.setHeader('Access-Control-Max-Age', String(MAX_AGE))
}

export function corsHandler(req: Request, res: Response, next: NextFunction): void {
    const frontendUrl = getAllowedOrigin()
    const origin = req.headers.origin

    // Dev mode: no FRONTEND_URL configured — allow all origins
    if (!frontendUrl) {
        if (origin) {
            setCorsHeaders(res, origin)
        }
        return next()
    }

    // No origin header (server-to-server, curl, health checks)
    if (!origin) {
        return next()
    }

    // Origin mismatch — reject with 403
    if (origin !== frontendUrl) {
        res.status(403).json({ error: 'CORS policy: origin not allowed' })
        return
    }

    setCorsHeaders(res, frontendUrl)
    next()
}

export function preflightHandler(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'OPTIONS') {
        return next()
    }

    const frontendUrl = getAllowedOrigin()
    const origin = req.headers.origin

    if (!frontendUrl) {
        setCorsHeaders(res, origin || '*')
        res.status(204).end()
        return
    }

    if (origin === frontendUrl) {
        setCorsHeaders(res, frontendUrl)
    }

    res.status(204).end()
}
