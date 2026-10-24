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
import { dirname, join, relative } from 'node:path'
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
  { id: 'dsh-edit-turn', from: 'lib/client.js', hostFrom: 'lib/index.js' },
  { id: 'dsh-rerun-turn', from: 'lib/client.js', hostFrom: 'lib/index.js' },
  { id: 'dsh-delete-turn', from: 'src/client.js', hostFrom: 'src/index.js' },
  { id: 'dsh-markdown-bubble', from: 'src/client.js', hostFrom: 'src/index.js' },
]

/** Everything before the loader call must be comments, or the shape is not ours. */
function isOnlyComments(prefix) {
  return prefix
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim() === ''
}

/** The two platform packages the components import, and the module each becomes. */
const PLATFORM = [
  { spec: '@deepseek-ai/dsh-tools', alias: 'dshTools' },
  { spec: '@deepseek-ai/dsh-session', alias: 'dshSession' },
]

/**
 * One component's host half, made self-contained.
 *
 * Copied verbatim except for two mechanical rewrites, both required for the copy
 * to stand on its own inside this package:
 *
 *   1. a platform import becomes an import of `./_platform.js`, which resolves
 *      the package from the RUNNING harness. A copy of `dsh-session` inside this
 *      package would be a second module instance, and its `appendPluginRecord`
 *      cannot touch a Session the host created (its brand check throws);
 *   2. a relative import (`./logic.js`, `./patch.js`) is copied beside it under a
 *      component-qualified name, so two components that both ship a `logic.js`
 *      cannot collide.
 *
 * The two import forms the components use are rewritten explicitly, and any
 * other form is refused rather than guessed at:
 *
 *     import { defineTool } from '@deepseek-ai/dsh-tools'
 *       ->  import { dshTools } from './_platform.js'
 *           const { defineTool } = dshTools
 *     import * as sessionApi from '@deepseek-ai/dsh-session'
 *       ->  import { dshSession as sessionApi } from './_platform.js'
 *
 * @param component - the component table entry.
 * @param hostPath - absolute path of the component's host half.
 * @returns [{ name, text }] - the entry file first, then what it imports.
 */
function vendorHostHalf(component, hostPath) {
  const dir = dirname(hostPath)
  const extra = []

  const rewrite = (source, file) => {
    const destructures = []
    let out = source.replace(/^\/\/# sourceMappingURL=.*$/gm, '')
    for (const { spec, alias } of PLATFORM) {
      const quoted = spec.replace(/[/\\.]/g, (char) => '\\' + char)
      const namespace = new RegExp("^\\s*import \\* as (\\w+) from '" + quoted + "'", 'm')
      const named = new RegExp("^\\s*import \\{([^}]+)\\} from '" + quoted + "'", 'm')
      let match = namespace.exec(out)
      if (match !== null) {
        out = out.replace(match[0], "import { " + alias + ' as ' + match[1] + " } from './_platform.js'")
      }
      match = named.exec(out)
      if (match !== null) {
        out = out.replace(match[0], "import { " + alias + " } from './_platform.js'")
        destructures.push('const {' + match[1] + '} = ' + alias)
      }
      if (new RegExp("from '" + quoted + "'").test(out)) {
        console.error(component.id + ': ' + file + ' imports ' + spec + ' in a form this vendoring does not rewrite; refusing to guess')
        process.exit(3)
      }
    }
    // Relative modules: copied beside the entry, renamed per component.
    out = out.replace(/from '(\.\/[^']+\.js)'/g, (whole, rel) => {
      if (rel === './_platform.js') return whole
      const abs = join(dir, rel)
      if (!existsSync(abs)) {
        console.error(component.id + ': ' + file + ' imports ' + rel + ', which does not exist')
        process.exit(3)
      }
      const flat = component.id + '.' + rel.slice(2)
      if (!extra.some((entry) => entry.name === flat)) {
        extra.push({ name: flat, text: rewrite(readFileSync(abs, 'utf8'), rel) })
      }
      return "from './" + flat + "'"
    })
    if (destructures.length > 0) {
      // Hoisted bindings read from the resolved namespace, placed after the
      // last import so the file keeps one import block.
      const lines = out.split('\n')
      // The end of the import block, not the start of the last import: a
      // multi-line `import { ... } from '...'` ends on its `} from '...'` line.
      let lastImport = -1
      for (let index = 0; index < lines.length; index += 1) {
        if (/^import\b/.test(lines[index]) || /^\} from ['"]/.test(lines[index])) lastImport = index
      }
      lines.splice(lastImport + 1, 0, '', ...destructures, '')
      out = lines.join('\n')
    }
    return out
  }

  const entry = rewrite(readFileSync(hostPath, 'utf8'), component.hostFrom)
  return [{ name: component.id + '.js', text: entry.trimEnd() + '\n' }, ...extra.map((file) => ({ name: file.name, text: file.text.trimEnd() + '\n' }))]
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

  // The host half travels too: it is a plain ES module whose only imports are
  // node builtins and the platform's own packages, so one file is the whole
  // thing. Vendoring it is what lets the studio install with no runtime
  // dependency on the component packages at all.
  const hostPath = join(workspace, component.id, component.hostFrom)
  if (!existsSync(hostPath)) {
    console.error('missing component host half: ' + hostPath)
    process.exit(2)
  }
  for (const file of vendorHostHalf(component, hostPath)) {
    const hostSha = createHash('sha256').update(file.text).digest('hex').slice(0, 16)
    const hostHeader = [
      '// ' + component.id + ' host half (' + file.name + '), VENDORED by tools/vendor.mjs - DO NOT EDIT.',
      '//',
      '// Source: ../' + component.id + '/' + component.hostFrom.replace(/index\.js$/, file.name === component.id + '.js' ? 'index.js' : file.name.slice(component.id.length + 1)) + '  (v' + version + ', sha256 ' + hostSha + ')',
      '// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.',
      '//',
      '// src/shell.js imports the copy named after the component, which is why the',
      '// studio installs with no runtime dependency on the component package.',
      '',
    ].join('\n')
    generated.push({
      id: component.id + ' (host' + (file.name === component.id + '.js' ? '' : ': ' + file.name) + ')',
      target: join(root, 'src', 'vendor', 'host', file.name),
      out: hostHeader + file.text,
      version,
      sha: hostSha,
    })
  }
}

mkdirSync(join(root, 'src', 'vendor', 'host'), { recursive: true })
for (const file of generated) {
  const current = existsSync(file.target) ? readFileSync(file.target, 'utf8') : null
  if (current === file.out) continue
  if (checkOnly) {
    stale += 1
    console.log('STALE  ' + file.id + ' (component v' + file.version + ')')
    continue
  }
  writeFileSync(file.target, file.out)
  console.log('wrote  ' + relative(root, file.target) + '  <- v' + file.version + ' sha256 ' + file.sha)
}

if (checkOnly && stale > 0) {
  console.error(stale + ' vendored file(s) are stale; run `npm run vendor`')
  process.exit(1)
}
if (!checkOnly) console.log('vendored ' + generated.length + ' halves (' + COMPONENTS.length + ' browser + ' + COMPONENTS.length + ' host)')
