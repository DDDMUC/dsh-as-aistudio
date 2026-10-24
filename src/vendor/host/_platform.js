// The platform packages a vendored component host half may import.
//
// A component copied into this package must NOT get its own copy of
// `@deepseek-ai/dsh-session`: two module instances mean two registries, and the
// second copy's `appendPluginRecord` cannot touch a Session the host created
// (the brand check inside it throws). The same goes for `dsh-tools`, whose
// `defineTool` builds validators against schemas the host's own tool registry
// expects.
//
// So the copies import THIS file, and this file resolves the two packages from
// the running harness. The harness lives in the `dsh` installation, so the base
// is found by walking up from this file to the nearest node_modules that has it,
// with the profile's own tree as the second try. A failure here is a failure of
// the whole component row and says exactly which package was missing - silence
// would report a component that never started.

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Candidate base directories, nearest-first, for resolving a platform package.
 *
 * Two roots, because a plugin is loaded from one tree and the harness runs from
 * another: this file's own ancestors (a profile that installed the packages
 * beside it), then the RUNNING process's entry point - `process.argv[1]` is the
 * `dsh` binary, and the platform packages sit in that installation's
 * `node_modules`. ESM resolves relative to the importing FILE, so the second
 * root has to be built by hand.
 *
 * @returns directory list to try with createRequire.
 */
function bases() {
  const out = []
  const seen = new Set()
  const add = (start) => {
    if (typeof start !== 'string' || start === '') return
    let node = start
    for (let up = 0; up < 10; up += 1) {
      const candidate = join(node, 'node_modules')
      if (!seen.has(candidate) && existsSync(candidate)) {
        seen.add(candidate)
        out.push(candidate)
      }
      const parent = dirname(node)
      if (parent === node) break
      node = parent
    }
  }
  add(here)
  add(typeof process !== 'undefined' && process.argv ? process.argv[1] : '')
  add(typeof process !== 'undefined' ? process.cwd() : '')
  return out
}

/**
 * Resolve one platform package and import it as ESM.
 *
 * @param spec - the platform package name.
 * @returns its module namespace.
 * @throws when no candidate base can resolve it, naming the specifier.
 */
async function importPlatform(spec) {
  for (const base of bases()) {
    try {
      const url = createRequire(join(base, 'noop.js')).resolve(spec)
      return await import(url)
    } catch {
      continue
    }
  }
  // Last resort: the bare specifier, which works when the caller (the profile)
  // can already resolve it.
  try {
    return await import(spec)
  } catch (error) {
    throw new Error(
      'dsh-as-aistudio: the platform package ' +
        JSON.stringify(spec) +
        ' could not be resolved from ' +
        here +
        '; it ships with the dsh installation, so this copy is being loaded outside a harness (' +
        String((error && error.message) || error) +
        ')',
      { cause: error },
    )
  }
}

/**
 * Resolve one platform package, or fail with a message that names it.
 *
 * Eager on purpose: a component whose platform package is missing must fail its
 * row loudly (the Loader records the reason and /status reports hostMounted:
 * false), never mount half a feature and answer "unsupported" forever after.
 *
 * @param spec - the platform package name.
 * @returns its module namespace.
 */
async function importPlatformOrThrow(spec) {
  for (const base of bases()) {
    try {
      const url = createRequire(join(base, 'noop.js')).resolve(spec)
      return await import(url)
    } catch {
      continue
    }
  }
  try {
    return await import(spec)
  } catch (error) {
    throw new Error(
      'dsh-as-aistudio: the platform package ' +
        JSON.stringify(spec) +
        ' could not be resolved from ' +
        here +
        '; it ships with the dsh installation, so this copy is being loaded outside a harness (' +
        String((error && error.message) || error) +
        ')',
      { cause: error },
    )
  }
}

/** `@deepseek-ai/dsh-tools`, resolved from the running harness. */
export const dshTools = await importPlatformOrThrow('@deepseek-ai/dsh-tools')

/** `@deepseek-ai/dsh-session`, resolved from the running harness. */
export const dshSession = await importPlatformOrThrow('@deepseek-ai/dsh-session')
