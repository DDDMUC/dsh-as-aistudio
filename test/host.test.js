// Host-half tests: drive the real apply() against a context stub, then call the
// route the way the browser does. What matters here is that the status document
// is honest — it distinguishes "installed but not enabled" from "enabled", it
// stays readable when the loader is invisible, and it never throws on the wire.
//
//   node --test "test/*.test.js"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, loaderEntries, name, resolveAnchors, statusOf } from '../src/index.js'
import { COMPONENTS } from '../src/components.js'

/** A loader stub: entries as the loader tree would flatten them. */
function loaderWith(rows) {
  return {
    get: (service) => (service === 'loader' ? { entries: () => rows.map((row) => ({ options: row, disabled: row.disabled === true })) } : undefined),
  }
}

/** A webServer stub that records registrations. */
function webServerStub() {
  const routes = new Map()
  return {
    routes,
    webServer: {
      register: (route) => {
        routes.set(route.path, route)
        return () => routes.delete(route.path)
      },
    },
  }
}

/** The context stub apply() needs: loader, webServer and effect. */
function contextStub(rows) {
  const server = webServerStub()
  const loader = loaderWith(rows).get('loader')
  const ctx = {
    get: (service) => {
      if (service === 'loader') return loader
      if (service === 'webServer') return server.webServer
      return undefined
    },
    effect: (factory) => {
      const disposer = factory()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
    inject: () => {},
  }
  return { ctx, server }
}

/** A loopback request the guard accepts. */
function request(method) {
  return { method, url: '/api/dsh-as-aistudio/status', socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:3080' } }
}

/** A response recorder. */
function response() {
  const box = { status: 0, headers: null, body: '' }
  return {
    box,
    writeHead: (status, headers) => {
      box.status = status
      box.headers = headers
    },
    end: (payload) => {
      box.body = payload
    },
  }
}

test('the host half names the studio', () => {
  assert.equal(name, 'dsh-as-aistudio')
})

// dsh-app-boot sets a cordis baseUrl to `pathToFileURL(dirname(config)) + '/'`,
// and Node refuses a file:// URL as a resolution directory — the live instance
// answered "installed: false" for every component until this was converted.
test('a file:// baseUrl becomes a filesystem anchor', () => {
  const anchors = resolveAnchors({ baseUrl: 'file:///Users/example/.dsh/profiles/web/', get: () => undefined })
  assert.equal(anchors[0], '/Users/example/.dsh/profiles/web')
})

test('a loader baseUrl is used when the context does not expose one', () => {
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
  assert.equal(loaderEntries({ get: () => ({ entries: 'nope' }) }), null)
  const rows = loaderEntries({ get: () => ({ entries: () => [{ options: { id: 'x', name: 'dsh-edit-turn' } }] }) })
  assert.deepEqual(rows, [{ id: 'x', name: 'dsh-edit-turn', disabled: false }])
})

test('an invisible loader yields mounted: null, never a crash', () => {
  const status = statusOf({ get: () => undefined })
  assert.equal(status.ok, true)
  assert.equal(status.loaderVisible, false)
  for (const component of status.components) assert.equal(component.mounted, null)
  assert.equal(status.components.length, COMPONENTS.length)
})

test('an entry naming a component marks it mounted', () => {
  const rows = [
    { id: 'dsh-edit-turn', name: 'dsh-edit-turn' },
    { id: 'dsh-delete-turn', name: 'dsh-delete-turn' },
    { id: 'unrelated', name: 'something-else' },
  ]
  const status = statusOf({ get: (service) => loaderWith(rows).get(service) })
  const byId = new Map(status.components.map((component) => [component.id, component]))
  assert.equal(byId.get('dsh-edit-turn').mounted, true)
  assert.equal(byId.get('dsh-delete-turn').mounted, true)
  assert.equal(byId.get('dsh-rerun-turn').mounted, false)
  assert.equal(byId.get('dsh-markdown-bubble').mounted, false)
  assert.deepEqual(status.summary.combination, ['dsh-edit-turn', 'dsh-delete-turn'])
  assert.equal(status.summary.mounted, 2)
  assert.equal(status.summary.total, COMPONENTS.length)
})

test('a disabled entry is not mounted, and its count is still reported', () => {
  const rows = [
    { id: 'dsh-edit-turn', name: 'dsh-edit-turn', disabled: true },
    { id: 'dsh-edit-turn-shadow', name: 'dsh-edit-turn' },
  ]
  const status = statusOf({ get: (service) => loaderWith(rows).get(service) })
  const edit = status.components.find((component) => component.id === 'dsh-edit-turn')
  assert.equal(edit.entries.length, 2)
  assert.equal(edit.enabledEntries, 1)
  assert.equal(edit.mounted, true)
})

// The row-merge case the composition depends on: the platform merges two
// inserted rows that share an id into one Entry, and a merged row still names
// its package exactly once. Two live entries naming the same package would mean
// the plugin mounts twice, so the host must show it rather than hide it.
test('two entries naming one component are both reported', () => {
  const rows = [
    { id: 'dsh-delete-turn', name: 'dsh-delete-turn' },
    { id: 'as-aistudio-delete-turn', name: 'dsh-delete-turn' },
  ]
  const status = statusOf({ get: (service) => loaderWith(rows).get(service) })
  const del = status.components.find((component) => component.id === 'dsh-delete-turn')
  assert.equal(del.entries.length, 2)
  assert.equal(del.mounted, true)
})

test('the route answers GET on loopback with the status document', async () => {
  const { ctx, server } = contextStub([{ id: 'dsh-rerun-turn', name: 'dsh-rerun-turn' }])
  apply(ctx)
  const route = server.routes.get('/api/dsh-as-aistudio/status')
  assert.ok(route !== undefined, 'the status route is registered')
  assert.equal(route.kind, 'exact')
  const res = response()
  await route.handler(request('GET'), res)
  assert.equal(res.box.status, 200)
  const body = JSON.parse(res.box.body)
  assert.equal(body.ok, true)
  assert.equal(body.plugin, 'dsh-as-aistudio')
  assert.equal(body.summary.mounted, 1)
  assert.deepEqual(body.summary.combination, ['dsh-rerun-turn'])
})

test('the route refuses a non-GET method', async () => {
  const { ctx, server } = contextStub([])
  apply(ctx)
  const res = response()
  await server.routes.get('/api/dsh-as-aistudio/status').handler(request('POST'), res)
  assert.equal(res.box.status, 405)
})

test('the route refuses a non-loopback caller', async () => {
  const { ctx, server } = contextStub([])
  apply(ctx)
  const res = response()
  const remote = request('GET')
  remote.socket = { remoteAddress: '10.0.0.7' }
  await server.routes.get('/api/dsh-as-aistudio/status').handler(remote, res)
  assert.equal(res.box.status, 403)
})

test('the route refuses a foreign Host header', async () => {
  const { ctx, server } = contextStub([])
  apply(ctx)
  const res = response()
  const foreign = request('GET')
  foreign.headers = { host: 'evil.example' }
  await server.routes.get('/api/dsh-as-aistudio/status').handler(foreign, res)
  assert.equal(res.box.status, 403)
})

test('the route refuses a cross-origin caller', async () => {
  const { ctx, server } = contextStub([])
  apply(ctx)
  const res = response()
  const cross = request('GET')
  cross.headers = { host: '127.0.0.1:3080', origin: 'https://evil.example' }
  await server.routes.get('/api/dsh-as-aistudio/status').handler(cross, res)
  assert.equal(res.box.status, 403)
})

test('apply defers to the webServer injection when the service is absent', () => {
  const injected = []
  const ctx = {
    get: () => undefined,
    inject: (services, factory) => injected.push({ services, factory }),
    effect: () => () => {},
  }
  apply(ctx)
  assert.equal(injected.length, 1)
  assert.deepEqual(injected[0].services, ['webServer'])
})
