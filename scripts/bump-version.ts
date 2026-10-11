import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKAGE_JSON = path.join(repoRoot, 'package.json')
const APP_TS = path.join(repoRoot, 'src', 'app.ts')
const README_MD = path.join(repoRoot, 'README.md')
const README_EN = path.join(repoRoot, 'README.en.md')
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/

interface VersionTarget {
  label: string
  file: string
  read: RegExp
  write: RegExp
  format: (version: string) => string
}

const TARGETS: VersionTarget[] = [
  {
    label: 'package.json',
    file: PACKAGE_JSON,
    read: /"version":\s*"([^"]+)"/,
    write: /"version":\s*"[^"]+"/,
    format: v => `"version": "${v}"`,
  },
  {
    label: 'src/app.ts',
    file: APP_TS,
    read: /version:\s*'([^']+)'/,
    write: /version:\s*'[^']+'/,
    format: v => `version: '${v}'`,
  },
  {
    label: 'README.md',
    file: README_MD,
    read: /\/badge\/Version-([\d.]+)-blue/,
    write: /Version-\d+\.\d+\.\d+-blue/,
    format: v => `Version-${v}-blue`,
  },
  {
    label: 'README.en.md',
    file: README_EN,
    read: /\/badge\/Version-([\d.]+)-blue/,
    write: /Version-\d+\.\d+\.\d+-blue/,
    format: v => `Version-${v}-blue`,
  },
]

function readVersion(file: string, pattern: RegExp): string {
  const content = readFileSync(file, 'utf8')
  const matches = content.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : 'g'))
  if (!matches || matches.length !== 1) {
    throw new Error(`expected exactly 1 version match in ${file}, found ${matches?.length || 0}`)
  }
  const m = matches[0].match(pattern)
  if (!m || !m[1]) throw new Error(`cannot parse version in ${file}`)
  return m[1]
}

function currentVersions(): Array<{ label: string; version: string }> {
  return TARGETS.map(t => ({ label: t.label, version: readVersion(t.file, t.read) }))
}

function describeVersions(versions: Array<{ label: string; version: string }>): string {
  return versions.map(v => `${v.label}=${v.version}`).join(' ')
}

function bumpVersion(current: string, kind: string): string {
  const m = current.match(VERSION_RE)
  if (!m) throw new Error(`current version is not semver: ${current}`)
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])]
  switch (kind) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`unknown bump kind: ${kind} (expected major|minor|patch)`)
  }
}

function replaceOnce(file: string, pattern: RegExp, replacement: string, dryRun: boolean): void {
  const content = readFileSync(file, 'utf8')
  const matches = content.match(new RegExp(pattern.source, 'g'))
  if (!matches || matches.length !== 1) {
    throw new Error(`expected exactly 1 match in ${file}, found ${matches?.length || 0}; aborting without changes`)
  }
  if (dryRun) return
  writeFileSync(file, content.replace(pattern, replacement))
}

function usage(): string {
  return `usage: node scripts/bump-version.ts [major|minor|patch|--set X.Y.Z] [--dry-run] [--check]

syncs the project version in:
  - package.json ("version")
  - src/app.ts (OpenAPI info.version)
  - README.md / README.en.md (Version badge)

examples:
  node scripts/bump-version.ts --check            verify all files agree
  node scripts/bump-version.ts patch              1.9.1 -> 1.9.2
  node scripts/bump-version.ts --set 1.9.1        set an explicit version
  node scripts/bump-version.ts minor --dry-run    preview without writing`
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }

  const versions = currentVersions()
  for (const v of versions) console.log(`${v.label.padEnd(12)} ${v.version}`)
  const distinct = [...new Set(versions.map(v => v.version))]

  if (args.includes('--check')) {
    if (distinct.length !== 1) {
      console.error(`version mismatch: ${describeVersions(versions)}`)
      process.exit(1)
    }
    console.log('versions are in sync')
    return
  }

  if (distinct.length !== 1) {
    throw new Error(`version mismatch: ${describeVersions(versions)}; fix manually before bumping`)
  }
  const current = distinct[0]

  const dryRun = args.includes('--dry-run')
  const setIdx = args.indexOf('--set')
  const kind = args.find(a => ['major', 'minor', 'patch'].includes(a))
  let next: string
  if (setIdx !== -1) {
    const v = args[setIdx + 1]
    if (!v || !VERSION_RE.test(v)) throw new Error(`--set expects X.Y.Z, got: ${v || '(missing)'}`)
    next = v
  } else if (kind) {
    next = bumpVersion(current, kind)
  } else {
    console.log(usage())
    return
  }

  if (next === current) {
    console.log(`already at ${next}, nothing to do`)
    return
  }

  for (const t of TARGETS) replaceOnce(t.file, t.write, t.format(next), dryRun)
  const files = TARGETS.map(t => t.label).join(', ')
  console.log(`${dryRun ? '[dry-run] ' : ''}${current} -> ${next} (${dryRun ? 'no files written' : files})`)
}

try {
  main()
} catch (e) {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
}
