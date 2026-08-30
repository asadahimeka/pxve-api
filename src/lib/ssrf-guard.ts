const PRIVATE_RE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|0\.0\.0\.0|169\.254\.)/

const METADATA_HOSTS = ['169.254.169.254', 'metadata.google.internal', '100.100.100.200']

const DNS_CACHE_TTL_MS = 60_000
const DNS_TIMEOUT_MS = 2_000

/** DNS resolution cache: hostname → { ips: string[], expiresAt: number } */
const dnsCache = new Map<string, { ips: string[]; expiresAt: number }>()

/**
 * Check if a hostname (possibly bracketed IPv6 like "[::1]") is a private/reserved address.
 * Handles IPv4 private ranges, IPv6 loopback/unique-local/link-local, and IPv4-mapped IPv6.
 */
function isPrivateHost(hostname: string): boolean {
  // Strip brackets from IPv6 hostnames (Deno includes them in hostname)
  const h = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

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
  // Tolerate leading-zero hextets: ::ffff:0:c0a8:101, ::ffff:0:0:c0a8:101, etc.
  const ffffMatch = h.match(/^::ffff:(?:0+:)*([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (ffffMatch) {
    const high = parseInt(ffffMatch[1], 16)
    const low = parseInt(ffffMatch[2], 16)
    const ipv4 = `${(high >> 8) & 0xff}.${(high >> 0) & 0xff}.${(low >> 8) & 0xff}.${(low >> 0) & 0xff}`
    return PRIVATE_RE.test(ipv4)
  }

  // Legacy IPv4-compatible IPv6: ::<hex1>:<hex2> (e.g., ::c0a8:101 = ::192.168.1.1)
  // Treat same as IPv4-mapped — parse last two hextets as dotted-quad
  const legacyMatch = h.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (legacyMatch) {
    const high = parseInt(legacyMatch[1], 16)
    const low = parseInt(legacyMatch[2], 16)
    const ipv4 = `${(high >> 8) & 0xff}.${(high >> 0) & 0xff}.${(low >> 8) & 0xff}.${(low >> 0) & 0xff}`
    return PRIVATE_RE.test(ipv4)
  }

  return false
}

/** Check if an IP address string is private/reserved. */
function isPrivateIp(ip: string): boolean {
  if (PRIVATE_RE.test(ip)) return true
  if (METADATA_HOSTS.includes(ip)) return true

  // IPv6 private checks
  if (ip.includes(':')) {
    if (ip === '::1' || ip === '::') return true
    if (/^fd/i.test(ip) || /^fc/i.test(ip)) return true
    if (/^fe[89ab]/i.test(ip)) return true
  }

  return false
}

/**
 * Check whether a hostname is a literal IP (no DNS resolution needed).
 * Covers IPv4 dotted-quad and bracketed IPv6.
 */
function isLiteralIp(hostname: string): boolean {
  const h = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  // IPv4: four decimal groups
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  // IPv6: contains colon
  if (h.includes(':')) return true
  return false
}

/**
 * Resolve a hostname via DNS (A + AAAA) with timeout and cache.
 * Returns array of resolved IP strings. Throws on failure (block-on-error).
 */
async function resolveAndCheck(hostname: string): Promise<string[]> {
  const now = Date.now()
  const cached = dnsCache.get(hostname)
  if (cached && now < cached.expiresAt) {
    return cached.ips
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS)

  try {
    const [aRecords, aaaaRecords] = await Promise.all([
      Deno.resolveDns(hostname, 'A', { signal: controller.signal }).catch(() => [] as string[]),
      Deno.resolveDns(hostname, 'AAAA', { signal: controller.signal }).catch(() => [] as string[]),
    ])
    const ips = [...aRecords, ...aaaaRecords]
    if (ips.length === 0) {
      throw new Error(`DNS resolution returned no records: ${hostname}`)
    }
    dnsCache.set(hostname, { ips, expiresAt: now + DNS_CACHE_TTL_MS })
    return ips
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`DNS resolution timed out: ${hostname}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

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
  if (METADATA_HOSTS.includes(u.hostname)) {
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

  // DNS resolution check for non-literal-IP hostnames (nip.io bypass prevention)
  if (!isLiteralIp(u.hostname)) {
    const resolvedIps = await resolveAndCheck(u.hostname)
    if (!opts?.allowPrivate) {
      for (const ip of resolvedIps) {
        if (isPrivateIp(ip)) {
          throw new Error(`blocked resolved private: ${ip} (via ${u.hostname})`)
        }
      }
    }
  }

  return u
}
