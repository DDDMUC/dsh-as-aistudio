// Host-half tests: what the studio reports about the four component rows, and
// the status route that reports it.
//
// Since the row rewrite the studio mounts NOTHING itself. Each component is
// mounted by its own row in cordis.patch.yml (src/shell.js is what that row
// resolves to), and /status reads the Loader to say whether that row is really
// live. So the interesting questions are all about that reading: a row that
// never started, one the user disabled, one whose fiber failed after starting -
// and the rule that none of them may be reported as mounted.
//
//   node --test test/*.test.js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, fiberStateOf, hostStateOf, inspectPackage, loaderEntries, name, resolveAnchors, statusOf } from '../src/index.js'
import { COMPONENTS, STUDIO_ID, rowNameOf } from '../src/components.js'

/** A webServer stub that records the registrations. */
function webServerStub() {
  const routes = new Map()
  return {
    routes,
    webServer: {
      register(route) {
        routes.set(route.path, route)
        return () => routes.delete(route.path)
      },
    },
  }
}

/**
 * A context stub. The host half resolves services lazily, so the loader and the
 * webServer are handed over through get(); plugin() records the mounts, which
 * since the row rewrite must stay empty.
 */
function contextStub(options = {}) {
  const server = webServerStub()
  const mounted = []
  const ctx = {
    get: (service) => {
      if (service === 'webServer') return server.webServer
      if (service === 'loader') return options.loader
      return undefined
    },
    plugin: (fn) => {
      mounted.push(fn)
      return { dispose() {} }
    },
    effect: (factory) => {
      const disposer = factory()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
    inject: (services, factory) => {
      if (options.injectHook) options.injectHook(services, factory)
    },
    on: () => {},
    logger: { warn: () => {}, error: () => {}, debug: () => {}, info: () => {} },
  }
  return { ctx, server, mounted }
}

/** A live row fiber: active, and not disposed. */
function liveFiber(uid) {
  return { uid, state: 2 }
}

/**
 * The loader as the studio sees it: its own row, then one row per component,
 * each named `dsh-as-aistudio/<suffix>` exactly as the bundle patch inserts it.
 * @param shape - per component override: { fiber, disabled, name }.
 */
function loaderRows(shape = () => ({})) {
  const rows = [{ options: { id: STUDIO_ID, name: STUDIO_ID }, disabled: false, fiber: liveFiber(9) }]
  COMPONENTS.forEach((component, index) => {
    const override = shape(component, index) || {}
    rows.push({
      options: { id: 'dsh-as-aistudio-' + component.suffix, name: override.name ?? rowNameOf(component) },
      disabled: Boolean(override.disabled),
      fiber: 'fiber' in override ? override.fiber : liveFiber(20 + index),
    })
  })
  return rows
}

/** loaderEntries(ctx) against a flat row list. */
function entriesOf(rows) {
  return loaderEntries({ get: (service) => (service === 'loader' ? { entries: () => rows } : undefined) })
}

/** statusOf(ctx) against a flat row list. */
function statusWith(rows) {
  return statusOf({ get: (service) => (service === 'loader' ? { entries: () => rows } : undefined) })
}

test('the host half names the studio', () => {
  assert.equal(name, 'dsh-as-aistudio')
})

test('resolveAnchors turns a file:// baseUrl into a directory', () => {
  const anchors = resolveAnchors({ baseUrl: 'file:///Users/example/.dsh/profiles/web/', get: () => undefined })
  assert.equal(anchors[0], '/Users/example/.dsh/profiles/web')
})

test('resolveAnchors falls back to the loader baseUrl', () => {
  const anchors = resolveAnchors({
    get: (service) => (service === 'loader' ? { entries: () => [], baseUrl: 'file:///srv/profile/' } : undefined),
  })
  assert.ok(anchors.includes('/srv/profile'), 'the loader baseUrl is an anchor')
})

test('a throwing service accessor reads as absent', () => {
  assert.equal(loaderEntries({ get: () => { throw new Error('no such service') } }), null)
})

test('the loader view flattens the tree and carries each row fiber state', () => {
  assert.equal(loaderEntries({ get: () => undefined }), null)
  const rows = loaderEntries({
    get: () => ({
      entries: () => [
        { options: { id: 'x', name: 'dsh-as-aistudio/edit' }, disabled: false, fiber: liveFiber(3) },
        { options: { id: 'y', name: 'dsh-as-aistudio/rerun' }, disabled: true },
        { options: { id: 'z', name: 'dsh-edit-turn' }, disabled: false, fiber: { uid: 4, state: 3 } },
      ],
    }),
  })
  assert.deepEqual(rows, [
    { id: 'x', name: 'dsh-as-aistudio/edit', disabled: false, fiberState: 'active' },
    { id: 'y', name: 'dsh-as-aistudio/rerun', disabled: true, fiberState: 'none' },
    { id: 'z', name: 'dsh-edit-turn', disabled: false, fiberState: 'failed' },
  ])
})

test('a fiber state is a word, never a raw constant', () => {
  assert.equal(fiberStateOf(null), 'none')
  assert.equal(fiberStateOf(undefined), 'none')
  assert.equal(fiberStateOf({ uid: 1, state: 0 }), 'starting')
  assert.equal(fiberStateOf({ uid: 1, state: 1 }), 'starting')
  assert.equal(fiberStateOf({ uid: 1, state: 2 }), 'active')
  assert.equal(fiberStateOf({ uid: 1, state: 3 }), 'failed')
  assert.equal(fiberStateOf({ uid: 1, state: 5 }), 'stopping')
  assert.equal(fiberStateOf({ uid: null, state: 2 }), 'disposed')
  assert.equal(fiberStateOf({}), 'disposed', 'a fiber without a uid has been disposed')
  assert.equal(fiberStateOf({ uid: 2 }), 'unknown')
})

// --- the host mount ------------------------------------------------------------

test('the host half mounts nothing itself: the component rows do', async () => {
  // Mounting the components here as well is exactly the double-mount the row
  // rewrite removed: every component would run twice in one process and the
  // second copy would collide on its loopback routes.
  const stub = contextStub()
  await apply(stub.ctx)
  assert.equal(stub.mounted.length, 0, 'the studio plugin mounts no component')
  assert.deepEqual([...stub.server.routes.keys()], ['/api/dsh-as-aistudio/status'], 'it registers its status route only')
})

test('a live component row reads as mounted', () => {
  const entries = entriesOf(loaderRows())
  for (const component of COMPONENTS) {
    assert.deepEqual(
      hostStateOf(component, entries, true),
      { hostMounted: true, hostReason: null, hostRow: rowNameOf(component) },
      component.id,
    )
  }
})

test('any row that is not active reads as NOT mounted, with its reason', () => {
  const cases = [
    ['never started', { fiber: undefined }, true, 'not-started'],
    ['never started because the package is missing', { fiber: undefined }, false, 'not-installed'],
    ['failed to start because the package is missing', { fiber: { uid: 41, state: 3 } }, false, 'not-installed'],
    ['disabled by the user', { disabled: true }, true, 'disabled'],
    ['start failed', { fiber: { uid: 41, state: 3 } }, true, 'start-failed'],
    ['still starting', { fiber: { uid: 41, state: 0 } }, true, 'starting'],
    ['stopping', { fiber: { uid: 41, state: 5 } }, true, 'stopping'],
    ['disposed', { fiber: { uid: null, state: 2 } }, true, 'disposed'],
  ]
  for (const [label, override, installed, reason] of cases) {
    const entries = entriesOf(loaderRows((component) => (component.id === COMPONENTS[1].id ? override : {})))
    const verdict = hostStateOf(COMPONENTS[1], entries, installed)
    assert.equal(verdict.hostMounted, false, label + ': an inert row is not a mount')
    assert.equal(verdict.hostReason, reason, label + ': the reason names the failure')
  }
})

test('a component installed standalone next to the studio answers under its own name', () => {
  const rows = loaderRows((component) => (component.id === COMPONENTS[0].id ? { name: COMPONENTS[0].package } : {}))
  const verdict = hostStateOf(COMPONENTS[0], entriesOf(rows), true)
  assert.equal(verdict.hostMounted, true)
  assert.equal(verdict.hostRow, 'dsh-edit-turn', 'the standalone row is what answered')
})

test('a component with no row at all is reported, never silently mounted', () => {
  const rows = loaderRows().filter((row) => row.options.name !== rowNameOf(COMPONENTS[2]))
  assert.equal(hostStateOf(COMPONENTS[2], entriesOf(rows), true).hostReason, 'row-missing')
})

// --- the status document -------------------------------------------------------

test('an invisible loader yields hostMounted null, never a crash', () => {
  const status = statusOf({ get: () => undefined })
  assert.equal(status.ok, true)
  assert.equal(status.loaderVisible, false)
  for (const component of status.components) {
    assert.equal(component.hostMounted, null)
    assert.equal(component.hostRow, null)
  }
  assert.equal(status.components.length, COMPONENTS.length)
})

test('the status document reports installed state and the own-row count', () => {
  // Under the studio the components have no rows of their own; a standalone
  // install next to it would show exactly one. The loader view tells the two
  // apart, and it has to be visible for the count to be honest.
  const rows = [{ options: { id: 'dsh-edit-turn', name: 'dsh-edit-turn' }, disabled: false, fiber: liveFiber(5) }]
  const status = statusWith(rows)
  assert.equal(status.loaderVisible, true)
  const edit = status.components.find((component) => component.id === 'dsh-edit-turn')
  assert.equal(edit.ownRows, 1, 'a standalone install is visible as one own row')
  assert.equal(edit.hostMounted, true, 'and it is live, so the component is up')
  assert.equal(edit.hostRow, 'dsh-edit-turn')
  const other = status.components.find((component) => component.id === 'dsh-rerun-turn')
  assert.equal(other.ownRows, 0, 'under the studio it has no row of its own')
  assert.equal(other.hostMounted, false, 'and no row means no mount')
  assert.equal(other.hostReason, 'row-missing')

  // With no loader there is no count at all, not a wrong one.
  const blind = statusOf({ get: () => undefined })
  assert.equal(blind.loaderVisible, false)
  assert.equal(blind.components.find((component) => component.id === 'dsh-edit-turn').ownRows, null)
})

test('the summary counts the rows that are really live', () => {
  const rows = loaderRows((component) => (component.id === COMPONENTS[2].id ? { fiber: { uid: 77, state: 3 } } : {}))
  const status = statusWith(rows)
  assert.equal(status.summary.mounted, 3)
  assert.deepEqual(status.summary.combination, ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-markdown-bubble'])
  const failed = status.components.find((component) => component.id === 'dsh-delete-turn')
  assert.equal(failed.hostMounted, false)
  assert.equal(failed.hostReason, 'start-failed')
  assert.equal(failed.hostRow, 'dsh-as-aistudio/delete')
})

test('the status is read from the loader on every call, never cached', () => {
  // The point of reading the Loader instead of a private mount table: a row the
  // user disables in the plugin manager shows up without restarting the studio.
  const rows = loaderRows()
  const loader = { entries: () => rows }
  const ctx = { get: (service) => (service === 'loader' ? loader : undefined) }
  assert.equal(statusOf(ctx).summary.mounted, COMPONENTS.length)
  rows[1].disabled = true
  assert.equal(statusOf(ctx).summary.mounted, COMPONENTS.length - 1)
})

test('the payload carries the component identity the panel needs', () => {
  const status = statusOf({ get: () => undefined })
  for (const component of status.components) {
    for (const key of ['id', 'package', 'feature', 'kind', 'repo', 'installed', 'version', 'hostMounted', 'hostReason', 'hostRow', 'ownRows']) {
      assert.ok(key in component, component.id + ' is missing ' + key)
    }
    assert.match(component.repo, /^https:\/\/github\.com\//)
  }
})

test('inspectPackage reports an absence instead of throwing', () => {
  const found = inspectPackage('dsh-a-package-that-does-not-exist', ['/nonexistent-root'])
  assert.equal(found.installed, false)
  assert.equal(found.version, null)
})

// --- the route ----------------------------------------------------------------

function request(method, url, body) {
  const listeners = new Map()
  const req = {
    method,
    url,
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' },
    on(event, handler) {
      listeners.set(event, handler)
      return req
    },
    destroy() {},
  }
  setImmediate(() => {
    if (body !== undefined) listeners.get('data')?.(body)
    listeners.get('end')?.()
  })
  return req
}

function response() {
  const box = { status: 0, body: '' }
  return {
    box,
    writeHead(status) {
      box.status = status
    },
    end(payload) {
      box.body = payload
    },
  }
}

async function call(route, method, url, body) {
  const res = response()
  await route.handler(request(method, url, body), res)
  let parsed = null
  try {
    parsed = JSON.parse(res.box.body)
  } catch {
    parsed = null
  }
  return { status: res.box.status, body: parsed }
}

async function statusRoute(options) {
  const stub = contextStub(options)
  await apply(stub.ctx)
  return stub.server.routes.get('/api/dsh-as-aistudio/status')
}

test('the route answers GET on loopback with the status document', async () => {
  const answer = await call(await statusRoute(), 'GET', '/api/dsh-as-aistudio/status')
  assert.equal(answer.status, 200)
  assert.equal(answer.body.ok, true)
  assert.equal(answer.body.plugin, STUDIO_ID)
  assert.equal(Array.isArray(answer.body.components), true)
})

test('the route reports what the loader says, per request', async () => {
  const answer = await call(await statusRoute({ loader: { entries: () => loaderRows() } }), 'GET', '/api/dsh-as-aistudio/status')
  assert.equal(answer.status, 200)
  assert.equal(answer.body.loaderVisible, true)
  assert.equal(answer.body.summary.mounted, COMPONENTS.length, 'the four component rows are live')
  assert.deepEqual(answer.body.summary.combination, COMPONENTS.map((component) => component.id))
})

test('the route refuses a non-GET method', async () => {
  const answer = await call(await statusRoute(), 'POST', '/api/dsh-as-aistudio/status', '{}')
  assert.equal(answer.status, 405)
  assert.equal(answer.body.code, 'method')
})

test('the route refuses a non-loopback caller', async () => {
  const r = await statusRoute()
  const res = response()
  const remote = request('GET', '/api/dsh-as-aistudio/status')
  remote.socket = { remoteAddress: '10.0.0.7' }
  await r.handler(remote, res)
  assert.equal(res.box.status, 403)
  assert.equal(JSON.parse(res.box.body).code, 'forbidden')
})

test('the route refuses a foreign Host header', async () => {
  const r = await statusRoute()
  const res = response()
  const foreign = request('GET', '/api/dsh-as-aistudio/status')
  foreign.headers = { host: 'evil.example' }
  await r.handler(foreign, res)
  assert.equal(res.box.status, 403)
})

test('the route refuses a cross-origin caller', async () => {
  const r = await statusRoute()
  const res = response()
  const cross = request('GET', '/api/dsh-as-aistudio/status')
  cross.headers = { host: '127.0.0.1:3080', origin: 'https://evil.example' }
  await r.handler(cross, res)
  assert.equal(res.box.status, 403)
})

test('apply defers to the webServer injection when the service is absent', async () => {
  const injected = []
  const ctx = {
    get: () => undefined,
    inject: (services, factory) => injected.push({ services, factory }),
    effect: () => () => {},
  }
  await apply(ctx)
  assert.equal(injected.length, 1)
  assert.deepEqual(injected[0].services, ['webServer'])
})
