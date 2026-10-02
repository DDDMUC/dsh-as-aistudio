// Regenerate src/vendor/ from the four component repositories.
//
// The studio is self-contained: the plugin list shows ONE row (dsh-as-aistudio)
// and the four components are no longer separate entries, which is only possible
// because their browser halves travel inside this bundle. That makes this file
// the load-bearing one: a hand-maintained copy is a copy that drifts, so the
// vendored files are GENERATED, byte for byte, from the component sources, and
// the test suite fails when they are stale.
//
//   node tools/vendor.mjs           # rewrite src/vendor/
//   node tools/vendor.mjs --check   # verify src/vendor/ is current, write nothing
//
// The transform is deliberately minimal and mechanical. A component bundle
// registers its factory with the host module loader
// (window.__ModuleLoader__.load({ id, factory })); inside this package the
// factory is called directly, so the wrapper is replaced by a default export of
// the SAME factory body. Nothing inside the braces is touched. Anything that
// does not match that exact shape throws, so a component changing its bundle
// shape stops the build instead of producing a silent no-op.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
// The components live next to this package. --workspace overrides it so a test can
// drive this tool against a corrupted COPY of the package while still reading the
// real component sources.
const workspaceFlag = process.argv.indexOf('--workspace')
const workspace = workspaceFlag === -1 ? join(root, '..') : process.argv[workspaceFlag + 1]

/** Every component this package composes. The order is the mount order. */
const COMPONENTS = [
  { id: 'dsh-edit-turn', from: 'lib/client.js' },
  { id: 'dsh-rerun-turn', from: 'lib/client.js' },
  { id: 'dsh-delete-turn', from: 'src/client.js' },
  { id: 'dsh-markdown-bubble', from: 'src/client.js' },
]

/** Everything before the loader call must be comments, or the shape is not ours. */
function isOnlyComments(prefix) {
  return prefix
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim() === ''
}

const checkOnly = process.argv.includes('--check')
const generated = []
let stale = 0

for (const component of COMPONENTS) {
  const sourcePath = join(workspace, component.id, component.from)
  if (!existsSync(sourcePath)) {
    console.error('missing component source: ' + sourcePath)
    process.exit(2)
  }
  const source = readFileSync(sourcePath, 'utf8')
  const version = JSON.parse(readFileSync(join(workspace, component.id, 'package.json'), 'utf8')).version
  const sha = createHash('sha256').update(source).digest('hex').slice(0, 16)

  // The bundle is a comment block, the loader call, and the factory body. Find
  // the call, require that what precedes it is only comments, and that it runs to
  // the end of the file; then take the factory body verbatim.
  const trimmed = source.replace(/^\/\/# sourceMappingURL=.*$/gm, '').trimEnd()
  const CALL = 'window.__ModuleLoader__.load({'
  const at = trimmed.indexOf(CALL)
  if (at === -1 || !trimmed.endsWith('})')) {
    console.error(component.id + ': no loader call, or the file does not end with it; refusing to guess')
    process.exit(3)
  }
  if (!isOnlyComments(trimmed.slice(0, at))) {
    console.error(component.id + ': the loader call is preceded by something other than comments; refusing to guess')
    process.exit(3)
  }
  // The call ends with `},\n})` - the factory's own close brace, a comma, then
  // the load() close. Drop the last two characters and the comma between them.
  const inner = trimmed.slice(at + CALL.length, -2).replace(/,\s*$/, '')
  if (!inner.trimEnd().endsWith('}')) {
    console.error(component.id + ': the factory body does not end with its own close brace; refusing to guess')
    process.exit(3)
  }
  const spec = new RegExp("^\\s*id: '" + component.id + "',\\s*factory: ([\\s\\S]*)$").exec(inner)
  if (spec === null) {
    console.error(component.id + ': the loader call does not name this package as its id; refusing to guess')
    process.exit(3)
  }
  const factoryBody = spec[1].trim()

  const header = [
    '// ' + component.id + ' browser half, VENDORED by tools/vendor.mjs - DO NOT EDIT.',
    '//',
    '// Source: ../' + component.id + '/' + component.from + '  (v' + version + ', sha256 ' + sha + ')',
    '// Regenerate with `npm run vendor`; test/vendor-sync.test.js fails when this is stale.',
    '//',
    '// The component registers its factory with the host module loader; inside this',
    '// package the factory is called directly, so only the outer wrapper is replaced.',
    '// The factory body is the component own code, unchanged.',
    '',
  ].join('\n')
  const body = 'export default ' + factoryBody + '\n'
  const out = header + body

  generated.push({ id: component.id, target: join(root, 'src', 'vendor', component.id + '.js'), out, version, sha })
}

mkdirSync(join(root, 'src', 'vendor'), { recursive: true })
for (const file of generated) {
  const current = existsSync(file.target) ? readFileSync(file.target, 'utf8') : null
  if (current === file.out) continue
  if (checkOnly) {
    stale += 1
    console.log('STALE  ' + file.id + ' (component v' + file.version + ')')
    continue
  }
  writeFileSync(file.target, file.out)
  console.log('wrote  src/vendor/' + file.id + '.js  <- v' + file.version + ' sha256 ' + file.sha)
}

if (checkOnly && stale > 0) {
  console.error(stale + ' vendored bundle(s) are stale; run `npm run vendor`')
  process.exit(1)
}
if (!checkOnly) console.log('vendored ' + generated.length + ' browser halves')
