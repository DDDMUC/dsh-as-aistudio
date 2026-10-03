// dsh-as-aistudio - host half.
//
// Self-contained: the plugin list shows ONE row (this package). The four
// components are ordinary dependencies, not profile bundles, so they have no
// rows of their own and never appear there.
//
// Two jobs:
//
//   1. describe how a component's HOST half is mounted - which is not done
//      here. Each component has a row in cordis.patch.yml named
//      `dsh-as-aistudio/<suffix>` whose config.plugin names the component
//      package; src/shell.js is what that row mounts. The host half (its
//      loopback routes and its rollback / replay services) therefore stays in
//      the component package, and the Loader owns the row's lifetime and its
//      failure. pluginOf() is the shape judgement the shell shares with this
//      module, so there is one answer to "what is a plugin".
//
//   2. answer the only question the studio exists to answer:
//
//        GET /api/dsh-as-aistudio/status
//
//      For each component: is it installed, at which version, and is its row
//      REALLY live - read from ctx.loader.entries() and the row fiber's own
//      state, never from an optimistic record of what we hoped we mounted. The
//      browser half reads this to decide which vendored factories to mount, so
//      a component whose host half is not up can never be offered as a button
//      that cannot work.
//
// The module imports nothing from the DSH SDK - the loader and the web server
// are resolved through the cordis context at call time - so it loads and
// degrades on any profile (web, desktop, headless).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPONENTS, rowNameOf, STUDIO_ID, STUDIO_VERSION } from './components.js'

export const name = STUDIO_ID

const ROUTE_PREFIX = '/api/dsh-as-aistudio'

/**
 * The plugin callback inside a component module namespace, or null when the
 * module has no usable plugin shape.
 *
 * The judgement is the one this package has always applied - a function, or an
 * object carrying apply() - with one tolerance the components need:
 * dsh-edit-turn and dsh-delete-turn export `default`, dsh-rerun-turn and
 * dsh-markdown-bubble export only named members, so the module namespace itself
 * (which carries apply) is as valid as a default export. src/shell.js imports
 * this so there is exactly one answer to the question.
 *
 * @param namespace - the imported component module.
 * @returns the plugin to hand to ctx.plugin, or null.
 */
export function pluginOf(namespace) {
  if (namespace === null || namespace === undefined) return null
  const candidate = namespace.default ?? namespace.plugin ?? namespace
  if (typeof candidate === 'function') return candidate
  if (typeof candidate === 'object' && candidate !== null && typeof candidate.apply === 'function') return candidate
  return null
}

// --- package resolution --------------------------------------------------------

// A component is installed in the PROFILE, not in this checkout, so one anchor
// is not enough: the loader hands us the profile root, the process has a working
// directory, and this package may itself live under a node_modules.
export function resolveAnchors(ctx) {
  const anchors = []
  const push = (value) => {
    let dir = value
    if (typeof dir === 'string' && dir.startsWith('file://')) {
      try {
        dir = fileURLToPath(dir)
      } catch {
        return
      }
    }
    if (typeof dir !== 'string' || dir === '') return
    dir = resolve(dir)
    if (!anchors.includes(dir)) anchors.push(dir)
  }
  if (ctx) {
    if (typeof ctx.baseUrl === 'string') push(ctx.baseUrl)
    const loader = typeof ctx.get === 'function' ? safeGet(ctx, 'loader') : undefined
    if (loader && typeof loader.baseUrl === 'string') push(loader.baseUrl)
    if (loader && loader.ctx && typeof loader.ctx.baseUrl === 'string') push(loader.ctx.baseUrl)
  }
  if (typeof process.cwd === 'function') push(process.cwd())
  if (process.argv[1]) push(dirname(process.argv[1]))
  // Walk up from this file: the directory above the first node_modules is the
  // profile that installed this package.
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let depth = 0; depth < 8; depth += 1) {
      if (basename(dir) === 'node_modules') {
        push(dirname(dir))
        break
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {
    // no anchor from our own location; the others still apply
  }
  return anchors
}

function safeGet(ctx, service) {
  try {
    return ctx.get(service)
  } catch {
    return undefined
  }
}

/**
 * Resolve one component package from the profile.
 * @param pkg - the bare package name.
 * @param anchors - resolution anchors from resolveAnchors.
 * @returns what the running profile would load, or an honest absence.
 */
export function inspectPackage(pkg, anchors = resolveAnchors(undefined)) {
  let require
  try {
    require = createRequire(process.argv[1] ?? import.meta.url)
  } catch {
    require = createRequire(import.meta.url)
  }
  let manifestPath
  try {
    manifestPath = require.resolve(pkg + '/package.json', { paths: anchors })
  } catch {
    return { installed: false, version: null }
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    return {
      installed: true,
      version: typeof manifest.version === 'string' ? manifest.version : null,
      main: typeof manifest.main === 'string' ? manifest.main : null,
      path: dirname(manifestPath),
    }
  } catch (error) {
    return { installed: true, version: null, manifestError: String((error && error.message) || error) }
  }
}

// --- loader view ---------------------------------------------------------------

// Cordis fiber lifecycle states, named (cordis/lib: state 2 active, 3 failed
// after a rejected start, 5 unloading; 0 and 1 are the pre-start states).
const FIBER_ACTIVE = 2
const FIBER_FAILED = 3
const FIBER_UNLOADING = 5

/**
 * One row fiber's lifecycle as a word, so the status document never leaks raw
 * constants and never reports a mount it cannot see.
 * @param fiber - a Loader entry's fiber, or anything else.
 * @returns 'none' (the entry never started), 'starting', 'active', 'failed',
 *   'stopping', 'disposed', or 'unknown'.
 */
export function fiberStateOf(fiber) {
  if (fiber === null || fiber === undefined) return 'none'
  if (fiber.uid === null || fiber.uid === undefined) return 'disposed'
  if (typeof fiber.state !== 'number') return 'unknown'
  if (fiber.state === FIBER_ACTIVE) return 'active'
  if (fiber.state === FIBER_FAILED) return 'failed'
  if (fiber.state === FIBER_UNLOADING) return 'stopping'
  return 'starting'
}

/** Why a row that is not active is not active: the event vocabulary of /status. */
const FIBER_REASONS = {
  none: 'not-started',
  starting: 'starting',
  failed: 'start-failed',
  stopping: 'stopping',
  disposed: 'disposed',
  unknown: 'unknown-state',
}

/**
 * Every entry in the loader tree, flattened, or null when no loader is reachable.
 * @param ctx - the plugin context.
 * @returns one row per entry: id, name, disabled, and the row fiber's state.
 */
export function loaderEntries(ctx) {
  const loader = ctx && typeof ctx.get === 'function' ? safeGet(ctx, 'loader') : undefined
  if (!loader || typeof loader.entries !== 'function') return null
  const rows = []
  try {
    for (const entry of loader.entries()) {
      const options = entry && entry.options ? entry.options : {}
      rows.push({
        id: typeof options.id === 'string' ? options.id : null,
        name: typeof options.name === 'string' ? options.name : null,
        disabled: Boolean(entry && entry.disabled),
        fiberState: fiberStateOf(entry && entry.fiber ? entry.fiber : null),
      })
    }
  } catch {
    return null
  }
  return rows
}

/**
 * The loader's verdict on one component, with no optimism in it: the row has to
 * exist, be enabled, and have a fiber that reached 'active'.
 *
 * The row this studio inserts is named `<package>/<suffix>`; a component
 * installed standalone next to the studio answers under its own package name,
 * and that row counts too (it mounts the same host half - see docs/INTEROP.md
 * section 11 for why the studio's own row is preferred when both exist).
 *
 * @param component - a manifest entry.
 * @param entries - loaderEntries(ctx), or null when no loader is reachable.
 * @param installed - whether the component package resolves (inspectPackage).
 * @returns { hostMounted, hostReason, hostRow }: null/true/false, the reason
 *   when not mounted, and the row name that answered.
 */
export function hostStateOf(component, entries, installed) {
  const ownRow = rowNameOf(component)
  if (entries === null) return { hostMounted: null, hostReason: null, hostRow: null }
  const row = entries.find((entry) => entry.name === ownRow) ?? entries.find((entry) => entry.name === component.package) ?? null
  if (row === null) {
    return { hostMounted: false, hostReason: installed ? 'row-missing' : 'not-installed', hostRow: ownRow }
  }
  if (row.disabled) return { hostMounted: false, hostReason: 'disabled', hostRow: row.name }
  if (row.fiberState === 'active') return { hostMounted: true, hostReason: null, hostRow: row.name }
  // A dead row whose package does not resolve is a missing dependency, whatever
  // the fiber did: the shell's own import of it is the failure, and "not
  // installed" is the actionable half of that answer.
  if (!installed) return { hostMounted: false, hostReason: 'not-installed', hostRow: row.name }
  // A row that never started, with its package installed, is an entry the Loader
  // never got to (no fiber to inspect).
  const reason = row.fiberState === 'none' ? 'not-started' : FIBER_REASONS[row.fiberState] ?? 'unknown-state'
  return { hostMounted: false, hostReason: reason, hostRow: row.name }
}

/**
 * The status document: what is installed, what is mounted, and what the browser
 * half should therefore mount.
 * @param ctx - the plugin context (only get is used).
 * @returns the status document.
 */
export function statusOf(ctx) {
  const entries = loaderEntries(ctx)
  const anchors = resolveAnchors(ctx)
  const components = COMPONENTS.map((component) => {
    const found = inspectPackage(component.package, anchors)
    const host = hostStateOf(component, entries, found.installed)
    // A component that still appears as its own profile row is a real
    // configuration (a standalone install next to the studio). The loader merges
    // rows by id, so this is informational, not an error.
    const rows = entries === null ? null : entries.filter((entry) => entry.name === component.package)
    return {
      id: component.id,
      package: component.package,
      feature: component.feature,
      kind: component.kind,
      repo: component.repo,
      installed: found.installed,
      version: found.version,
      hostMounted: host.hostMounted,
      hostReason: host.hostReason,
      hostRow: host.hostRow,
      ownRows: rows === null ? null : rows.filter((row) => !row.disabled).length,
    }
  })
  const live = components.filter((component) => component.hostMounted === true)
  return {
    ok: true,
    plugin: STUDIO_ID,
    version: STUDIO_VERSION,
    dsh: dshVersion(),
    loaderVisible: entries !== null,
    components,
    summary: {
      total: components.length,
      installed: components.filter((component) => component.installed).length,
      mounted: live.length,
      combination: live.map((component) => component.id),
    },
  }
}

export function dshVersion() {
  try {
    const require = createRequire(process.argv[1] ?? import.meta.url)
    const manifest = JSON.parse(readFileSync(require.resolve('@deepseek-ai/dsh/package.json', { paths: resolveAnchors(undefined) }), 'utf8'))
    if (typeof manifest.version === 'string') return manifest.version
  } catch {
    // fall through to null
  }
  return null
}

// --- http ----------------------------------------------------------------------

function isLoopbackAddress(address) {
  if (typeof address !== 'string' || address.length === 0) return false
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address.startsWith('127.')
}

function isLocalHostHeader(hostHeader) {
  if (typeof hostHeader !== 'string' || hostHeader.length === 0) return false
  const bare = hostHeader.split(':')[0].replace(/^\[|\]$/g, '').toLowerCase()
  return bare === 'localhost' || bare === '127.0.0.1' || bare === '::1'
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

// Read-only, but it still names the local plugin topology: loopback socket,
// loopback Host header, and a same-origin check when the browser sends Origin.
function guard(req, res) {
  if (!isLoopbackAddress(req.socket && req.socket.remoteAddress)) {
    sendJson(res, 403, { ok: false, code: 'forbidden', error: 'loopback only' })
    return false
  }
  const hostHeader = req.headers.host
  if (!isLocalHostHeader(hostHeader)) {
    sendJson(res, 403, { ok: false, code: 'forbidden', error: 'unexpected host' })
    return false
  }
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.length > 0) {
    let originHost = null
    try {
      originHost = new URL(origin).host
    } catch {
      originHost = null
    }
    if (originHost !== hostHeader) {
      sendJson(res, 403, { ok: false, code: 'forbidden', error: 'cross-origin request' })
      return false
    }
  }
  return true
}

// --- plugin --------------------------------------------------------------------

export async function apply(ctx) {
  // Nothing is mounted here any more: the four component rows in
  // cordis.patch.yml mount the component host halves through src/shell.js, and
  // the Loader owns their lifetime. Mounting them here as well would run every
  // component twice in one process and collide on its routes.
  //
  // The status route reads the Loader per request, so it stays honest across a
  // row being disabled, restarted or added without touching this fiber.
  const registerRoutes = (webServer, fiber) => {
    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: ROUTE_PREFIX + '/status',
        handler: async (req, res) => {
          if (!guard(req, res)) return
          if (req.method !== 'GET') {
            sendJson(res, 405, { ok: false, code: 'method', error: 'GET only' })
            return
          }
          try {
            sendJson(res, 200, statusOf(ctx))
          } catch (error) {
            sendJson(res, 500, { ok: false, code: 'internal', error: String((error && error.message) || error) })
          }
        },
      }),
    )
  }

  const webServer = ctx.get('webServer')
  if (webServer) {
    registerRoutes(webServer, ctx)
  } else {
    ctx.inject(['webServer'], (sub) => registerRoutes(sub.webServer, sub))
  }
}
