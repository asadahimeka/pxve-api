/**
 * Runtime adapter: the only place (besides `node:`-native modules that stay
 * as-is) allowed to touch environment/argv/platform differences.
 *
 * Dual-read strategy: prefer `process.env`/`process.argv` (Node), fall back
 * to `Deno.env`/`Deno.args` when running under Deno. This keeps the existing
 * `deno task test` suite green during the migration while the production
 * entry (`src/server.ts`) runs on Node.
 */

interface NodeProcessLike {
  env?: Record<string, string | undefined>
  argv?: string[]
}

interface DenoLike {
  env?: { get?: (key: string) => string | undefined }
  args?: string[]
}

function nodeProcess(): NodeProcessLike | undefined {
  const p = (globalThis as unknown as { process?: NodeProcessLike }).process
  return p && typeof p === 'object' ? p : undefined
}

function denoNs(): DenoLike | undefined {
  const d = (globalThis as unknown as { Deno?: DenoLike }).Deno
  return d && typeof d === 'object' ? d : undefined
}

export function getEnv(name: string, fallback?: string): string | undefined {
  return nodeProcess()?.env?.[name] ?? denoNs()?.env?.get?.(name) ?? fallback
}

export function getNumberEnv(name: string, fallback: number): number {
  const raw = getEnv(name)
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function getCommaEnv(name: string): string[] {
  const raw = getEnv(name)
  return raw?.trim()?.split(',')?.map(s => s.trim())?.filter(Boolean) || []
}

export function hasFlag(flag: string): boolean {
  return nodeProcess()?.argv?.includes(flag) || denoNs()?.args?.includes(flag) || false
}
