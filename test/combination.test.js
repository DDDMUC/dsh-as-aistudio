// Combination matrix for the four AI Studio components.
//
// Acceptance goal (user requirement 2, AI-STUDIO-INTEROP.md section 8): any
// subset of the four components - all 2^4 = 16 of them - loaded into ONE client
// runtime must register cleanly: no exception, no duplicate (name, id/key) on a
// slot, no two different ids sharing an `order` on the same slot, every
// registration carrying a legal id.
//
// This file runs in plain Node: no browser, no DSH server, no React runtime.
// Each bundle is materialised the way dsh-markdown-bubble/test/client.test.js
// does it - stub `window.__ModuleLoader__.load`, `await import(...)`, then call
// `registration.factory(require)` - and the DOM stub is the one from
// dsh-edit-turn/test/client.dom.test.js (StubElement / walk / matches), copied
// rather than imported so importing it cannot drag that file's own tests into
// this run. Three fidelity corrections were needed on the copy; each is marked
// CORRECTION with its reason, everything else is verbatim.
//
// The second half drives the real OverlayEntry components of the three
// DOM-enhancing plugins against one shared fake message row and checks
// contract section 4 (hidden-row attribution): while one plugin still owns a
// hide, no other plugin's restore may clear that `display:none` - and once
// every owner has lifted, the row must come back instead of staying wedged.
//
//   node --test "test/combination.test.js"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.resolve(HERE, '..', '..')
const nodeRequire = createRequire(import.meta.url)

const SESSION_ID = 'session-11111111-2222-4333-8444-555555555555'
const ROW_KEY = 'row-1'
const ROW_SEQ = 7
const REVISED_SEQ = 19

/** The four components, in the order every combination applies them. */
const PLUGINS = [
  { name: 'dsh-delete-turn', bundle: 'dsh-delete-turn/src/client.js' },
  { name: 'dsh-edit-turn', bundle: 'dsh-edit-turn/lib/client.js' },
  { name: 'dsh-rerun-turn', bundle: 'dsh-rerun-turn/lib/client.js' },
  { name: 'dsh-markdown-bubble', bundle: 'dsh-markdown-bubble/src/client.js' },
]

/**
 * Where each bundle lives. The package `exports` map is preferred when the
 * component is installed (npm link / optionalDependency); the workspace path
 * is the fallback, so the matrix never silently drops a component: all four
 * repos sit next to this one in the verification workspace.
 */
function bundlePath(plugin) {
  try {
    return { file: nodeRequire.resolve(plugin.name + '/client'), via: 'package exports' }
  } catch {
    return { file: path.join(WORKSPACE, plugin.bundle), via: 'workspace path' }
  }
}

// --- materialise the four bundles --------------------------------------------

/**
 * Each bundle calls `window.__ModuleLoader__.load({ id, factory })` exactly
 * once per process (ESM caching); the captured registration is re-run per case
 * through a fresh `require`, which is what gives every case its own closures -
 * the same trick dsh-edit-turn/test/client.dom.test.js documents.
 */
const registrations = new Map()
for (const plugin of PLUGINS) {
  const { file, via } = bundlePath(plugin)
  let captured = null
  globalThis.window = {
    __ModuleLoader__: {
      load: (value) => {
        captured = value
      },
    },
  }
  await import(pathToFileURL(file).href)
  assert.ok(captured !== null, plugin.name + ' never called __ModuleLoader__.load')
  assert.equal(typeof captured.id, 'string', plugin.name + ': registration.id is not a string')
  assert.equal(typeof captured.factory, 'function', plugin.name + ': registration.factory is not a function')
  registrations.set(plugin.name, { registration: captured, file, via })
}

// --- DOM stub (copied from dsh-edit-turn/test/client.dom.test.js) ------------

class StubElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase()
    this.children = []
    this.parentElement = null
    // `dataset.x` and `data-x` are the same thing in the DOM, and the plugins
    // rely on that: they mark a hide through dataset and find it again with an
    // attribute selector.
    this.dataset = new Proxy(
      {},
      {
        set: (target, key, value) => {
          target[key] = value
          this.attributes[dataAttr(key)] = String(value)
          return true
        },
        // CORRECTION 1: `delete el.dataset.x` removes the attribute in a real
        // DOM. Without this trap the stale attribute survives and every later
        // hasAttribute() check would report a hide that was already lifted -
        // the section-4 scenes would pass for the wrong reason.
        deleteProperty: (target, key) => {
          delete target[key]
          delete this.attributes[dataAttr(key)]
          return true
        },
        // CORRECTION 2: a value written through setAttribute() must be readable
        // through dataset, as in a browser (the fixtures mark rows that way).
        get: (target, key) => {
          if (typeof key === 'symbol' || key in target) return target[key]
          const attr = dataAttr(key)
          return attr in this.attributes ? this.attributes[attr] : undefined
        },
      },
    )
    this.style = {}
    this.attributes = {}
    this.listeners = new Map()
    this._classes = new Set()
    this._text = ''
    this.value = ''
    this.disabled = false
    this.innerHTML = ''
  }

  get classList() {
    const set = this._classes
    return {
      add: (...names) => names.forEach((name) => set.add(name)),
      remove: (...names) => names.forEach((name) => set.delete(name)),
      contains: (name) => set.has(name),
    }
  }

  get className() {
    return [...this._classes].join(' ')
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean))
  }

  get textContent() {
    return this._text
  }

  set textContent(value) {
    this._text = String(value)
    this.children = []
  }

  appendChild(child) {
    if (child.parentElement !== null && child.parentElement !== this) {
      const siblings = child.parentElement.children
      const index = siblings.indexOf(child)
      if (index !== -1) siblings.splice(index, 1)
    }
    child.parentElement = this
    this.children.push(child)
    return child
  }

  insertBefore(child, reference) {
    if (child.parentElement !== null) {
      const index = child.parentElement.children.indexOf(child)
      if (index !== -1) child.parentElement.children.splice(index, 1)
    }
    const at = reference === null || reference === undefined ? this.children.length : this.children.indexOf(reference)
    child.parentElement = this
    this.children.splice(at === -1 ? this.children.length : at, 0, child)
    return child
  }

  get nextElementSibling() {
    if (this.parentElement === null) return null
    const siblings = this.parentElement.children
    const index = siblings.indexOf(this)
    return index === -1 || index === siblings.length - 1 ? null : siblings[index + 1]
  }

  get previousElementSibling() {
    if (this.parentElement === null) return null
    const siblings = this.parentElement.children
    const index = siblings.indexOf(this)
    return index <= 0 ? null : siblings[index - 1]
  }

  after(sibling) {
    if (this.parentElement === null) return
    const siblings = this.parentElement.children
    const index = siblings.indexOf(this)
    if (index === -1) return
    const existing = siblings.indexOf(sibling)
    if (existing !== -1) siblings.splice(existing, 1)
    sibling.parentElement = this.parentElement
    this.parentElement.children.splice(index + 1, 0, sibling)
  }

  get nextSibling() {
    if (this.parentElement === null) return null
    const siblings = this.parentElement.children
    const index = siblings.indexOf(this)
    return index === -1 || index === siblings.length - 1 ? null : siblings[index + 1]
  }

  remove() {
    if (this.parentElement === null) return
    const index = this.parentElement.children.indexOf(this)
    if (index !== -1) this.parentElement.children.splice(index, 1)
    this.parentElement = null
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value)
  }

  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null
  }

  hasAttribute(name) {
    return name in this.attributes
  }

  addEventListener(type, handler) {
    const list = this.listeners.get(type) ?? []
    list.push(handler)
    this.listeners.set(type, list)
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type) ?? []
    this.listeners.set(type, list.filter((item) => item !== handler))
  }

  fire(type, extra = {}) {
    const event = { type, preventDefault() {}, stopPropagation() {}, ...extra }
    const property = this['on' + type]
    if (typeof property === 'function') property(event)
    for (const handler of this.listeners.get(type) ?? []) handler(event)
    return event
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }
  }

  get isConnected() {
    let node = this
    while (node !== null && node !== undefined) {
      if (node === globalThis.document.body || node === globalThis.document.head) return true
      node = node.parentElement
    }
    return false
  }

  focus() {
    this.focusCalls = (this.focusCalls ?? 0) + 1
  }

  setSelectionRange(start, end) {
    this.selectionStart = start
    this.selectionEnd = end
  }

  querySelector(selector) {
    const hits = walk(this).filter((node) => matches(node, selector))
    return hits[0] ?? null
  }

  querySelectorAll(selector) {
    return walk(this).filter((node) => matches(node, selector))
  }

  closest(selector) {
    let node = this
    while (node !== null && node !== undefined) {
      if (matches(node, selector)) return node
      node = node.parentElement
    }
    return null
  }

  matches(selector) {
    return matches(this, selector)
  }
}

/** `dataset.dshdtHidden` <-> `data-dshdt-hidden`, the DOM's own conversion. */
function dataAttr(key) {
  return 'data-' + String(key).replace(/[A-Z]/g, (char) => '-' + char.toLowerCase())
}

/** Pre-order (document order) traversal: a stack would reverse every sibling list. */
function walk(root) {
  const out = []
  const visit = (node) => {
    for (const child of node.children) {
      out.push(child)
      visit(child)
    }
  }
  visit(root)
  return out
}

function matches(node, selector) {
  // `.class:not([attr])`
  const negated = /^\.([\w-]+):not\(\[([\w-]+)\]\)$/.exec(selector)
  if (negated !== null) {
    const name = negated[1]
    const attr = negated[2]
    return node._classes.has(name) && !(attr in node.attributes)
  }
  if (selector.startsWith('.') && !selector.includes('[')) return node._classes.has(selector.slice(1))
  // CORRECTION 3: the plugins look their own stylesheet up with
  // `style[data-plugin-css="<tag id>"]`; the copied matcher had no form for a
  // tag plus an attribute-with-value.
  const tagged = /^([a-z]+)\[([\w-]+)="([^"]*)"\]$/.exec(selector)
  if (tagged !== null) {
    const tag = tagged[1]
    const attr = tagged[2]
    const value = tagged[3]
    return node.tagName === tag.toUpperCase() && node.attributes[attr] === value
  }
  const contains = /^\[([a-z-]+)\*="([^"]+)"\]$/.exec(selector)
  if (contains !== null) {
    const attr = contains[1]
    const needle = contains[2]
    const value = attr === 'class' ? node.className : node.attributes[attr]
    return typeof value === 'string' && value.includes(needle)
  }
  const exact = /^\[([a-z-]+)\]$/.exec(selector)
  if (exact !== null) return exact[1] in node.attributes
  return false
}

// --- one fresh client environment per case -----------------------------------

/**
 * A brand-new window/document/MutationObserver/fetch set per case. Nothing is
 * shared between cases: the stylesheets the factory-level injectors append
 * live in this document, and a shared document would let case N see the
 * leftovers of case N-1. Timers are parked rather than scheduled, so no
 * deferred callback can leak into a later case; `flushTimers` runs them
 * explicitly while this environment is still current.
 */
function makeEnvironment() {
  const documentListeners = new Map()
  const windowListeners = new Map()
  const parked = []
  const body = new StubElement('body')
  const head = new StubElement('head')
  const allNodes = () => [...walk(head), ...walk(body)]
  const document = {
    body,
    head,
    createElement: (tag) => new StubElement(tag),
    addEventListener(type, handler) {
      const list = documentListeners.get(type) ?? []
      list.push(handler)
      documentListeners.set(type, list)
    },
    removeEventListener(type, handler) {
      const list = documentListeners.get(type) ?? []
      documentListeners.set(type, list.filter((item) => item !== handler))
    },
    querySelector: (selector) => allNodes().filter((node) => matches(node, selector))[0] ?? null,
    querySelectorAll: (selector) => allNodes().filter((node) => matches(node, selector)),
  }
  const fetches = []
  const observers = []
  globalThis.document = document
  globalThis.window = {
    setTimeout: (fn) => {
      parked.push(fn)
      return parked.length
    },
    clearTimeout: (id) => {
      if (typeof id === 'number' && id >= 1 && id <= parked.length) parked[id - 1] = null
    },
    clearInterval: () => {},
    setInterval: () => 0,
    addEventListener(type, handler) {
      const list = windowListeners.get(type) ?? []
      list.push(handler)
      windowListeners.set(type, list)
    },
    removeEventListener(type, handler) {
      const list = windowListeners.get(type) ?? []
      windowListeners.set(type, list.filter((item) => item !== handler))
    },
  }
  globalThis.HTMLElement = StubElement
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback
      observers.push(this)
    }
    observe() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  globalThis.requestAnimationFrame = (fn) => fn()
  // Contract I5: a sibling probe that cannot reach its route is ABSENT, not an
  // error. The stub rejects the way an unreachable route does, and the
  // components have to absorb it (no console.error, no thrown exception).
  globalThis.fetch = (url, options) => {
    fetches.push({ url: String(url), options })
    return Promise.reject(new TypeError('fetch failed'))
  }
  return {
    document,
    window,
    fetches,
    observers,
    flushTimers() {
      for (const fn of parked.slice()) {
        if (typeof fn === 'function') fn()
      }
      parked.length = 0
    },
  }
}

// --- module stubs ------------------------------------------------------------

/**
 * React with effects that run on invocation, so one component call is one
 * render pass; cleanups are collected and run by the caller. The shape follows
 * dsh-edit-turn/test/client.dom.test.js.
 */
function reactStub(cleanups) {
  const Fragment = Symbol('Fragment')
  class Component {
    constructor(props) {
      this.props = props
    }
  }
  const createElement = (type, props, ...children) => ({
    __element: true,
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  })
  return {
    Fragment,
    Component,
    createElement,
    isValidElement: (value) => typeof value === 'object' && value !== null && value.__element === true,
    memo: (component) => component,
    useCallback: (fn) => fn,
    useEffect: (fn) => {
      const cleanup = fn()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value ?? null }),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  }
}

/** Every primitives export the four bundles name (grep of the sources). */
function primitivesStub() {
  const noop = function noop() {}
  return {
    Button: noop,
    Modal: noop,
    Tooltip: noop,
    MarkdownText: noop,
    JsonBlock: noop,
    FileTypeIcon: noop,
    IconCheckOutlineRegular: noop,
    IconCopyOutlineRegular: noop,
    fileExtension: () => 'txt',
    fileSizeText: () => '1 KB',
    projectUserText: (text) => text,
    writeClipboard: () => Promise.resolve(true),
  }
}

/**
 * The `require` each factory receives. Unknown modules throw, so a bundle that
 * quietly gained a dependency fails loudly here instead of skipping it.
 */
function makeRequire() {
  const cleanups = []
  const react = reactStub(cleanups)
  const primitives = primitivesStub()
  const jsxRuntime = {
    jsx: (type, props, key) => ({ __element: true, type, props: { ...(props ?? {}), key } }),
    jsxs: (type, props, key) => ({ __element: true, type, props: { ...(props ?? {}), key } }),
    Fragment: react.Fragment,
  }
  const require = (spec) => {
    if (spec === 'react') return react
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error('unexpected require(' + JSON.stringify(spec) + ')')
  }
  require.cleanups = cleanups
  return require
}

// --- the client runtime stub -------------------------------------------------

/**
 * The slot runtime the four plugins see. `register` is where the contract is
 * enforced: a missing name, an illegal identity, a duplicate (slot, identity)
 * or a shared `order` between two different ids on one slot all throw, the way
 * the real runtime refuses to seat two entries at the same place.
 */
function makeRuntime() {
  const entries = []
  const slots = []
  const locales = []
  const effects = []
  const observers = []
  const disposers = []
  const errors = []
  const ctx = {
    slots: {
      inject: (name, factory) => {
        slots.push(name)
        if (typeof factory === 'function') factory()
      },
      register: (options, component) => {
        if (typeof options?.name !== 'string' || options.name === '') {
          throw new TypeError('slot registration without a usable name: ' + JSON.stringify(options))
        }
        const identity = options.id ?? options.key
        if (typeof identity !== 'string' || identity === '') {
          throw new TypeError(
            'slot ' + options.name + ': registration declares neither a string id nor a string key: ' + JSON.stringify(options),
          )
        }
        if (options.id !== undefined && (typeof options.id !== 'string' || options.id === '')) {
          throw new TypeError(
            'slot ' + options.name + ': id must be a non-empty string, got ' + JSON.stringify(options.id),
          )
        }
        for (const entry of entries) {
          if (entry.slot === options.name && entry.identity === identity) {
            throw new Error(
              'slot ' + options.name + ': duplicate registration (name=' + options.name + ', id=' + identity +
                ') - already registered by ' + entry.plugin,
            )
          }
        }
        if (typeof options.order === 'number') {
          for (const entry of entries) {
            if (entry.slot === options.name && entry.order === options.order && entry.identity !== identity) {
              throw new Error(
                'slot ' + options.name + ': order ' + options.order + ' is claimed twice - ' + entry.plugin + '#' +
                  entry.identity + ' and #' + identity + ' (contract section 2 requires a unique order per slot)',
              )
            }
          }
        }
        entries.push({
          plugin: '(unattributed)',
          component,
          slot: options.name,
          identity,
          id: typeof options.id === 'string' ? options.id : null,
          key: typeof options.key === 'string' ? options.key : null,
          order: typeof options.order === 'number' ? options.order : null,
          priority: typeof options.priority === 'number' ? options.priority : null,
          locale: typeof options.locale === 'string' ? options.locale : null,
          options,
        })
        return () => {}
      },
    },
    locale: {
      register: (ns, dicts) => {
        if (typeof ns !== 'string' || ns === '') throw new TypeError('locale.register without a namespace')
        locales.push({ ns, dicts })
        return () => {
          const at = locales.findIndex((item) => item.ns === ns)
          if (at !== -1) locales.splice(at, 1)
        }
      },
      bind: (ns) => (key, params) => {
        if (params !== undefined && params !== null && typeof params === 'object') {
          return String(key).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
        }
        return key
      },
    },
    effect: (factory, label) => {
      effects.push(label ?? '(unlabelled)')
      const dispose = factory()
      const disposer = () => {
        if (typeof dispose === 'function') dispose()
      }
      disposers.push(disposer)
      return disposer
    },
    get: (name) => {
      if (name === 'webServer') return { url: 'http://127.0.0.1:0', baseUrl: 'http://127.0.0.1:0' }
      return null
    },
  }
  return {
    ctx,
    records: { entries, slots, locales, effects, observers, disposers, errors },
    /** Run every recorded disposer (uninstall / HMR teardown). */
    disposeAll() {
      for (const dispose of disposers.slice().reverse()) dispose()
      disposers.length = 0
    },
  }
}

// --- combination runner ------------------------------------------------------

/**
 * Materialise a fresh exports object per plugin (a new factory call, like a
 * reload) and apply each onto one fresh runtime. A plugin whose apply() throws
 * is recorded and asserted on by the caller - never silently skipped.
 */
function loadCombination(names) {
  const env = makeEnvironment()
  const runtime = makeRuntime()
  const loaded = []
  for (const name of names) {
    const captured = registrations.get(name)
    assert.ok(captured !== undefined, 'no registration captured for ' + name)
    const require = makeRequire()
    const exports = captured.registration.factory(require)
    const before = runtime.records.entries.length
    try {
      exports.apply(runtime.ctx)
    } catch (error) {
      runtime.records.errors.push({ plugin: name, error })
    }
    // Attribute the entries this plugin just registered, for the evidence.
    for (let index = before; index < runtime.records.entries.length; index += 1) {
      runtime.records.entries[index].plugin = name
    }
    loaded.push({ name, exports, require })
  }
  return { env, runtime, loaded }
}

function assertClean(label, runtime) {
  assert.deepEqual(
    runtime.records.errors,
    [],
    label + ': apply() threw -> ' +
      runtime.records.errors
        .map((item) =>
          item.plugin + ': ' + (item.error && item.error.stack ? item.error.stack.split('\n')[0] : item.error),
        )
        .join(' | '),
  )
  const seen = new Set()
  for (const entry of runtime.records.entries) {
    assert.equal(typeof entry.slot, 'string', label + ': slot name is not a string')
    assert.notEqual(entry.slot, '', label + ': empty slot name')
    const token = entry.slot + '\u0000' + entry.identity
    assert.equal(seen.has(token), false, label + ': duplicate (' + entry.slot + ', ' + entry.identity + ')')
    seen.add(token)
  }
  const byOrder = new Map()
  for (const entry of runtime.records.entries) {
    if (entry.order === null) continue
    const token = entry.slot + '\u0000' + entry.order
    const previous = byOrder.get(token)
    assert.equal(
      previous,
      undefined,
      label + ': slot ' + entry.slot + ' order ' + entry.order + ' claimed by ' + entry.identity + ' and ' +
        (previous ? previous.identity : '?'),
    )
    byOrder.set(token, entry)
  }
}

function combinationLabel(names) {
  return names.map((name) => name.replace(/^dsh-/, '')).join('+') || '(none)'

}

function combos() {
  const out = []
  for (let mask = 0; mask < 16; mask += 1) {
    const names = PLUGINS.filter((_, index) => (mask & (1 << index)) !== 0).map((plugin) => plugin.name)
    out.push(names)
  }
  return out
}

/** Evidence collected for the report: one row per combination. */
const MATRIX = []

for (const names of combos()) {
  const label = combinationLabel(names)
  test('combination ' + label + ': loads, registers, unloads, reloads', () => {
    const first = loadCombination(names)
    for (const item of first.loaded) {
      assert.ok(Array.isArray(item.exports.inject), item.name + ': exports.inject must be an array')
      assert.ok(item.exports.inject.length > 0, item.name + ': exports.inject is empty')
    }
    assertClean(label, first.runtime)
    // Every plugin in the subset must actually have registered something.
    for (const item of first.loaded) {
      const mine = first.runtime.records.entries.filter((entry) => entry.plugin === item.name)
      assert.ok(mine.length > 0, label + ': ' + item.name + ' registered no slot entry')
    }
    assert.ok(
      first.runtime.records.disposers.length >= names.length,
      label + ': expected at least one effect per plugin',
    )

    // The markdown-bubble diagnostics key must appear with the plugin and go
    // away with its disposer - the unload path has to be honest.
    const markdown = first.loaded.find((item) => item.name === 'dsh-markdown-bubble')
    if (markdown !== undefined) {
      assert.equal(globalThis.__DSH_MARKDOWN_BUBBLE__.version, markdown.exports.PLUGIN_VERSION)
      assert.deepEqual(globalThis.__DSH_MARKDOWN_BUBBLE__.seats, ['user', 'steering'])
    }

    // Snapshot the evidence BEFORE the teardown: the locale disposers splice
    // their namespace out of the record, and the report needs what was mounted.
    const evidence = {
      entries: first.runtime.records.entries.map((entry) => ({
        slot: entry.slot,
        id: entry.identity,
        order: entry.order,
        priority: entry.priority,
      })),
      locales: first.runtime.records.locales.map((item) => item.ns),
      injectedSlots: [...new Set(first.runtime.records.slots)],
    }

    // HMR: uninstall everything, then mount the same subset again from fresh
    // factories. The second load must behave exactly like the first.
    first.runtime.disposeAll()
    if (markdown !== undefined) assert.equal(globalThis.__DSH_MARKDOWN_BUBBLE__, undefined)

    const second = loadCombination(names)
    assertClean(label + ' (reload)', second.runtime)
    assert.deepEqual(
      second.runtime.records.entries.map((entry) => entry.slot + '/' + entry.identity + '@' + (entry.order ?? entry.priority)),
      first.runtime.records.entries.map((entry) => entry.slot + '/' + entry.identity + '@' + (entry.order ?? entry.priority)),
      label + ': the reload registered a different set of slot entries',
    )
    second.runtime.disposeAll()

    MATRIX.push({
      label,
      plugins: names.slice(),
      entries: evidence.entries,
      locales: evidence.locales,
      injectedSlots: evidence.injectedSlots,
      errors: [],
    })
  })
}

// --- the contract's own tables ------------------------------------------------

test('with all four loaded the registrations match the section-2 allocation table exactly', () => {
  const { runtime } = loadCombination(PLUGINS.map((plugin) => plugin.name))
  assertClean('all four', runtime)
  const table = runtime.records.entries.map((entry) =>
    entry.slot + ' | ' + entry.identity + ' | ' + (entry.order ?? 'priority ' + entry.priority),
  )
  assert.deepEqual(table.sort(), [
    'conversation.chat.assistant-actions | delete-turn | 40',
    'conversation.chat.assistant-actions | edit-turn-reply | 5',
    'conversation.chat.assistant-actions | rerun-turn-reply | 6',
    'conversation.chat.node | steering | priority -1',
    'conversation.chat.node | user | priority -1',
    'conversation.input.overlay | delete-turn | 8',
    'conversation.input.overlay | edit-turn | 9',
    'conversation.input.overlay | rerun-turn | 10',
  ])
  assert.deepEqual(runtime.records.locales.map((item) => item.ns).sort(), [
    'dsh-delete-turn',
    'dsh-edit-turn',
    'dsh-rerun-turn',
  ])
  runtime.disposeAll()
})

test('each bundle declares the injections it actually uses', () => {
  for (const plugin of PLUGINS) {
    const exports = registrations.get(plugin.name).registration.factory(makeRequire())
    assert.deepEqual(exports.inject, ['slots', 'locale'], plugin.name + ': unexpected inject list')
    assert.equal(typeof exports.apply, 'function', plugin.name + ': apply is not a function')
  }
})

test('the three injecting bundles still carry the hide-owner table; the reader claims none', () => {
  for (const plugin of PLUGINS) {
    const source = readFileSync(registrations.get(plugin.name).file, 'utf8')
    if (plugin.name === 'dsh-markdown-bubble') {
      // It hides nothing, so it must not claim a hide attribute (rule N/A).
      assert.equal(/data-dsh[a-z]+-hidden/.test(source), false, plugin.name + ' hides nothing and must not claim a hide attribute')
      continue
    }
    for (const attr of ['data-dshdt-hidden', 'data-dshet-hidden', 'data-dsrr-hidden']) {
      assert.ok(source.includes(attr), plugin.name + ' carries ' + attr)
    }
  }
})

// --- section 4: hidden-row attribution across plugins -------------------------

/** The hide markers of the three DOM-enhancing plugins (contract section 4). */
const HIDE = {
  'dsh-delete-turn': { prop: 'dshdtHidden', attr: 'data-dshdt-hidden' },
  'dsh-edit-turn': { prop: 'dshetHidden', attr: 'data-dshet-hidden' },
  'dsh-rerun-turn': { prop: 'dsrrHidden', attr: 'data-dsrr-hidden' },
}

/** A user row shaped like the platform ships one: a message stack and an action bar. */
function mountHostUserRow(document) {
  const row = document.createElement('div')
  row.setAttribute('data-chat-flow-key', ROW_KEY)
  row.setAttribute('data-chat-flow-kind', 'user')
  const layout = document.createElement('div')
  layout.className = 'Sixlwa_userRow'
  const stack = document.createElement('div')
  stack.className = 'Sixlwa_userStack'
  const bubble = document.createElement('div')
  bubble.className = 'Sixlwa_bubble'
  stack.appendChild(bubble)
  const bar = document.createElement('div')
  bar.className = 'xzv4MW_actions'
  const time = document.createElement('span')
  time.className = 'xzv4MW_timeStart'
  time.textContent = '9月25日 19:19'
  const copy = document.createElement('button')
  copy.className = 'xzv4MW_action'
  copy.setAttribute('aria-label', '复制')
  bar.appendChild(time)
  bar.appendChild(copy)
  layout.appendChild(stack)
  layout.appendChild(bar)
  row.appendChild(layout)
  document.body.appendChild(row)
  return { row, bar }
}

/** The same row without an action bar: edit-turn then hides it whole. */
function mountBareUserRow(document) {
  const row = document.createElement('div')
  row.setAttribute('data-chat-flow-key', ROW_KEY)
  row.setAttribute('data-chat-flow-kind', 'user')
  const stack = document.createElement('div')
  stack.className = 'Sixlwa_userStack'
  row.appendChild(stack)
  document.body.appendChild(row)
  return { row }
}

function deleteView(hidden) {
  return {
    hidden: hidden ? new Map([[ROW_SEQ, 'message']]) : new Map(),
    surface: new Set([ROW_SEQ]),
    replyTurns: new Set(),
    edits: new Map(),
    markerTurns: new Set(),
    surfaceReady: false,
    surfaceThrough: 99,
    loaded: true,
    loadError: false,
    dialog: null,
    pending: false,
    failure: null,
  }
}

function editView(hidden) {
  return {
    hidden: hidden ? new Map([[ROW_SEQ, 1]]) : new Map(),
    revisions: hidden ? new Map([[ROW_SEQ, REVISED_SEQ]]) : new Map(),
    editable: new Map([[REVISED_SEQ, { turn: 1, messageId: 'm-1', text: 'rewritten prompt', attachments: 0 }]]),
    replies: new Map(),
    repliesByMessage: new Map(),
    editing: null,
    surfaceReady: true,
    loaded: true,
    loadError: false,
  }
}

function rerunView(hidden) {
  return {
    hidden: hidden ? new Map([[ROW_SEQ, 1]]) : new Map(),
    replies: new Map(),
    repliesByMessage: new Map(),
    reruns: [],
    markerTurns: new Set(),
    retiredTurns: new Set(),
    rerunning: false,
    rerunFocus: null,
    progress: null,
    busy: false,
    loaded: true,
    loadError: false,
  }
}

/**
 * Mount two of the three DOM plugins on one shared row and drive their real
 * OverlayEntry components. `a` hides first, then `b`; then `b` lifts first and
 * `a` second. The scene asserts the section-4 rule at the moment it matters:
 * while one plugin still owns a hide, the other plugin's restore must leave
 * `display:none` in force - and once every owner has lifted, the row must come
 * back instead of staying wedged.
 *
 * @param options.a - plugin that hides first.
 * @param options.b - plugin that restores first.
 * @param options.withBar - the row keeps its action bar (edit-turn then hides
 *   by collapsing content instead of hiding the whole row).
 */
async function attributionScene({ a, b, withBar }) {
  const env = makeEnvironment()
  const runtime = makeRuntime()
  const parts = new Map()
  for (const name of [a, b]) {
    const captured = registrations.get(name)
    const require = makeRequire()
    const exports = captured.registration.factory(require)
    const before = runtime.records.entries.length
    exports.apply(runtime.ctx)
    // Only the entries THIS plugin registered: with two plugins loaded, the
    // first overlay in the record can belong to the other one.
    const entry = runtime.records.entries.slice(before).find((item) => item.slot === 'conversation.input.overlay')
    assert.ok(entry !== undefined, name + ' did not register the overlay entry')
    const injected = entry.options.inject(SESSION_ID)
    parts.set(name, { exports, entry, controller: injected.controller, cleanups: require.cleanups })
  }
  const mounted = withBar ? mountHostUserRow(env.document) : mountBareUserRow(env.document)
  const row = mounted.row
  const snapshot = { nodes: new Map([[ROW_KEY, { kind: 'user', data: { seq: ROW_SEQ }, anchorSeq: ROW_SEQ }]]) }
  const t = (key) => key

  /** One DOM pass of `name` with its own view set to `hidden`. */
  const pass = (name, hidden) => {
    const part = parts.get(name)
    if (name === 'dsh-delete-turn') {
      // delete-turn reads the render-time view through the hook.
      const view = deleteView(hidden)
      part.entry.component({ useChat: () => snapshot, useDeletion: () => view, controller: part.controller, t })
      return
    }
    if (name === 'dsh-edit-turn') {
      part.controller.publish(editView(hidden))
      part.entry.component({
        useChat: () => snapshot,
        useEditTurn: () => part.controller.getSnapshot(),
        controller: part.controller,
        t,
      })
      return
    }
    part.controller.publish(rerunView(hidden))
    part.entry.component({
      useChat: () => snapshot,
      useRerunTurn: () => part.controller.getSnapshot(),
      controller: part.controller,
      t,
    })
  }

  const markerOf = (name) => HIDE[name]
  const settles = (name) => row.dataset[markerOf(name).prop] === '1' || row.hasAttribute(markerOf(name).attr)

  // Both mounted: neither owns anything yet. A stub element starts with no
  // inline display at all, which is exactly "visible".
  const shown = () => (row.style.display ?? '') === ''
  pass(a, false)
  pass(b, false)
  assert.ok(shown(), a + '/' + b + ': a fresh row must be visible')

  // a hides the row.
  pass(a, true)
  assert.ok(settles(a), a + ' did not claim its hide marker')
  if (a !== 'dsh-edit-turn' || !withBar) assert.equal(row.style.display, 'none', a + ' hid the row')

  // b hides the same row: two owners now.
  pass(b, true)
  assert.ok(settles(b), b + ' did not claim its hide marker')
  assert.equal(row.style.display, 'none', a + ' + ' + b + ': the row is hidden')

  // b lifts first: a still owns a hide, so the display must stay down. This is
  // the section-4 rule - a restore that cleared a sibling's display:none fails
  // right here.
  pass(b, false)
  assert.equal(row.style.display, 'none', b + ' cleared a display:none that ' + a + ' still owns (contract section 4 / I4)')

  // a lifts second.
  pass(a, false)

  // Converge: some plugins keep their marker until the last foreign hide is
  // gone, so run passes until the row stops changing.
  for (let round = 0; round < 6; round += 1) {
    const before = row.style.display + '|' + settles(a) + '|' + settles(b)
    pass(a, false)
    pass(b, false)
    if (row.style.display + '|' + settles(a) + '|' + settles(b) === before) break
  }
  assert.equal(row.style.display, '', a + ' + ' + b + ': the row stayed wedged after both lifted')
  assert.ok(!settles(a), a + ': hide marker left behind')
  assert.ok(!settles(b), b + ': hide marker left behind')

  // Unmount the components and flush the deferred teardown while this
  // environment is still current.
  for (const part of parts.values()) {
    for (const cleanup of part.cleanups.slice().reverse()) cleanup()
  }
  env.flushTimers()
  runtime.disposeAll()
  return { row }
}

const ATTRIBUTION_PAIRS = [
  ['dsh-delete-turn', 'dsh-edit-turn'],
  ['dsh-edit-turn', 'dsh-delete-turn'],
  ['dsh-delete-turn', 'dsh-rerun-turn'],
  ['dsh-rerun-turn', 'dsh-delete-turn'],
  ['dsh-edit-turn', 'dsh-rerun-turn'],
  ['dsh-rerun-turn', 'dsh-edit-turn'],
]

for (const pair of ATTRIBUTION_PAIRS) {
  const a = pair[0]
  const b = pair[1]
  test('section-4 attribution ' + a + ' -> ' + b + ': a restore never clears a sibling hide (row with action bar)', async () => {
    await attributionScene({ a, b, withBar: true })
  })
}

for (const pair of ATTRIBUTION_PAIRS) {
  const a = pair[0]
  const b = pair[1]
  if (a !== 'dsh-edit-turn' && b !== 'dsh-edit-turn') continue
  test('section-4 attribution ' + a + ' -> ' + b + ': same, on a row without an action bar', async () => {
    await attributionScene({ a, b, withBar: false })
  })
}

test('section-4 control: with no sibling marker standing, the same restore DOES clear display', async () => {
  // The negative control for the scenes above: the identical restore path must
  // reveal the row when no other plugin owns a hide. Without it the guard
  // assertions could pass vacuously.
  const env = makeEnvironment()
  const runtime = makeRuntime()
  const require = makeRequire()
  const exports = registrations.get('dsh-rerun-turn').registration.factory(require)
  exports.apply(runtime.ctx)
  const entry = runtime.records.entries.find((item) => item.slot === 'conversation.input.overlay')
  const controller = entry.options.inject(SESSION_ID).controller
  const mounted = mountHostUserRow(env.document)
  const row = mounted.row
  const snapshot = { nodes: new Map([[ROW_KEY, { kind: 'user', data: { seq: ROW_SEQ }, anchorSeq: ROW_SEQ }]]) }
  const render = (hidden) => {
    controller.publish(rerunView(hidden))
    entry.component({ useChat: () => snapshot, useRerunTurn: () => controller.getSnapshot(), controller, t: (k) => k })
  }
  render(true)
  assert.equal(row.style.display, 'none')
  assert.equal(row.dataset.dsrrHidden, '1')
  render(false)
  assert.equal(row.style.display, '', 'the control restore failed to reveal the row')
  assert.equal(row.dataset.dsrrHidden, undefined)
  for (const cleanup of require.cleanups.slice().reverse()) cleanup()
  env.flushTimers()
  runtime.disposeAll()
})

// --- evidence table for the report --------------------------------------------

test('evidence table (printed for the report)', () => {
  const lines = []
  lines.push('| combination | slot entries registered | locale namespaces | injected slots |')
  lines.push('| --- | --- | --- | --- |')
  for (const row of MATRIX) {
    const entries = row.entries
      .map((entry) => entry.slot.split('.').pop() + ':' + entry.id + '@' + (entry.order ?? 'p' + entry.priority))
      .join(', ')
    lines.push(
      '| ' + row.label + ' | ' + entries + ' | ' + (row.locales.join(', ') || '-') + ' | ' +
        (row.injectedSlots.map((slot) => slot.split('.').pop()).join(', ') || '-') + ' |',
    )
  }
  console.log('\n=== combination matrix evidence ===')
  for (const line of lines) console.log(line)
  console.log('=== end evidence ===\n')
  assert.equal(MATRIX.length, 16, 'every combination was recorded')
})
