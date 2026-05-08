type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
    timestamp: string
    level: LogLevel
    message: string
    context?: Record<string, unknown>
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(context && Object.keys(context).length > 0 && { context }),
    }
    const dest = level === 'error' ? process.stderr : process.stdout
    dest.write(JSON.stringify(entry) + '\n')
}

export const logger = {
    info(message: string, context?: Record<string, unknown>) {
        write('info', message, context)
    },
    warn(message: string, context?: Record<string, unknown>) {
        write('warn', message, context)
    },
    error(message: string, context?: Record<string, unknown>) {
        write('error', message, context)
    },
}
