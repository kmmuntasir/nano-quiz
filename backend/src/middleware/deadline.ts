import { Request, Response, NextFunction } from 'express'

export function deadlineCheck(req: Request, res: Response, next: NextFunction): void {
    const deadline = process.env.EVENT_DEADLINE_ISO
    if (!deadline) {
        return next()
    }

    const deadlineTime = new Date(deadline).getTime()
    if (isNaN(deadlineTime)) {
        console.error(`Invalid EVENT_DEADLINE_ISO: ${deadline}`)
        return next()
    }

    if (Date.now() > deadlineTime) {
        res.status(403).json({ error: 'The event has concluded.' })
        return
    }

    next()
}
