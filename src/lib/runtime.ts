/**
 * Runtime adapter: the only place (besides `node:`-native modules that stay
 * as-is) allowed to touch environment/argv/platform differences.
 *
 * Dual-read strategy: prefer `process.env`/`process.argv` (Node), fall back
 * to `Deno.env`/`Deno.args` when running under Deno. This keeps the existing
 * `deno task test` suite green during the migration while the production
 * entry (`src/server.ts`) runs on Node.
 */

import { execFile } from 'node:child_process'
import {
  mkdir as fsMkdir,
  mkdtemp as fsMkdtemp,
  readFile as fsReadFile,
  rm as fsRm,
  writeFile as fsWriteFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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

export function platformIsWindows(): boolean {
  const platform = nodeProcess()?.platform
  if (typeof platform === 'string') return platform === 'win32'
  const d = (globalThis as unknown as { Deno?: { build?: { os?: string } } }).Deno
  return d?.build?.os === 'windows'
}

export function makeTempDir(prefix = 'pxve-'): Promise<string> {
  return fsMkdtemp(join(tmpdir(), prefix))
}

export async function ensureDirRecursive(path: string): Promise<void> {
  await fsMkdir(path, { recursive: true })
}

export async function writeFile(path: string, data: Uint8Array): Promise<void> {
  await fsWriteFile(path, data)
}

export async function readFile(path: string): Promise<Uint8Array> {
  return fsReadFile(path)
}

export async function removeRecursive(path: string): Promise<void> {
  await fsRm(path, { recursive: true, force: true })
}

export interface CmdResult {
  success: boolean
  stdout: Uint8Array
  stderr: Uint8Array
}

/**
 * Run an executable directly, no shell (matches old `new Deno.Command(cmd, {args})`).
 * Non-zero exit resolves `{success: false}` with captured output; a timeout
 * (or being killed) throws so callers can distinguish hangs from failures.
 */
export async function runCmd(cmd: string, args: string[], opts?: { timeoutMs?: number }): Promise<CmdResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: opts?.timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'buffer',
    })
    return { success: true, stdout: stdout as Uint8Array, stderr: stderr as Uint8Array }
  } catch (e: any) {
    if (e?.killed) {
      throw new Error(`command timeout after ${opts?.timeoutMs}ms: ${cmd} ${args.join(' ')}`)
    }
    if (typeof e?.code === 'number') {
      return {
        success: false,
        stdout: e.stdout ?? new Uint8Array(),
        stderr: e.stderr ?? new Uint8Array(),
      }
    }
    throw e
  }
}
