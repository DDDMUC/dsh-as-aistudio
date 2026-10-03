// Stitch src/client.js from src/studio.js and src/vendor/*.js into ONE bundle.
// The two .txt fragments hold the literal prologue and epilogue; each vendored
// factory is lifted out of its own bundle verbatim, so a component's code runs
// exactly as its own package ships it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const ORDER = ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn', 'dsh-markdown-bubble']
const CALL = 'window.__ModuleLoader__.load({'
const checkOnly = process.argv.includes('--check')

const read = (name) => readFileSync(join(root, 'tools', name), 'utf8')

function commentsOnly(prefix) {
  return prefix.split('\n').every((line) => {
    const t = line.trim()
    return t === '' || t.startsWith('//')
  })
}

function lift(source, id) {
  const text = source.replace(/\n+$/, '')
  const at = text.indexOf(CALL)
  if (at < 0) throw new Error(id + ': no loader call')
  if (!text.endsWith('})')) throw new Error(id + ': does not end with the loader call')
  if (!commentsOnly(text.slice(0, at))) throw new Error(id + ': code precedes the loader call')
  const inner = text.slice(at + CALL.length, text.length - 2).replace(/,\s*$/, '')
  if (!inner.trimEnd().endsWith('}')) throw new Error(id + ': factory body unterminated')
  // The source registers under its own id; the stitched bundle always registers
  // as this package, so only the id the source DECLARES is checked.
  const declared = /id: '([^']+)'/.exec(inner)
  if (declared === null) throw new Error(id + ': the loader call declares no id')
  const marker = 'factory:'
  return inner.slice(inner.indexOf(marker) + marker.length).trim()
}

function vendored(id) {
  const path = join(root, 'src', 'vendor', id + '.js')
  if (!existsSync(path)) throw new Error('missing src/vendor/' + id + '.js; run npm run vendor first')
  const source = readFileSync(path, 'utf8')
  const marker = 'export default '
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(id + ': not a vendored factory file')
  return source.slice(at + marker.length).replace(/\n+$/, '')
}

// The studio source is a whole bundle of its own; inside the stitched bundle its
// body belongs directly in this scope, so the arrow wrapper is removed. The body
// declares its own module/exports, which is exactly the var-hoisted shadowing the
// bundle expects (the same shape the four vendored factories use internally).
const studioArrow = lift(readFileSync(join(root, 'src', 'studio.js'), 'utf8'), 'dsh-as-aistudio')
if (!/^\(require\) => \{[\s\S]*\}$/.test(studioArrow)) throw new Error('dsh-as-aistudio: the studio source is not a single arrow factory')
const studio = studioArrow.replace(/^\(require\) => \{/, '').replace(/\}$/, '')
const parts = []
parts.push(read('head.txt'))
for (const id of ORDER) {
  parts.push('')
  parts.push('    // ===== vendored ' + id + ' =====')
  parts.push('    const factory_' + id.replace(/-/g, '_') + ' = ' + vendored(id))
}
// The table is keyed by COMPONENT ID, because that is what the studio looks up
// (VENDORED_TABLE[id] with id like 'dsh-edit-turn'). Emitting the bare factory
// names would build an object whose keys are the variable names instead, every
// lookup would be undefined, and every component would silently fail to mount -
// which is exactly the regression this line now prevents.
parts.push(
  read('tail.txt').replace(
    '__T__',
    ORDER.map((id) => JSON.stringify(id) + ': factory_' + id.replace(/-/g, '_')).join(', '),
  ),
)
parts.push(studio)
parts.push(read('tail2.txt'))

const text = parts.join('\n')
const target = join(root, 'src', 'client.js')
if (checkOnly) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : ''
  if (current !== text) { console.error('src/client.js is stale; run npm run build'); process.exit(1) }
  console.log('src/client.js is in sync')
} else {
  writeFileSync(target, text)
  console.log('wrote src/client.js: ' + text.length + ' bytes, ' + ORDER.length + ' vendored factories')
}
