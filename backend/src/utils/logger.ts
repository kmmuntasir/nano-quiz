type LogLevel = 'info' | 'warn' | 'error';

export type LogMeta = Record<string, unknown>;

export interface Logger {
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
}

const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN = /(?:jwt|token|secret|password|authorization|email|credential)/i;

function safeStringify(record: Record<string, unknown>): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(record, (key, value) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return REDACTED;
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  } catch {
    return JSON.stringify({ level: record.level, msg: record.msg, ts: record.ts });
  }
}

function write(level: LogLevel, msg: string, meta?: LogMeta): void {
  const record: Record<string, unknown> = {
    ...meta,
    level,
    msg,
    ts: new Date().toISOString(),
  };
  const line = `${safeStringify(record)}\n`;
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(line);
}

export const logger: Logger = {
  info(msg, meta) {
    write('info', msg, meta);
  },
  warn(msg, meta) {
    write('warn', msg, meta);
  },
  error(msg, meta) {
    write('error', msg, meta);
  },
};