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
import { COMPONENTS, STUDIO_ID, STUDIO_VERSION } from '../src/components.js'

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

// The version lives in three places (package.json, src/components.js for the
// host half and the panel, src/client.js for the bundle the browser loads), and
// a build that ships two of them out of step is how a stale browser half gets
// mistaken for a missing one. AGENTS.md promises this test exists.
test('the studio version is one number in three places', () => {
  assert.equal(manifest.version, STUDIO_VERSION, 'package.json and src/components.js disagree')
  assert.ok(
    client.includes("const PLUGIN_VERSION = '" + manifest.version + "'"),
    'src/client.js does not carry PLUGIN_VERSION ' + manifest.version,
  )
})

test('every shipped path exists and is published', () => {
  for (const entry of ['src/index.js', 'src/client.js', 'src/components.js', 'cordis.patch.yml', 'README.md', 'LICENSE', 'docs/INTEROP.md']) {
    readFileSync(join(root, entry), 'utf8')
  }
  assert.ok(manifest.files.includes('src'))
  assert.ok(manifest.files.includes('cordis.patch.yml'))
})

test('the components are HARD dependencies, because the studio mounts their host halves', () => {
  // The studio imports each component and applies its host half into this fiber.
  // An optional dependency could be absent, and then its routes would 404 while
  // the vendored browser half still offered a button — the "advertised but cannot
  // work" failure this package exists to avoid. (Optional was the old design,
  // when the components mounted themselves through their own rows.)
  assert.equal(manifest.optionalDependencies, undefined, 'no component may be optional any more')
  for (const component of COMPONENTS) {
    assert.equal(typeof manifest.dependencies[component.package], 'string', component.id + ' must be a hard dependency')
  }
})

test('the patch inserts exactly ONE row, and it is the studio', () => {
  // Self-contained: the components are dependencies, not profile bundles, so they
  // have no rows of their own and never appear in the plugin list. Verified live:
  // the composed tree carries zero component rows.
  const rows = [...patch.matchAll(/^ {4}- id: (\S+)\n {6}name: '([^']+)'$/gm)].map((match) => ({ id: match[1], name: match[2] }))
  assert.equal(rows.length, 1, 'the studio inserts exactly one row')
  assert.equal(rows[0].id, STUDIO_ID)
  assert.equal(rows[0].name, rows[0].id, 'the row name must be the bare package name')
  assert.equal(rows[0].name.includes('/'), false, 'a subpath name would never mount a client half')
})

test('the patch file is pure data with no YAML anchors or tabs', () => {
  assert.equal(patch.includes('\t'), false)
  assert.equal(/^\s*(&|\*)\w+\s*$/m.test(patch), false)
})

// The portability tripwire: web and desktop share this bundle, so the forbidden
// list is exactly the calls that only exist, or only behave, in one of them.
//
// It reads src/studio.js — the half THIS package writes. The generated
// src/client.js also carries the four component bundles verbatim, and they use
// MutationObserver (their DOM passes) and innerHTML (icons) perfectly
// legitimately; each component is tripwired in its own repository, and the
// live gates verify the composed page. Scanning the generated bundle here would
// flag code this package does not own.
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

test('the studio own browser half touches no web-only global', () => {
  const studio = readFileSync(join(root, 'src', 'studio.js'), 'utf8')
  for (const [label, pattern] of FORBIDDEN) {
    assert.equal(pattern.test(studio), false, 'src/studio.js must not use ' + label)
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
