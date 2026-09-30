// dsh-as-aistudio — host half.
//
// One loopback-only JSON route:
//
//   GET /api/dsh-as-aistudio/status
//
// It answers the only question the studio exists to answer: *which of my
// components are actually live right now?* For each component the manifest
// names, the host reports
//
//   installed — the package resolves from the running profile;
//   version   — the version that would load;
//   entries   — every loader entry naming that package, and whether it is
//               disabled;
//   mounted   — at least one enabled entry names it.
//
// This half owns no session state and appends nothing: it is a read-only view
// over the loader, so it cannot corrupt a turn even if a component is broken.
// The module imports nothing from the DSH SDK — `loader` and `webServer` are
// resolved through the cordis context at call time — so it loads and degrades
// on any profile (web, desktop, headless).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPONENTS, STUDIO_ID, STUDIO_VERSION } from './components.js'

export const name = STUDIO_ID

const ROUTE_PREFIX = '/api/dsh-as-aistudio'

// --- package resolution --------------------------------------------------------

// A component is installed in the *profile*, not in the harness checkout the
// host binary runs from, so one anchor is not enough: the plugin is asked for
// the profile it serves (ctx.baseUrl), the process working directory, the entry
// point, and — when this package itself was installed under a node_modules —
// the profile that owns that node_modules. The first anchor that resolves wins.
function resolver() {
  try {
    const entry = process.argv[1]
    return createRequire(entry ?? import.meta.url)
  } catch {
    return createRequire(import.meta.url)
  }
}

/**
 * Directories a bare package specifier may resolve from, most specific first.
 * @param ctx - the plugin context; `baseUrl` is the profile root when present.
 * @returns an ordered, de-duplicated list of resolution anchors.
 */
export function resolveAnchors(ctx) {
  const anchors = []
  const push = (value) => {
    // A cordis baseUrl is a file:// URL (dsh-app-boot sets
    // `pathToFileURL(dirname(config)) + '/'`), so it must be converted before
    // Node will accept it as a module resolution directory.
    let dir = value
    if (typeof dir === 'string' && dir.startsWith('file://')) {
      try {
        dir = fileURLToPath(dir)
      } catch {
        return
      }
    }
    if (typeof dir !== 'string' || dir === '') return
    // Normalise: a baseUrl carries a trailing separator, and Node appends
    // 'node_modules' to whatever it is handed.
    dir = resolve(dir)
    if (!anchors.includes(dir)) anchors.push(dir)
  }
  if (ctx) {
    if (typeof ctx.baseUrl === 'string') push(ctx.baseUrl)
    // The loader carries its own baseUrl (the profile root) when the plugin
    // context does not expose one.
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

/**
 * Resolve one component package from the profile.
 * @param pkg - the bare package name.
 * @param anchors - resolution anchors from {@link resolveAnchors}.
 * @returns what the running profile would load, or an honest absence.
 */
export function inspectPackage(pkg, anchors = resolveAnchors(undefined)) {
  const require = resolver()
  const paths = anchors
  let manifestPath
  try {
    manifestPath = require.resolve(pkg + '/package.json', { paths })
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

// Every entry in the tree, flattened. `ctx.loader` is provided by
// @cordisjs/plugin-loader on every profile; when it is somehow absent the view
// reports null rather than inventing an answer.
export // `ctx.get` is the cordis service accessor; a context stub without it (or a
// service that throws on access) must read as absent, never as a crash.
function safeGet(ctx, service) {
  try {
    return ctx.get(service)
  } catch {
    return undefined
  }
}

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
      })
    }
  } catch {
    return null
  }
  return rows
}

/**
 * Build the status payload. A pure function of the loader view plus the
 * filesystem, so the tests drive it with a stub loader and no server.
 * @param ctx - the plugin context (only `get` is used).
 * @returns the status document the browser half renders.
 */
export function statusOf(ctx) {
  const entries = loaderEntries(ctx)
  const anchors = resolveAnchors(ctx)
  const components = COMPONENTS.map((component) => {
    const found = inspectPackage(component.package, anchors)
    const mine = entries === null ? null : entries.filter((entry) => entry.name === component.package)
    const enabled = mine === null ? null : mine.filter((entry) => !entry.disabled).length
    return {
      id: component.id,
      package: component.package,
      feature: component.feature,
      kind: component.kind,
      repo: component.repo,
      installed: found.installed,
      version: found.version,
      entries: mine,
      enabledEntries: enabled,
      mounted: enabled === null ? null : enabled > 0,
    }
  })
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
      mounted: components.filter((component) => component.mounted === true).length,
      // What the studio is for: any subset works, and this is the subset.
      combination: components.filter((component) => component.mounted === true).map((component) => component.id),
    },
  }
}

// The host version, for the panel's compatibility line. Null when the studio
// runs against a checkout rather than an installed dsh.
export function dshVersion() {
  try {
    const require = resolver()
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

function isLocalHostHeader(host) {
  if (typeof host !== 'string' || host.length === 0) return false
  const bare = host.split(':')[0].replace(/^\[|\]$/g, '').toLowerCase()
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
  const host = req.headers.host
  if (!isLocalHostHeader(host)) {
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
    if (originHost !== host) {
      sendJson(res, 403, { ok: false, code: 'forbidden', error: 'cross-origin request' })
      return false
    }
  }
  return true
}

// --- plugin --------------------------------------------------------------------

export function apply(ctx) {
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
