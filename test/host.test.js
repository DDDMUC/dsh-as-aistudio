// Host-half tests: the shell that mounts the four component host halves, and the
// status route that reports what actually mounted.
//
// Since the self-contained rewrite the studio has no rows of its own for the
// components: it imports each package and applies it into this fiber. So the
// interesting questions are all about that mount - does a failing component stop
// the others, does a missing one get reported rather than thrown, and does the
// route tell the truth about what is live.
//
//   node --test test/*.test.js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, inspectPackage, loaderEntries, mountComponentHosts, name, resolveAnchors, statusOf } from '../src/index.js'
import { COMPONENTS, STUDIO_ID } from '../src/components.js'

const SESSION_ID = 'session-11111111-2222-4333-8444-555555555555'

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
 * webServer are handed over through get(); plugin() records the mounts.
 */
function contextStub(options = {}) {
  const server = webServerStub()
  const mounted = []
  const thrown = []
  const ctx = {
    get: (service) => {
      if (service === 'webServer') return server.webServer
      if (service === 'loader') return options.loader
      return undefined
    },
    plugin: (fn) => {
      mounted.push(fn)
      if (options.failing !== undefined && options.failing.includes(fn)) {
        thrown.push(fn)
        throw new Error('component refused to mount')
      }
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
  return { ctx, server, mounted, thrown }
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

test('the loader view flattens the tree and reports absence', () => {
  assert.equal(loaderEntries({ get: () => undefined }), null)
  const rows = loaderEntries({ get: () => ({ entries: () => [{ options: { id: 'x', name: 'dsh-edit-turn' } }] }) })
  assert.deepEqual(rows, [{ id: 'x', name: 'dsh-edit-turn', disabled: false }])
})

test('inspectPackage reports an absence instead of throwing', () => {
  const found = inspectPackage('dsh-a-package-that-does-not-exist', ['/nonexistent-root'])
  assert.equal(found.installed, false)
  assert.equal(found.version, null)
})

// --- the component mount -------------------------------------------------------

test('apply mounts every component host half, in manifest order', async () => {
  const stub = contextStub()
  await apply(stub.ctx)
  assert.equal(stub.mounted.length, COMPONENTS.length, 'one mount per component')
  assert.equal(stub.thrown.length, 0, 'a healthy stub refuses none')
})

test('a component that refuses to mount does not stop the others', async () => {
  const failing = () => { throw new Error('refused') }
  const mounts = []
  const ctx = {
    get: (service) => (service === 'webServer' ? webServerStub().webServer : undefined),
    plugin: (fn) => {
      mounts.push(fn)
      if (fn === failing) throw new Error('refused')
      return { dispose() {} }
    },
    effect: (f) => f(),
    inject: () => {},
    on: () => {},
    logger: { warn: () => {}, error: () => {} },
  }
  await apply(ctx)
  assert.equal(mounts.length, COMPONENTS.length, 'every component was still attempted')
})

test('mountComponentHosts records why a component did not mount', async () => {
  const hosts = await mountComponentHosts({ plugin: () => ({ dispose() {} }) })
  assert.equal(hosts.size, COMPONENTS.length)
  for (const [id, record] of hosts) {
    if (record.mounted === false) {
      assert.equal(typeof record.reason, 'string', id + ': a reason accompanies a failed mount')
      assert.ok(['import-failed', 'apply-failed', 'no-plugin-shape'].includes(record.reason), id + ': a known reason')
    } else {
      assert.equal(record.reason, undefined, id + ': a mounted component carries no reason')
    }
  }
})

// --- the status document -------------------------------------------------------

test('an invisible loader yields hostMounted null, never a crash', () => {
  const status = statusOf({ get: () => undefined })
  assert.equal(status.ok, true)
  assert.equal(status.loaderVisible, false)
  for (const component of status.components) assert.equal(component.hostMounted, null)
  assert.equal(status.components.length, COMPONENTS.length)
})

test('the status document reports installed state and the own-row count', () => {
  // Under the studio the components have no rows of their own; a standalone
  // install next to it would show exactly one. The loader view tells the two
  // apart, and it has to be visible for the count to be honest.
  const rows = [{ options: { id: 'dsh-edit-turn', name: 'dsh-edit-turn' }, disabled: false }]
  const loader = { entries: () => rows }
  const status = statusOf({ get: (service) => (service === 'loader' ? loader : undefined) })
  assert.equal(status.loaderVisible, true)
  const edit = status.components.find((component) => component.id === 'dsh-edit-turn')
  assert.equal(edit.ownRows, 1, 'a standalone install is visible as one own row')
  const other = status.components.find((component) => component.id === 'dsh-rerun-turn')
  assert.equal(other.ownRows, 0, 'under the studio it has no row of its own')

  // With no loader there is no count at all, not a wrong one.
  const blind = statusOf({ get: () => undefined })
  assert.equal(blind.loaderVisible, false)
  assert.equal(blind.components.find((component) => component.id === 'dsh-edit-turn').ownRows, null)
})

test('the summary counts what the host actually mounted', () => {
  const hosts = new Map([
    ['dsh-edit-turn', { mounted: true }],
    ['dsh-rerun-turn', { mounted: true }],
    ['dsh-delete-turn', { mounted: false, reason: 'apply-failed' }],
    ['dsh-markdown-bubble', { mounted: true }],
  ])
  const status = statusOf({ get: () => undefined }, hosts)
  assert.equal(status.summary.mounted, 3)
  assert.deepEqual(status.summary.combination, ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-markdown-bubble'])
  const failed = status.components.find((component) => component.id === 'dsh-delete-turn')
  assert.equal(failed.hostMounted, false)
  assert.equal(failed.hostReason, 'apply-failed')
})

test('the payload carries the component identity the panel needs', () => {
  const status = statusOf({ get: () => undefined })
  for (const component of status.components) {
    for (const key of ['id', 'package', 'feature', 'kind', 'repo', 'installed', 'version', 'hostMounted', 'ownRows']) {
      assert.ok(key in component, component.id + ' is missing ' + key)
    }
    assert.match(component.repo, /^https:\/\/github\.com\//)
  }
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

async function statusRoute() {
  const stub = contextStub()
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
    plugin: () => ({ dispose() {} }),
  }
  await apply(ctx)
  assert.equal(injected.length, 1)
  assert.deepEqual(injected[0].services, ['webServer'])
})

