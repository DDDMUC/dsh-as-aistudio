// Packaging and portability contract.
//
// Two things this studio must never get wrong, both invisible at runtime until
// they break:
//
//   1. The bundle patch is what turns the composition on. A row must be named by
//      the component's BARE package name, because the client-module scanner
//      resolves `<name>/package.json` for the `dsh.client` declaration; a
//      subpath would be cached as "not a client package" and the browser half
//      would silently never load.
//   2. The browser half runs unchanged in the desktop shell, so it must not
//      reach for a web-profile-only global. This test is the tripwire: it fails
//      the moment such a call is added.
//
//   node --test "test/*.test.js"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { COMPONENTS, STUDIO_ID } from '../src/components.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const client = readFileSync(join(root, 'src', 'client.js'), 'utf8')
// Comments name the calls this bundle deliberately does NOT make ("no
// MutationObserver, no row injection"), so the tripwire reads code only.
const clientCode = client.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('the package declares the bundle and client contract', () => {
  assert.equal(manifest.name, STUDIO_ID)
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.match(manifest.dsh.engines.dsh, /^>=/)
  assert.equal(manifest.exports['.'], './src/index.js')
  assert.equal(manifest.exports['./client'], './src/client.js')
})

test('every shipped path exists and is published', () => {
  for (const entry of ['src/index.js', 'src/client.js', 'src/components.js', 'cordis.patch.yml', 'README.md', 'LICENSE', 'docs/INTEROP.md']) {
    readFileSync(join(root, entry), 'utf8')
  }
  assert.ok(manifest.files.includes('src'))
  assert.ok(manifest.files.includes('cordis.patch.yml'))
})

test('the components are optional dependencies, never hard ones', () => {
  for (const component of COMPONENTS) {
    assert.equal(manifest.dependencies?.[component.package], undefined, component.id + ' must not be a hard dependency')
    assert.equal(typeof manifest.optionalDependencies[component.package], 'string', component.id + ' must be optional')
  }
})

test('the patch inserts one bare-named row per participant', () => {
  const rows = [...patch.matchAll(/^ {4}- id: (\S+)\n {6}name: '([^']+)'$/gm)].map((match) => ({ id: match[1], name: match[2] }))
  assert.equal(rows.length, COMPONENTS.length + 1, 'one studio row plus one row per component')
  assert.deepEqual(rows.map((row) => row.id), [STUDIO_ID, ...COMPONENTS.map((component) => component.id)])
  for (const row of rows) {
    assert.equal(row.name, row.id, row.id + ': the row name must be the bare package name')
    assert.equal(row.name.includes('/'), false, row.id + ': a subpath name would never mount a client half')
  }
})

test('the patch file is pure data with no YAML anchors or tabs', () => {
  assert.equal(patch.includes('\t'), false)
  assert.equal(/^\s*(&|\*)\w+\s*$/m.test(patch), false)
})

// The portability tripwire: web and desktop share this bundle, so the forbidden
// list is exactly the calls that only exist, or only behave, in one of them.
const FORBIDDEN = [
  ['location.origin', /location\.origin/],
  ['location.port', /location\.port/],
  ['window.open', /window\.open\s*\(/],
  ['showDirectoryPicker', /showDirectoryPicker/],
  ['navigator.*', /navigator\.[a-zA-Z]/],
  ['__DSH_BOOT__', /__DSH_BOOT__/],
  ['MutationObserver', /MutationObserver/],
  ['addEventListener', /addEventListener/],
  ['innerHTML', /innerHTML/],
  ['localStorage', /localStorage/],
]

test('the browser half touches no web-only global', () => {
  for (const [label, pattern] of FORBIDDEN) {
    assert.equal(pattern.test(clientCode), false, 'src/client.js must not use ' + label)
  }
})

test('the browser half fetches one relative route', () => {
  const routes = [...client.matchAll(/'(\/api\/[a-z0-9-]+\/[a-z0-9-]+)'/g)].map((match) => match[1])
  assert.deepEqual(routes, ['/api/dsh-as-aistudio/status'])
  assert.equal(/https?:\/\//.test(client.replace(/https:\/\/github\.com/g, '')), false, 'no absolute URL is fetched')
})

test('the host half imports nothing from the DSH SDK', () => {
  const host = readFileSync(join(root, 'src', 'index.js'), 'utf8')
  const imports = [...host.matchAll(/^import .* from '([^']+)'/gm)].map((match) => match[1])
  for (const spec of imports) {
    assert.equal(spec.startsWith('@deepseek-ai/'), false, spec + ' would pin the studio to one SDK build')
  }
})
