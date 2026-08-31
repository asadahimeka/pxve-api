const SENSITIVE_KEYS = 'api[_-]?key|access[_-]?token|auth[_-]?token|token|PHPSESSID|ct0|key|secret|password'
const SENSITIVE_RE = new RegExp(`(^|\\?|&|#)(${SENSITIVE_KEYS})=[^&\\s]*`, 'gi')

function applySanitize(raw: string): string {
  return raw.replace(SENSITIVE_RE, (_, sep, name) => `${sep}${name}=***`)
}

export function sanitizeUrl(raw: string): string {
  try {
    new URL(raw)
    return applySanitize(raw)
  } catch {
    return raw
  }
}

/** Sanitize an error value (string or Error.message) by masking sensitive query values. */
export function sanitizeError(err: unknown): string {
  const str = err instanceof Error ? (err.message ?? String(err)) : String(err)
  return applySanitize(str)
}

export function toPublicError(
  err: unknown,
): { error: string; requestId: string } {
  const id = crypto.randomUUID().slice(0, 8)
  console.error(`[${id}]`, sanitizeError(err))
  return { error: 'Internal Server Error', requestId: id }
}
