const SENSITIVE_KEYS = ['api_key', 'token', 'PHPSESSID', 'auth_token', 'ct0']

export function sanitizeUrl(raw: string): string {
  try {
    new URL(raw)
    // Always apply case-insensitive regex replace — the regex already handles
    // all case variants (gi flag). The old searchParams.has() guard was
    // case-sensitive and caused uppercase variants like API_KEY to leak through.
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
