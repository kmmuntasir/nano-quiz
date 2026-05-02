import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthenticatedRequest extends Request {
    userId?: string
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' })
        return
    }

    const token = authHeader.slice(7)
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        req.userId = decoded.userId
        next()
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' })
    }
}
