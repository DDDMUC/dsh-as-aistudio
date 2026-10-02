// The vendored copy cannot drift: these two gates fail the moment src/vendor/ or
// src/client.js no longer matches the component sources (or the studio source
// that generates them).
//
// Each case copies the package to a tmp dir and breaks THAT copy, so the
// repository is never touched by a negative test.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const ORDER = ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn', 'dsh-markdown-bubble']

const WORKSPACE = join(root, '..')

function check(script, cwd, extraArgs) {
  try {
    const args = [join(cwd, 'tools', script), '--check'].concat(extraArgs || [])
    execFileSync('node', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
    return 0
  } catch (error) {
    return typeof error.status === 'number' ? error.status : 1
  }
}

/**
 * Copy this package (without node_modules and .git) to a fresh tmp dir, so a
 * negative case can corrupt it safely.
 */
function copyPackage() {
  const dir = mkdtempSync(join(tmpdir(), 'as-aistudio-sync-'))
  execFileSync('bash', ['-c', 'mkdir -p "$1" && tar -C "$2" --exclude node_modules --exclude .git -cf - . | tar -C "$1" -xf -', '_', dir, root], { stdio: 'pipe' })
  return dir
}

test('src/vendor/ is in sync with the component sources', () => {
  assert.equal(check('vendor.mjs', root), 0, 'npm run verify:vendor must pass on the repository')
})

test('a stale vendored bundle fails the gate', () => {
  const copy = copyPackage()
  try {
    const target = join(copy, 'src', 'vendor', ORDER[0] + '.js')
    const source = readFileSync(target, 'utf8')
    writeFileSync(target, source + '\n// drift\n')
    // --workspace names the real component sources, which the copy cannot reach.
    assert.notEqual(check('vendor.mjs', copy, ['--workspace', WORKSPACE]), 0, 'a modified vendored bundle must fail')
  } finally {
    rmSync(copy, { recursive: true, force: true })
  }
})

test('src/client.js is in sync with src/studio.js and src/vendor/', () => {
  assert.equal(check('build.mjs', root), 0, 'npm run verify:build must pass on the repository')
})

test('a stale generated bundle fails the gate', () => {
  const copy = copyPackage()
  try {
    const target = join(copy, 'src', 'client.js')
    writeFileSync(target, readFileSync(target, 'utf8') + '\n// drift\n')
    assert.notEqual(check('build.mjs', copy), 0, 'a modified generated bundle must fail')
  } finally {
    rmSync(copy, { recursive: true, force: true })
  }
})

test('every vendored bundle carries the component version and a source stamp', () => {
  for (const id of ORDER) {
    const source = readFileSync(join(root, 'src', 'vendor', id + '.js'), 'utf8')
    const version = /^\/\/ Source: \S+  \(v([^,]+), sha256 ([0-9a-f]+)\)$/m.exec(source)
    assert.ok(version !== null, id + ': the vendored bundle carries no source stamp')
    const manifest = JSON.parse(readFileSync(join(root, 'src', 'vendor', id + '.js'), 'utf8').length ? readFileSync(join(root, '..', id, 'package.json'), 'utf8') : '{}')
    assert.equal(version[1], manifest.version, id + ': the stamp names v' + manifest.version)
  }
})

test('the generated bundle carries all four factories and the studio half', () => {
  const bundle = readFileSync(join(root, 'src', 'client.js'), 'utf8')
  for (const id of ORDER) assert.ok(bundle.includes('factory_' + id.replace(/-/g, '_')), id + ': its factory is missing')
  assert.ok(bundle.includes('VENDORED_TABLE'), 'the mount table is missing')
  assert.ok(bundle.includes('__DSH_AS_AISTUDIO__'), 'the studio half is missing')
  assert.ok(bundle.startsWith('// dsh-as-aistudio - browser half. GENERATED'), 'the bundle is not the generated one')
})

