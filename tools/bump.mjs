// Bump this package's version in the three places that legitimately carry it -
// and assert that NOTHING ELSE in those files changed.
//
// The rule this tool exists to enforce. Do not bump with a blind replace:
//
//     s.split('0.2.1').join('0.2.2')        // WRONG
//
// That also rewrites every other string containing the old version. '^0.2.15'
// contains '0.2.1', so a dependency range silently became '^0.2.25' - a version
// that has never existed - and the package shipped unable to install at all.
// It also rewrote a DSH release key ('0.2.0-rc.1' -> '0.2.1-rc.1'), which has
// nothing to do with this package's version.
//
//   node tools/bump.mjs 0.2.3        # write
//   node tools/bump.mjs --check      # verify the three sites agree, write nothing
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** file, the one regex that matches its version literal, and a human name. */
const SITES = [
  { file: 'package.json', pattern: /(^\s*"version":\s*")([^"]+)(")/m, label: 'package.json version' },
  { file: 'src/components.js', pattern: /(export const STUDIO_VERSION = ')([^']+)(')/, label: 'STUDIO_VERSION' },
  { file: 'src/studio.js', pattern: /(const PLUGIN_VERSION = ')([^']+)(')/, label: 'PLUGIN_VERSION' },
]

function currentOf(site) {
  const text = readFileSync(join(root, site.file), 'utf8')
  const match = site.pattern.exec(text)
  if (match === null) throw new Error(site.label + ': the version literal is not in ' + site.file)
  return match[2]
}

const versions = SITES.map((site) => ({ ...site, current: currentOf(site) }))
const distinct = [...new Set(versions.map((v) => v.current))]

if (process.argv.includes('--check')) {
  if (distinct.length !== 1) {
    console.error('the three version sites disagree: ' + versions.map((v) => v.label + '=' + v.current).join(', '))
    process.exit(1)
  }
  console.log('the version is one number in three places: ' + distinct[0])
  process.exit(0)
}

const next = process.argv[2]
if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(next || '')) {
  console.error('usage: node tools/bump.mjs <semver>   (for example 0.2.3)')
  process.exit(2)
}
if (distinct.length !== 1) {
  console.error('refusing to bump: the three sites already disagree (' + distinct.join(', ') + '); fix them first')
  process.exit(2)
}
const from = distinct[0]
if (from === next) {
  console.error('already at ' + next)
  process.exit(2)
}

for (const site of versions) {
  const path = join(root, site.file)
  const before = readFileSync(path, 'utf8')
  const after = before.replace(site.pattern, (_m, head, _old, tail) => head + next + tail)
  if (before === after) throw new Error(site.label + ': nothing changed in ' + site.file)
  // The whole point: exactly one line may differ, and it must be the version line.
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  if (beforeLines.length !== afterLines.length) throw new Error(site.file + ': the line count changed')
  const changed = beforeLines.map((line, index) => (line === afterLines[index] ? null : index)).filter((index) => index !== null)
  if (changed.length !== 1) {
    throw new Error(site.file + ': expected exactly 1 changed line, got ' + changed.length + '; refusing to write')
  }
  writeFileSync(path, after)
  console.log('  ' + site.file + ':' + (changed[0] + 1) + '  ' + site.label + '  ' + from + ' -> ' + next)
}

console.log('')
console.log('bumped ' + from + ' -> ' + next + ' in ' + versions.length + ' places, nothing else touched.')
console.log('Now: node tools/verify-manifest.mjs, npm run build, npm test.')
