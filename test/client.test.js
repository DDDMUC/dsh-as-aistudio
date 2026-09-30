// Unit tests for the browser half's pure machinery and its registration
// contract. This half deliberately owns no DOM: it renders one settings tab and
// fetches one route, so there is nothing to observe here beyond the shape the
// platform is handed and the two pure helpers that shape the panel.
//
//   node --test "test/*.test.js"
import assert from 'node:assert/strict'
import { test } from 'node:test'

let registration
globalThis.window = {
  __ModuleLoader__: {
    load: (value) => {
      registration = value
    },
  },
}

await import('../src/client.js')

/** A React stub carrying only what the factory touches. */
function reactStub() {
  const createElement = (type, props, ...children) => ({
    __element: true,
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  })
  return {
    createElement,
    useEffect: () => {},
    useState: (value) => [value, () => {}],
  }
}

/** Materialize the bundle with a stub react and record what apply() registers. */
function materialize() {
  assert.ok(registration !== undefined, 'the bundle registered its factory')
  const react = reactStub()
  const require = (spec) => {
    if (spec === 'react') return react
    throw new Error('unexpected require(' + JSON.stringify(spec) + ')')
  }
  return registration.factory(require)
}

/** A client context stub: locale + slots, nothing else is reached. */
function contextStub() {
  const registrations = []
  const dicts = []
  return {
    registrations,
    dicts,
    ctx: {
      effect: (factory) => {
        const disposer = factory()
        return () => {
          if (typeof disposer === 'function') disposer()
        }
      },
      locale: {
        register: (ns, value) => {
          dicts.push({ ns, value })
          return () => {}
        },
        bind: (ns) => (key, params) => {
          const dict = dicts.length > 0 ? dicts[dicts.length - 1].value.zh : {}
          const template = dict[key] ?? key
          if (params === undefined) return template
          return String(template).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
        },
        getLocale: () => ({ active: { id: 'zh-CN' }, locales: [], revision: 0 }),
      },
      slots: {
        inject: (name, factory) => {
          factory()
        },
        register: (options, component) => {
          registrations.push({ options, component })
        },
      },
    },
  }
}

test('the bundle registers under the studio id', () => {
  assert.equal(registration.id, 'dsh-as-aistudio')
})

test('the plugin exports the platform contract', () => {
  const exports = materialize()
  assert.equal(typeof exports.apply, 'function')
  assert.deepEqual(exports.inject, ['slots', 'locale'])
  assert.equal(exports.PLUGIN_VERSION, '0.1.0')
  assert.equal(exports.STATUS_ROUTE, '/api/dsh-as-aistudio/status')
})

test('apply registers the studio tab behind the platform tabs', () => {
  const exports = materialize()
  const stub = contextStub()
  exports.apply(stub.ctx)
  assert.equal(stub.registrations.length, 1, 'exactly one surface is added')
  const { options, component } = stub.registrations[0]
  assert.equal(options.name, 'settings.plugins.tab')
  assert.equal(options.id, 'as-aistudio')
  assert.equal(typeof options.label, 'function')
  assert.equal(options.label(), 'AI Studio')
  assert.equal(component, exports.StudioPanel)
})

test('apply owns no row surface, observer or listener', () => {
  const exports = materialize()
  const stub = contextStub()
  exports.apply(stub.ctx)
  const names = stub.registrations.map((row) => row.options.name)
  assert.deepEqual(names, ['settings.plugins.tab'])
  for (const row of stub.registrations) {
    assert.notEqual(row.options.name, 'conversation.input.overlay')
    assert.notEqual(row.options.name, 'conversation.chat.assistant-actions')
    assert.notEqual(row.options.name, 'conversation.chat.node')
  }
})

test('both dictionaries are complete and parallel', () => {
  const exports = materialize()
  assert.deepEqual(Object.keys(exports.zh).sort(), Object.keys(exports.en).sort())
})

test('stateOf reads the host payload honestly', () => {
  const exports = materialize()
  assert.equal(exports.stateOf({ mounted: true, installed: true }), 'mounted')
  assert.equal(exports.stateOf({ mounted: false, installed: true }), 'installed')
  assert.equal(exports.stateOf({ mounted: null, installed: true }), 'mounted')
  assert.equal(exports.stateOf({ mounted: null, installed: false }), 'missing')
  assert.equal(exports.stateOf({ mounted: false, installed: false }), 'missing')
})

test('fill substitutes known keys and leaves unknown ones visible', () => {
  const exports = materialize()
  assert.equal(exports.fill('a {one} b', { one: 1 }), 'a 1 b')
  assert.equal(exports.fill('a {two} b', { one: 1 }), 'a {two} b')
})

test('the published allocation mirrors the manifest', () => {
  const exports = materialize()
  assert.deepEqual(
    exports.OVERLAY_ORDERS.map((row) => row.id),
    ['dsh-delete-turn', 'dsh-edit-turn', 'dsh-rerun-turn', 'dsh-as-aistudio'],
  )
  assert.equal(exports.HIDE_OWNERS.length, 3)
})
