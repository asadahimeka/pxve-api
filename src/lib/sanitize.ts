const SENSITIVE_KEYS = ['api_key', 'token', 'PHPSESSID', 'auth_token', 'ct0']

export function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    // Check if any sensitive keys are present via URL API
    const hasSensitive = SENSITIVE_KEYS.some((k) => u.searchParams.has(k))
    if (!hasSensitive) return raw
    // String-replace to avoid URL.toString() percent-encoding non-sensitive params
    return raw.replace(
      new RegExp(`([?&](?:${SENSITIVE_KEYS.join('|')})=)[^&]*`, 'gi'),
      (_, prefix) => `${prefix}***`,
    )
  } catch {
    return raw
  }
}

export function toPublicError(
  err: unknown,
): { error: string; requestId: string } {
  const id = crypto.randomUUID().slice(0, 8)
  console.error(`[${id}]`, err)
  return { error: 'Internal Server Error', requestId: id }
}
