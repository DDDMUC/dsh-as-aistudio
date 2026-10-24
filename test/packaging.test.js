// Packaging and portability contract.
//
// Two things this studio must never get wrong, both invisible at runtime until
// they break:
//
//   1. The bundle patch is what turns the composition on, and its row NAMES are
//      load-bearing in both directions:
//        * this package's own row must be the BARE package name, because the
//          client-module scanner resolves `<name>/package.json` for the
//          `dsh.client` declaration; a subpath there would be cached as "not a
//          client package" and the browser half would silently never load;
//        * every component row must be a SUBPATH of this package, because the
//          plugin list is the set of package identities behind the active rows:
//          a subpath resolves to this one identity (one row in the list, the
//          user's hard requirement) and is skipped by the client scanner
//          (so it can never become a second browser source).
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
import { COMPONENTS, STUDIO_ID, STUDIO_VERSION, rowNameOf } from '../src/components.js'

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

/** Whether package.json `files` publishes this repo-relative path. */
function isShipped(rel) {
  return manifest.files.some((entry) => rel === entry || rel.startsWith(String(entry).replace(/\/$/, '') + '/'))
}

test('every shipped path exists and is published', () => {
  for (const entry of ['src/index.js', 'src/client.js', 'src/components.js', 'cordis.patch.yml', 'README.md', 'LICENSE', 'docs/INTEROP.md']) {
    readFileSync(join(root, entry), 'utf8')
    assert.ok(isShipped(entry), entry + ' is read at runtime but not published')
  }
  assert.ok(manifest.files.includes('cordis.patch.yml'))
  // The vendored copies beside the built bundle are a development artifact: the
  // bundle already contains those four halves, and the sync tests read the repo
  // copy. Shipping them again doubled the tarball (659 kB -> 158 kB without).
  for (const id of ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn', 'dsh-markdown-bubble']) {
    assert.equal(isShipped('src/vendor/' + id + '.js'), false, 'src/vendor must not ship: the bundle already carries ' + id)
  }
})

test('the components are vendored, not runtime dependencies', () => {
  // The studio mounts a component by importing the copy beside it
  // (src/vendor/host/<id>.js, written by tools/vendor.mjs). Installing the
  // studio therefore installs nothing else - and a component's fix reaches the
  // studio only through a re-vendor and a studio release, which is what keeps
  // the browser half and the host half on one version.
  for (const component of COMPONENTS) {
    assert.equal(manifest.dependencies?.[component.package], undefined, component.id + ' must not be a runtime dependency')
    assert.equal(typeof manifest.devDependencies?.[component.package], 'string', component.id + ' must stay a devDependency (the vendor tool reads it)')
    assert.ok(isShipped('src/vendor/host/' + component.id + '.js'), 'the vendored host half of ' + component.id + ' must ship')
  }
  assert.deepEqual(manifest.dependencies, {}, 'the studio installs alone')
})

test('nothing shipped reaches for a component package at runtime', () => {
  // The whole point of vendoring the host halves: an install of this package
  // must not need the component packages present. A dynamic import or a require
  // of one of them anywhere in the shipped runtime files would break exactly
  // that, so it is refused here rather than discovered on a user's machine.
  for (const file of ['src/index.js', 'src/shell.js', 'src/client.js']) {
    const source = readFileSync(join(root, file), 'utf8')
    for (const component of COMPONENTS) {
      assert.equal(
        source.includes("import('" + component.package + "')") || source.includes('import("' + component.package + '")'),
        false,
        file + ' imports ' + component.package + ' at runtime',
      )
    }
  }
  // src/components.js names them as DATA (the manifest), which is fine: what
  // matters is that the shell resolves a row to the vendored file.
  assert.match(readFileSync(join(root, 'src', 'shell.js'), 'utf8'), /vendor\/host\//)
})

test('each component is vendored once, and both halves carry the same version', () => {
  // The lockstep that the old dependency model could not promise: the browser
  // half and the host half are the SAME component version, or nothing is.
  for (const component of COMPONENTS) {
    const clientHeader = readFileSync(join(root, 'src', 'vendor', component.id + '.js'), 'utf8').split('\n').slice(0, 6).join('\n')
    const hostHeader = readFileSync(join(root, 'src', 'vendor', 'host', component.id + '.js'), 'utf8').split('\n').slice(0, 6).join('\n')
    const clientVersion = /v([0-9]+\.[0-9]+\.[0-9]+[^,)]*)/.exec(clientHeader)
    const hostVersion = /v([0-9]+\.[0-9]+\.[0-9]+[^,)]*)/.exec(hostHeader)
    assert.ok(clientVersion !== null, component.id + ': the browser half header names no version')
    assert.ok(hostVersion !== null, component.id + ': the host half header names no version')
    assert.equal(hostVersion[1], clientVersion[1], component.id + ': the two halves are vendored from different versions')
  }
})

/**
 * The patch is DATA, so it is parsed the way the platform parses it: one block
 * per inserted Loader row, each with an id, a module name, and - for the
 * component rows - the package the shell mounts.
 * @returns every row the patch inserts, in patch order.
 */
function patchRows() {
  const lines = patch.split('\n')
  const rows = []
  for (let index = 0; index < lines.length; index += 1) {
    const id = /^ {4}- id: (\S+)$/.exec(lines[index])
    if (id === null) continue
    const name = /^ {6}name: '([^']+)'$/.exec(lines[index + 1] ?? '')
    const plugin = /^ {8}plugin: '([^']+)'$/.exec(lines[index + 3] ?? '')
    rows.push({ id: id[1], name: name === null ? null : name[1], plugin: plugin === null ? null : plugin[1] })
  }
  return rows
}

test('the patch inserts the studio row plus exactly one row per component', () => {
  // Five rows, and the count is the point: the plugin detail page lists these
  // rows as the components a bundle contains, so a component missing here is a
  // component nobody can see, and a row the manifest does not know about is a
  // component nobody described.
  const rows = patchRows()
  assert.equal(rows.length, COMPONENTS.length + 1, 'one studio row and one row per component')
  assert.equal(rows[0].id, STUDIO_ID)
  assert.equal(rows[0].name, STUDIO_ID, 'the studio row name must be the bare package name')
  assert.equal(rows[0].name.includes('/'), false, 'a subpath name would never mount a client half')
  assert.equal(rows[0].plugin, null, 'the studio row mounts this package itself')

  COMPONENTS.forEach((component, index) => {
    const row = rows[index + 1]
    assert.equal(row.name, rowNameOf(component), component.id + ': the row name follows the manifest suffix')
    assert.equal(row.plugin, component.package, component.id + ': the row names the package the shell mounts')
  })
  // Every row id is unique, or the Loader merges two of them into one entry.
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
})

test('no patch row is named after a component package', () => {
  // This is the hard requirement expressed where it can break. The plugin list is
  // the deduplicated set of package identities behind the active rows, so a row
  // named 'dsh-edit-turn' would add a list row of its own - and the client-module
  // scanner would treat it as a second browser source for a component whose
  // browser half already travels inside this bundle. Only this package, or a
  // subpath of it, may be named.
  for (const row of patchRows()) {
    assert.ok(
      row.name === STUDIO_ID || String(row.name).startsWith(STUDIO_ID + '/'),
      row.name + ' is neither this package nor a subpath of it',
    )
    for (const component of COMPONENTS) {
      assert.notEqual(row.name, component.package, row.name + ' would occupy a list row of its own')
    }
  }
})

test('every component row resolves to the shell, and the exports map says so', () => {
  // Three things have to agree on the suffixes: the manifest (src/components.js),
  // the patch row names, and package.json exports. A suffix in one and not the
  // others is a row that cannot resolve to anything.
  const rowNames = patchRows().map((row) => row.name)
  const suffixes = new Set()
  for (const component of COMPONENTS) {
    assert.match(component.suffix, /^[a-z][a-z0-9-]*$/, component.id + ': suffix shape')
    assert.equal(suffixes.has(component.suffix), false, component.suffix + ' is used twice')
    suffixes.add(component.suffix)
    assert.equal(manifest.exports['./' + component.suffix], './src/shell.js', 'exports["./' + component.suffix + '"]')
    assert.ok(rowNames.includes(rowNameOf(component)), rowNameOf(component) + ' has no patch row')
  }
  // The shell is shipped and is a real file.
  assert.ok(isShipped('src/shell.js'))
  assert.match(readFileSync(join(root, 'src', 'shell.js'), 'utf8'), /export async function apply/)
})

test('the components are dependencies of a bundle, never profile bundles', () => {
  // A profile bundle would put a component in the plugin list under its own name,
  // which is the one thing this package exists to avoid.
  assert.equal(manifest.dsh.profile, undefined, 'this package is a bundle, not a profile')
  const bundles = manifest.dsh.profile?.bundles ?? []
  for (const component of COMPONENTS) assert.equal(bundles.includes(component.package), false)
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
  // XML namespaces are identifiers, not addresses: the vendored halves build
  // their icons with `xmlns="http://www.w3.org/2000/svg"`, which is not a fetch.
  const withoutNamespaces = client
    .replace(/https:\/\/github\.com/g, '')
    .replace(/xmlns="https?:\/\/[^"]*"/g, '')
  assert.equal(/https?:\/\//.test(withoutNamespaces), false, 'no absolute URL is fetched')
})

test('the host half imports nothing from the DSH SDK', () => {
  const host = readFileSync(join(root, 'src', 'index.js'), 'utf8')
  const imports = [...host.matchAll(/^import .* from '([^']+)'/gm)].map((match) => match[1])
  for (const spec of imports) {
    assert.equal(spec.startsWith('@deepseek-ai/'), false, spec + ' would pin the studio to one SDK build')
  }
})
