// Gate the manifest against the registry before publishing.
//
// This is the check whose absence shipped a broken release: dsh-as-aistudio@0.2.2
// declared 'dsh-edit-turn': '^0.2.25'. No such version exists (the latest is
// 0.2.15), so `pnpm add dsh-as-aistudio@0.2.2` failed with
// ERR_PNPM_NO_MATCHING_VERSION and the package could not be installed at all -
// while every test that exercised the bundle inside it passed, because unpacking
// a tarball never resolves its dependencies.
//
//   node tools/verify-manifest.mjs        # exit 1 on any unresolvable range
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
let failed = 0

// 1. every dependency range must resolve to a published version
const deps = Object.entries(manifest.dependencies || {})
if (deps.length === 0) {
  console.error('no dependencies declared; that is not the shape of this package')
  failed += 1
}
for (const [name, range] of deps) {
  let resolved = ''
  try {
    resolved = execFileSync('npm', ['view', name + '@' + range, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop().trim()
  } catch (error) {
    resolved = ''
  }
  if (resolved === '') {
    console.error('  UNRESOLVABLE  ' + name + '@' + range + '  <- no published version satisfies this')
    failed += 1
  } else {
    console.log('  ok            ' + name + '@' + range + ' -> ' + resolved)
  }
}

// 2. the version must be one number in the three places that carry it
const sites = [
  ['package.json', /(^\s*"version":\s*")([^"]+)(")/m],
  ['src/components.js', /(export const STUDIO_VERSION = ')([^']+)(')/],
  ['src/studio.js', /(const PLUGIN_VERSION = ')([^']+)(')/],
]
const found = sites.map(([file, pattern]) => {
  const match = pattern.exec(readFileSync(join(root, file), 'utf8'))
  return { file, version: match === null ? null : match[2] }
})
const distinct = [...new Set(found.map((s) => s.version))]
if (distinct.length !== 1 || distinct[0] === null) {
  console.error('  VERSION DRIFT ' + found.map((s) => s.file + '=' + s.version).join(', '))
  failed += 1
} else {
  console.log('  ok            version ' + distinct[0] + ' in all three places')
}

// 3. DSH compatibility keys must look like DSH releases, not like this package
const releases = Object.keys(manifest.dsh?.compatibility?.dshReleases || {})
if (releases.length === 0) {
  console.error('  NO DSH RELEASES declared in dsh.compatibility.dshReleases')
  failed += 1
}
for (const release of releases) {
  if (!/^0\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(release)) {
    console.error('  BAD DSH KEY   ' + release + ' does not look like a DSH release')
    failed += 1
  }
}

console.log('')
if (failed > 0) {
  console.error(failed + ' manifest problem(s); do not publish')
  process.exit(1)
}
console.log('manifest ok: ' + deps.length + ' dependency ranges resolve, version ' + distinct[0] + ' consistent')
