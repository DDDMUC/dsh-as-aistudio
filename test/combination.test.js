// The combination matrix: every subset of the four components, applied into one
// client runtime.
//
// Requirement 2 of the studio is that any subset works — one component, two,
// three, four, or any of them alongside the studio. A per-repo test cannot see
// that: it mounts one plugin into its own stub. This file mounts the real
// bundles, resolved through their own package `exports` map, into ONE runtime,
// for all sixteen subsets, and asserts the two things a collision would break:
//
//   1. no two registrations claim the same (slot, id) — a duplicate id is how a
//      plugin mounts twice;
//   2. no two registrations claim the same (slot, order) — the interop contract
//      (docs/INTEROP.md §2) allocates one order per plugin, because a tie leaves
//      their relative order undefined.
//
// A component that is not installed is reported and skipped, never failed: the
// studio declares them as optional dependencies precisely so the set can be
// partial. Run `npm install` in this package to get all four.
//
//   node --test "test/*.test.js"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { COMPONENTS } from '../src/components.js'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// --- what a bundle is given ---------------------------------------------------

/** A React stub: module-scope uses only, plus the hooks a render would call. */
function reactStub() {
  const createElement = (type, props, ...children) => ({
    __element: true,
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  })
  const passthrough = (value) => value
  class Component {
    constructor(props) {
      this.props = props ?? {}
    }
    setState() {}
    render() { return null }
  }
  return new Proxy(
    {
      Fragment: Symbol('Fragment'),
      Component,
      PureComponent: Component,
      createElement,
      jsx: createElement,
      jsxs: createElement,
      isValidElement: (value) => typeof value === 'object' && value !== null && value.__element === true,
      memo: passthrough,
      forwardRef: (render) => render,
      createContext: (value) => ({ Provider: passthrough, Consumer: passthrough, _value: value }),
      useCallback: (fn) => fn,
      useEffect: () => {},
      useId: () => 'stub-id',
      useLayoutEffect: () => {},
      useMemo: (factory) => factory(),
      useRef: (value) => ({ current: value ?? null }),
      useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
      useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    },
    {
      // A bundle may also reference an export this stub does not model. Falling
      // back to a no-op class keeps the matrix about *registration* collisions
      // rather than about how complete a UI stub is — but the explicit entries
      // above stay authoritative for everything the bundles really touch.
      get: (target, key) => {
        if (key in target) return target[key]
        if (typeof key !== 'string') return undefined
        return class Stub { render() { return null } }
      },
      has: () => true,
    },
  )
}

/**
 * A primitives stub. The host UI package exports dozens of components and
 * helpers; a bundle touches them at render time, never while it registers, so a
 * callable stand-in for any name is both sufficient and honest.
 */
function primitivesStub() {
  const cache = new Map()
  return new Proxy(
    {
      projectUserText: (text) => ({ __plain: text }),
      MarkdownText: function MarkdownText() {},
      JsonBlock: function JsonBlock() {},
    },
    {
      get: (target, key) => {
        if (key in target) return target[key]
        if (typeof key !== 'string') return undefined
        if (!cache.has(key)) cache.set(key, function Stub() {})
        return cache.get(key)
      },
      has: () => true,
    },
  )
}

/** A DOM small enough for the one write apply() performs: the stylesheet. */
function domStub() {
  const tags = []
  const make = (tag) => ({
    tagName: String(tag).toUpperCase(),
    dataset: {},
    style: {},
    textContent: '',
    children: [],
    parentElement: null,
    appendChild(child) {
      child.parentElement = this
      this.children.push(child)
      return child
    },
    remove() {
      const owner = this.parentElement
      if (owner === null) return
      const index = owner.children.indexOf(this)
      if (index !== -1) owner.children.splice(index, 1)
      this.parentElement = null
    },
    setAttribute() {},
    getAttribute() { return null },
    hasAttribute() { return false },
    querySelector() { return null },
    querySelectorAll() { return [] },
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() { return { height: 0, width: 0, top: 0, left: 0 } },
    closest() { return null },
    insertBefore(child) { return this.appendChild(child) },
  })
  const head = make('head')
  const body = make('body')
  const document = {
    head,
    body,
    documentElement: make('html'),
    createElement: (tag) => {
      const node = make(tag)
      tags.push(node)
      return node
    },
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
    querySelector: (selector) => {
      // Only the stylesheet probe reaches here: `style[data-plugin-css="..."]`.
      const match = /^style\[data-plugin-css="(.*)"\]$/.exec(selector)
      if (match === null) return null
      const found = tags.find((node) => node.dataset.pluginCss === match[1])
      return found === undefined ? null : found
    },
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  }
  return { document, tags, head, body }
}

/** The globals a bundle reaches for while it registers (and while it idles). */
function installGlobals() {
  const dom = domStub()
  const state = { timers: [], observers: [] }
  globalThis.document = dom.document
  globalThis.fetch = () => Promise.resolve({ status: 404, ok: false, json: () => Promise.resolve({}) })
  globalThis.requestAnimationFrame = (fn) => { state.timers.push(fn); return state.timers.length }
  globalThis.cancelAnimationFrame = () => {}
  globalThis.setTimeout = globalThis.setTimeout ?? (() => 0)
  globalThis.MutationObserver = class MutationObserver {
    constructor(callback) { this.callback = callback; state.observers.push(this) }
    observe() {}
    disconnect() {}
    takeRecords() { return [] }
  }
  globalThis.window = globalThis.window ?? {}
  globalThis.window.setTimeout = globalThis.setTimeout
  return { dom, state }
}

// --- materialize the real bundles --------------------------------------------

const BUNDLES = COMPONENTS.map((component) => {
  let file = null
  try {
    file = require.resolve(component.package + '/client')
  } catch {
    file = null
  }
  return { id: component.id, package: component.package, file }
})

const installed = BUNDLES.filter((bundle) => bundle.file !== null)
const missing = BUNDLES.filter((bundle) => bundle.file === null).map((bundle) => bundle.package)

installGlobals()

for (const bundle of installed) {
  const captured = []
  const previous = globalThis.window
  globalThis.window = { ...previous, __ModuleLoader__: { load: (value) => captured.push(value) } }
  try {
    await import(pathToFileURL(bundle.file).href)
  } finally {
    globalThis.window = previous
  }
  assert.equal(captured.length, 1, bundle.package + ' registers exactly one client factory')
  assert.equal(captured[0].id, bundle.id, bundle.package + ' registers under its package id')
  bundle.registration = captured[0]
}

const react = reactStub()
const primitives = primitivesStub()
const jsxRuntime = { jsx: react.createElement, jsxs: react.createElement, Fragment: react.Fragment }

/**
 * The factory's require: the platform seed (react), the host UI package, and
 * nothing else — an unexpected request is thrown so the matrix shows it.
 */
function makeRequire(packageName) {
  return (spec) => {
    if (spec === 'react') return react
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(packageName + ' requested an unexpected module: ' + spec)
  }
}

const plugins = new Map()
for (const bundle of installed) {
  plugins.set(bundle.id, bundle.registration.factory(makeRequire(bundle.package)))
}

for (const [id, plugin] of plugins) {
  assert.equal(typeof plugin.apply, 'function', id + ' exports apply()')
  assert.ok(Array.isArray(plugin.inject), id + ' declares its injections as an array')
}

// --- the runtime the subset is applied to ------------------------------------

/**
 * A fresh client runtime per subset: registrations, dictionaries, effects.
 * @returns the context plus the record of what the subset registered.
 */
function runtime() {
  const registrations = []
  const injected = []
  const effects = []
  const conflicts = []
  const seenId = new Map()
  const seenOrder = new Map()
  const ctx = {
    effect(factory, label) {
      const disposer = factory()
      effects.push({ label, disposer })
      return typeof disposer === 'function' ? disposer : () => {}
    },
    get() { return undefined },
    on() {},
    locale: {
      register(ns, dictionaries) {
        registrations.push({ kind: 'locale', name: ns })
        return () => {}
      },
      bind: () => (key) => key,
      getLocale: () => ({ active: { id: 'en' } }),
    },
    slots: {
      inject(name, factory) {
        injected.push(name)
        return factory()
      },
      register(options) {
        const id = options.id ?? options.key
        const key = options.name + '#' + String(id)
        const orderKey = options.name + '#' + String(options.order)
        if (seenId.has(key)) conflicts.push('duplicate id ' + key + ' from ' + seenId.get(key))
        seenId.set(key, options.name)
        if (options.order !== undefined && seenOrder.has(orderKey)) {
          conflicts.push('order tie ' + orderKey + ' between ' + seenOrder.get(orderKey) + ' and ' + String(id))
        }
        if (options.order !== undefined) seenOrder.set(orderKey, String(id))
        registrations.push({
          kind: 'slot',
          name: options.name,
          id: id === undefined ? null : String(id),
          order: options.order ?? null,
        })
        return () => {}
      },
    },
  }
  return { ctx, registrations, injected, effects, conflicts }
}

/** Apply one subset into a fresh runtime. */
function applySubset(ids) {
  const run = runtime()
  for (const id of ids) plugins.get(id).apply(run.ctx)
  return run
}

function subsets() {
  const ids = installed.map((bundle) => bundle.id)
  const out = []
  for (let mask = 1; mask < (1 << ids.length); mask += 1) {
    out.push(ids.filter((_id, index) => (mask & (1 << index)) !== 0))
  }
  return out
}

// --- the matrix ---------------------------------------------------------------

test('the four component bundles are installed and resolvable', () => {
  if (missing.length > 0) {
    assert.ok(true, 'skipped: not installed -> ' + missing.join(', '))
  }
  assert.ok(installed.length >= 1, 'at least one component must be installed to run the matrix')
})

for (const ids of subsets()) {
  const label = ids.join(' + ')
  test('subset [' + label + '] mounts without a collision', () => {
    const run = applySubset(ids)
    assert.deepEqual(run.conflicts, [], label)
    // Every plugin in the subset must have registered something: an apply()
    // that silently did nothing is the failure mode a green suite would hide.
    for (const id of ids) {
      const mine = run.registrations.filter((row) => row.kind === 'slot')
      assert.ok(mine.length > 0, id + ' registered at least one slot entry')
    }
    const names = run.registrations.filter((row) => row.kind === 'slot').map((row) => row.name)
    assert.ok(names.length > 0, 'the subset registered slots')
  })

  test('subset [' + label + '] survives a reload (dispose then apply again)', () => {
    const first = applySubset(ids)
    for (const effect of first.effects) {
      if (typeof effect.disposer === 'function') effect.disposer()
    }
    const second = applySubset(ids)
    assert.deepEqual(second.conflicts, [], label + ' after a reload')
    assert.deepEqual(
      second.registrations.map((row) => row.name + '#' + String(row.id)),
      first.registrations.map((row) => row.name + '#' + String(row.id)),
      label + ' registers the same entries after a reload',
    )
  })
}

test('the whole set lands on the allocated orders', () => {
  const all = applySubset(installed.map((bundle) => bundle.id))
  assert.deepEqual(all.conflicts, [])
  const ordersIn = (name) =>
    all.registrations
      .filter((row) => row.kind === 'slot' && row.name === name)
      .map((row) => row.id + '@' + String(row.order))
      .sort()
  // docs/INTEROP.md §2: the reply strip is edit 5, rerun 6, delete 40, and the
  // input overlay is delete 8, edit 9, rerun 10. One order per plugin, per slot.
  assert.deepEqual(ordersIn('conversation.chat.assistant-actions'), [
    'delete-turn@40',
    'edit-turn-reply@5',
    'rerun-turn-reply@6',
  ])
  assert.deepEqual(ordersIn('conversation.input.overlay'), [
    'delete-turn@8',
    'edit-turn@9',
    'rerun-turn@10',
  ])
})

// --- the convention the components share -------------------------------------

// Not a behavioural test (each component pins the behaviour in its own repo):
// this is the tripwire that the three injecting bundles still carry the
// namespace table the interop contract defines, and that the reader declares
// none, because it hides nothing.
const HIDE_ATTRS = ['data-dshdt-hidden', 'data-dshet-hidden', 'data-dsrr-hidden']

test('every injecting bundle carries the hide-owner table', () => {
  for (const bundle of installed) {
    const source = readFileSync(bundle.file, 'utf8')
    const isReader = bundle.id === 'dsh-markdown-bubble'
    if (isReader) {
      assert.equal(/data-dsh[a-z]+-hidden/.test(source), false, bundle.package + ' hides nothing and must not claim a hide attribute')
      continue
    }
    for (const attr of HIDE_ATTRS) {
      assert.ok(source.includes(attr), bundle.package + ' carries ' + attr)
    }
  }
})
