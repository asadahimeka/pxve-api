const PRIVATE_RE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|0\.0\.0\.0|169\.254\.)/

// deno-lint-ignore require-await
export async function assertSafeUrl(
  input: string,
  opts?: { allowPrivate?: boolean },
): Promise<URL> {
  const u = new URL(input)
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`blocked protocol: ${u.protocol}`)
  }
  if (!opts?.allowPrivate && PRIVATE_RE.test(u.hostname)) {
    throw new Error(`blocked private: ${u.hostname}`)
  }
  if (
    ['169.254.169.254', 'metadata.google.internal', '100.100.100.200'].includes(
      u.hostname,
    )
  ) {
    throw new Error('blocked metadata')
  }
  const allow = Deno.env
    .get('PROXY_ALLOW_DOMAINS')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (allow?.length) {
    const ok = allow.some((d) => d.startsWith('*.') ? u.hostname.endsWith(d.slice(1)) : u.hostname === d)
    if (!ok) throw new Error(`not in allowlist: ${u.hostname}`)
  }
  const block = Deno.env
    .get('PROXY_BLOCK_DOMAINS')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? []
  if (
    block.some((d) => d.startsWith('*.') ? u.hostname.endsWith(d.slice(1)) : u.hostname === d)
  ) {
    throw new Error(`blocked domain: ${u.hostname}`)
  }
  return u
}
