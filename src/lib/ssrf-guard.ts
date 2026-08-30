const PRIVATE_RE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|0\.0\.0\.0|169\.254\.)/

/**
 * Check if a hostname (possibly bracketed IPv6 like "[::1]") is a private/reserved address.
 * Handles IPv4 private ranges, IPv6 loopback/unique-local/link-local, and IPv4-mapped IPv6.
 */
function isPrivateHost(hostname: string): boolean {
  // Strip brackets from IPv6 hostnames (Deno includes them in hostname)
  const h = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  // IPv4 private ranges (existing)
  if (PRIVATE_RE.test(h)) return true

  // IPv6 check: must contain ':' to be IPv6
  if (!h.includes(':')) return false

  // ::1 loopback, :: unspecified
  if (h === '::1' || h === '::') return true

  // fc00::/7 — unique local addresses (fc00:: to fdff::)
  if (/^fd/i.test(h) || /^fc/i.test(h)) return true

  // fe80::/10 — link-local (fe80:: to febf::)
  // First 10 bits: fe80 = 11111110 10000000, mask /10 = 11111111 11000000
  // So valid range: fe80, fe81, ..., febf → fe[89ab][0-9a-f]
  if (/^fe[89ab]/i.test(h)) return true

  // ::ffff:0:0/96 — IPv4-mapped IPv6 addresses
  // Deno normalizes to ::ffff:<hex1>:<hex2> (e.g., ::ffff:c0a8:101 for 192.168.1.1)
  const ffffMatch = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (ffffMatch) {
    const high = parseInt(ffffMatch[1], 16)
    const low = parseInt(ffffMatch[2], 16)
    const ipv4 = `${(high >> 8) & 0xff}.${(high >> 0) & 0xff}.${(low >> 8) & 0xff}.${(low >> 0) & 0xff}`
    return PRIVATE_RE.test(ipv4)
  }

  return false
}

// deno-lint-ignore require-await
export async function assertSafeUrl(
  input: string,
  opts?: { allowPrivate?: boolean },
): Promise<URL> {
  const u = new URL(input)
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`blocked protocol: ${u.protocol}`)
  }
  if (!opts?.allowPrivate && isPrivateHost(u.hostname)) {
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
