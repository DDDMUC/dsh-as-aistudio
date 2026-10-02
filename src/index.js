// dsh-as-aistudio - host half.
//
// Self-contained: the plugin list shows ONE row (this package). The four
// components are ordinary dependencies, not profile bundles, so they have no
// rows of their own and never appear there.
//
// Two jobs:
//
//   1. mount each component's HOST half. Those are the loopback routes and the
//      rollback / replay services the browser halves call. They stay where they
//      are - imported from the installed package and applied into this fiber -
//      because host code is invisible to the plugin list and duplicating it
//      would create a second thing to fix. A component that is absent is
//      reported, never fatal.
//
//   2. answer the only question the studio exists to answer:
//
//        GET /api/dsh-as-aistudio/status
//
//      For each component: is it installed, at which version, and is its host
//      half actually mounted (which is what makes its routes answer)? The
//      browser half reads this to decide which vendored factories to mount, so
//      a missing component can never be offered as a button that cannot work.
//
// The module imports nothing from the DSH SDK - the loader and the web server
// are resolved through the cordis context at call time - so it loads and
// degrades on any profile (web, desktop, headless).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPONENTS, STUDIO_ID, STUDIO_VERSION } from './components.js'

export const name = STUDIO_ID

const ROUTE_PREFIX = '/api/dsh-as-aistudio'

/**
 * Mount every component host half that can be imported.
 *
 * A host half is the component's own plugin function; applying it into this
 * fiber registers its routes exactly as its own bundle row would have. The
 * order is the manifest order (edit, rerun, delete, render) and each mount is
 * independent: one failing import or one throwing apply is reported and the
 * rest still mount, because any-subset-works is the whole point.
 *
 * @param ctx - this plugin's context.
 * @returns per component: mounted, and why not when applicable.
 */
export async function mountComponentHosts(ctx) {
  const mounted = new Map()
  for (const component of COMPONENTS) {
    let plugin
    try {
      // The components are dependencies of this package, so the bare specifier
      // resolves from the profile that installed the studio.
      const namespace = await import(component.package)
      plugin = namespace.default ?? namespace
    } catch (error) {
      mounted.set(component.id, { mounted: false, reason: 'import-failed', detail: String((error && error.message) || error) })
      continue
    }
    if (typeof plugin !== 'function' && !(typeof plugin === 'object' && plugin !== null && typeof plugin.apply === 'function')) {
      mounted.set(component.id, { mounted: false, reason: 'no-plugin-shape' })
      continue
    }
    try {
      const fiber = ctx.plugin(plugin)
      // A rejected start is still a start we know nothing about yet: record it
      // when it settles rather than leaving the row silently half-mounted.
      if (fiber && typeof fiber.then === 'function') {
        fiber.then(
          () => {},
          (error) => {
            console.error('[' + STUDIO_ID + '] component ' + component.id + ' failed to start:', error)
          },
        )
      }
      mounted.set(component.id, {
        mounted: true,
        dispose: typeof fiber !== 'undefined' && fiber !== null && typeof fiber.dispose === 'function' ? fiber.dispose.bind(fiber) : null,
      })
    } catch (error) {
      mounted.set(component.id, { mounted: false, reason: 'apply-failed', detail: String((error && error.message) || error) })
    }
  }
  return mounted
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

/** Every entry in the loader tree, flattened, or null when no loader is reachable. */
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
 * The status document: what is installed, what is mounted, and what the browser
 * half should therefore mount.
 * @param ctx - the plugin context (only get is used).
 * @param hosts - the host mount table from mountComponentHosts, when it has run;
 *   without it the route reports installed state only.
 * @returns the status document.
 */
export function statusOf(ctx, hosts = null) {
  const entries = loaderEntries(ctx)
  const anchors = resolveAnchors(ctx)
  const components = COMPONENTS.map((component) => {
    const found = inspectPackage(component.package, anchors)
    const host = hosts === null ? null : hosts.get(component.id) ?? null
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
      hostMounted: host === null ? null : host.mounted === true,
      hostReason: host === null || host.mounted === true ? null : host.reason,
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
  // The components mount first, so the status route can report the truth about
  // them the moment it answers.
  const hosts = await mountComponentHosts(ctx)
  ctx.effect(
    () => () => {
      // Children mount after their parent, so dispose in reverse.
      for (const component of [...COMPONENTS].reverse()) {
        const record = hosts.get(component.id)
        if (record && typeof record.dispose === 'function') {
          try {
            record.dispose()
          } catch (error) {
            console.warn('[' + STUDIO_ID + '] disposing ' + component.id + ' failed:', error)
          }
        }
      }
    },
    STUDIO_ID + ': component hosts',
  )

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
            sendJson(res, 200, statusOf(ctx, hosts))
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
