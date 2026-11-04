// Every vendored host half must resolve its own relative imports. A rename in
// the component repo once left `dsh-log-trim.vendor.verify-session-log.mjs`
// missing while `dsh-log-trim.js` still imported it; the scan only failed when
// a user actually triggered a trim, so nothing in the test suite caught it.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hostDir = join(root, 'src', 'vendor', 'host')
const pattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"](\.\/[^'"]+)['"]/g

test('every relative import in a vendored host half resolves to a shipped file', () => {
  const files = readdirSync(hostDir).filter((name) => /\.(?:m?js)$/.test(name))
  assert.ok(files.length > 0)
  const missing = []
  for (const name of files) {
    const source = readFileSync(join(hostDir, name), 'utf8')
    for (const match of source.matchAll(pattern)) {
      const target = join(hostDir, match[1].slice(2))
      if (!existsSync(target)) missing.push(name + ' -> ' + match[1])
    }
  }
  assert.deepEqual(missing, [], 'dangling vendored imports: ' + missing.join(', '))
})
