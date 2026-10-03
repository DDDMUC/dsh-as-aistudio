// Unit tests for the browser half's pure machinery and its registration
// contract. This half deliberately owns no DOM: it renders one settings tab and
// fetches one route, so there is nothing to observe here beyond the shape the
// platform is handed and the two pure helpers that shape the panel.
//
//   node --test "test/*.test.js"
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

// The bundle's PLUGIN_VERSION is asserted against the manifest rather than a
// literal, so a version bump is a one-line change in three places and not a
// fourth place that silently goes stale.
const manifest = createRequire(import.meta.url)('../package.json')

let registration
globalThis.window = {
  __ModuleLoader__: {
    load: (value) => {
      registration = value
    },
  },
}

// The bundle's mounting gate reads the status route before it mounts anything.
// This file asserts the studio's own surfaces and the gate's pure predicates, so
// the stub reports every component as NOT mounted: nothing is drawn, no factory
// runs against a stub context, and an unexpected registration can only come from
// the studio itself. The fully mounted path is exercised against the real
// vendored factories in test/bundle-exec.test.js.
const ALL_DOWN = ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn', 'dsh-markdown-bubble'].map((id) => ({
  id,
  installed: true,
  hostMounted: false,
}))
globalThis.fetch = async () => ({ json: async () => ({ ok: true, components: ALL_DOWN }) })

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

/**
 * Materialize the generated bundle with a stub react.
 *
 * The generated bundle carries the studio half AND the four vendored component
 * factories, and the components require the host UI primitives package too — so
 * the require stub answers 'react' and
 * '@deepseek-ai/dsh-client-ui-primitives', exactly as the browser module table
 * would for this package's declared injections. Anything else is a bug: an
 * unexpected request means a half is reaching for something it never declared.
 */
function materialize() {
  assert.ok(registration !== undefined, 'the bundle registered its factory')
  const react = reactStub()
  const primitivesStub = {
    projectUserText: (text) => react.createElement('span', { className: 'plainRun' }, text),
    MarkdownText: function MarkdownText() {},
    JsonBlock: function JsonBlock() {},
    Tooltip: (props) => props.children,
    FileTypeIcon: function FileTypeIcon() {},
    IconCopyOutlineRegular: function IconCopyOutlineRegular() {},
    IconCheckOutlineRegular: function IconCheckOutlineRegular() {},
    fileExtension: () => 'txt',
    fileSizeText: () => '1 KB',
    writeClipboard: () => Promise.resolve(true),
  }
  const require = (spec) => {
    if (spec === 'react') return react
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub
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
  assert.equal(exports.PLUGIN_VERSION, manifest.version)
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

// The payload the studio reports since the self-contained rewrite: the component
// is only really live when ITS OWN HOST HALF is mounted (that is what makes its
// routes answer), not merely when the package resolves.
test('stateOf reads the host payload honestly', () => {
  const exports = materialize()
  assert.equal(exports.stateOf({ hostMounted: true, installed: true }), 'mounted')
  assert.equal(exports.stateOf({ hostMounted: false, installed: true }), 'installed')
  // The host reported nothing (no mounts attempted): an installed package reads
  // as available rather than broken.
  assert.equal(exports.stateOf({ hostMounted: null, installed: true }), 'mounted')
  assert.equal(exports.stateOf({ hostMounted: null, installed: false }), 'missing')
  assert.equal(exports.stateOf({ hostMounted: false, installed: false }), 'missing')
})

// The gate: the browser half must not draw a component whose host half is not
// up, because its buttons would call routes that do not exist. The predicate is
// deliberately the SAME one the panel renders, so "the panel says 已启用" and
// "we mounted it" can never drift apart.
test('the gate and the panel share one predicate', () => {
  const exports = materialize()
  const cases = [
    { hostMounted: true, installed: true },
    { hostMounted: false, installed: true },
    { hostMounted: null, installed: true },
    { hostMounted: null, installed: false },
    { hostMounted: false, installed: false },
    { hostMounted: true, installed: false },
  ]
  for (const component of cases) {
    assert.equal(
      exports.shouldMount(component),
      exports.stateOf(component) === 'mounted',
      JSON.stringify(component) + ': the gate must follow the panel',
    )
  }
  // Spelled out, because these are the decisions: an absent host half is not
  // drawn, an unreported one is (nothing was denied), a reported-live one is.
  assert.equal(exports.shouldMount({ hostMounted: false, installed: true }), false)
  assert.equal(exports.shouldMount({ hostMounted: null, installed: true }), true)
  assert.equal(exports.shouldMount({ hostMounted: null, installed: false }), false)
})

test('apply draws nothing when the host reports every component down', async () => {
  // The end-to-end shape of the gate in this half: the tab is still registered
  // (it is what tells the reader why nothing is there), and not one component
  // surface is.
  const exports = materialize()
  const stub = contextStub()
  await exports.apply(stub.ctx)
  const marker = globalThis.__DSH_AS_AISTUDIO__
  assert.ok(marker, 'the studio records its mount state')
  for (const id of exports.VENDORED) assert.equal(marker.mounted[id], false, id + ' must stay off the page')
  assert.deepEqual(
    stub.registrations.map((row) => row.options.name),
    ['settings.plugins.tab'],
    'a gated-off component must register no surface',
  )
})

test('mountableComponents keeps only what the host reports as mounted', () => {
  const exports = materialize()
  const payload = {
    ok: true,
    components: [
      { id: 'dsh-edit-turn', installed: true, hostMounted: true },
      { id: 'dsh-rerun-turn', installed: true, hostMounted: false },
      { id: 'dsh-delete-turn', installed: true, hostMounted: false },
      { id: 'dsh-markdown-bubble', installed: true, hostMounted: true },
    ],
  }
  assert.deepEqual(exports.mountableComponents(payload), ['dsh-edit-turn', 'dsh-markdown-bubble'])
  // No answer at all is not a refusal: the pre-gate behaviour is kept, so a host
  // that cannot answer does not blank the whole action strip.
  assert.deepEqual(exports.mountableComponents(null), exports.VENDORED)
})

test('a component the host never mentions is not mounted', () => {
  // A bundle newer than the host half must not draw a component the host has
  // never heard of: there is no route behind it.
  const exports = materialize()
  const payload = { ok: true, components: [{ id: 'dsh-edit-turn', installed: true, hostMounted: true }] }
  assert.deepEqual(exports.mountableComponents(payload), ['dsh-edit-turn'])
})

test('fill substitutes known keys and leaves unknown ones visible', () => {
  const exports = materialize()
  assert.equal(exports.fill('a {one} b', { one: 1 }), 'a 1 b')
  assert.equal(exports.fill('a {two} b', { one: 1 }), 'a {two} b')
})

test('the published allocation mirrors the manifest', () => {
  const exports = materialize()
  // The studio has no overlay entry of its own any more (it renders only a
  // settings tab), so the allocation lists the three components that claim one.
  assert.deepEqual(
    exports.OVERLAY_ORDERS.map((row) => row.id),
    ['dsh-delete-turn', 'dsh-edit-turn', 'dsh-rerun-turn'],
  )
  assert.equal(exports.HIDE_OWNERS.length, 3)
})
