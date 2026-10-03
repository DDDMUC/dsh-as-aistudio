// The test that was missing, and the reason 0.2.0/0.2.1 shipped a bundle whose
// four components silently never mounted: every other test inspected the
// generated bundle as TEXT. This one EXECUTES it exactly as the browser does -
// through its __ModuleLoader__ factory - and asserts the components actually
// mount and claim their slots.
//
// The original defect: tools/build.mjs emitted the mount table with shorthand
// properties ({ factory_dsh_edit_turn, ... }), so the keys were the factory
// VARIABLE names while the studio looks up by COMPONENT ID
// (VENDORED_TABLE['dsh-edit-turn']). Every lookup was undefined, vendoredFactory
// returned null, and applyVendored returned false without an error. bundle.test
// checked that 'VENDORED_TABLE' appeared in the text - and it did, in a comment.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const ORDER = ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn', 'dsh-markdown-bubble']

/** Run the generated bundle the way the browser does and return what happened. */
function runBundle() {
  const src = readFileSync(join(root, 'src', 'client.js'), 'utf8')
  let captured = null
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const previousMarker = globalThis.__DSH_AS_AISTUDIO__
  globalThis.window = { __ModuleLoader__: { load(entry) { captured = entry } } }
  const element = { dataset: {}, style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }
  globalThis.document = {
    head: { appendChild() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => element,
    addEventListener: () => {},
  }
  try {
    new Function(src)()
    assert.equal(typeof captured, 'object', 'the bundle must call __ModuleLoader__.load')
    assert.equal(captured.id, 'dsh-as-aistudio')

    class Component {
      constructor(props) { this.props = props || {}; this.state = {} }
      setState(next) { Object.assign(this.state, next) }
      render() { return null }
    }
    const createElement = (type, props, ...kids) => ({
      __element: true,
      type,
      props: Object.assign({}, props, { children: kids.length <= 1 ? kids[0] : kids }),
    })
    const react = {
      Component,
      createElement,
      memo: (component) => component,
      useEffect: () => {}, useLayoutEffect: () => {}, useCallback: (f) => f,
      useState: (value) => [value, () => {}],
      useMemo: (factory) => factory(),
      useRef: (value) => ({ current: value }),
      Fragment: 'Fragment',
    }
    const primitives = {
      projectUserText: (text) => text,
      MarkdownText: function MarkdownText() {},
      JsonBlock: function JsonBlock() {},
      Tooltip: (props) => props.children,
      FileTypeIcon: function FileTypeIcon() {},
      IconCopyOutlineRegular: function IconCopyOutline() {},
      IconCheckOutlineRegular: function IconCheckOutline() {},
      fileExtension: () => 'txt',
      fileSizeText: () => '1 KB',
      writeClipboard: () => Promise.resolve(true),
    }
    const table = {
      react,
      'react/jsx-runtime': { jsx: createElement, jsxs: createElement, Fragment: 'Fragment' },
      '@deepseek-ai/dsh-client-ui-primitives': primitives,
    }
    const require = (spec) => {
      if (Object.prototype.hasOwnProperty.call(table, spec)) return table[spec]
      throw new Error('unexpected require(' + JSON.stringify(spec) + ')')
    }

    const exports = captured.factory(require)
    const registered = []
    const ctx = {
      slots: {
        inject(name, factory) { factory() },
        register(options) {
          registered.push({ name: options.name, id: options.id, order: options.order })
          return { dispose() {} }
        },
      },
      locale: {
        register: () => () => {},
        bind: () => (key) => key,
        getLocale: () => ({ active: { id: 'zh-CN' } }),
      },
      // The platform keeps the disposer for teardown; calling it here would undo
      // the very mount we are asserting.
      effect(factory) { factory() },
      inject: () => {},
    }
    exports.apply(ctx)
    return { exports, registered, marker: globalThis.__DSH_AS_AISTUDIO__ }
  } finally {
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    if (previousMarker === undefined) delete globalThis.__DSH_AS_AISTUDIO__
    else globalThis.__DSH_AS_AISTUDIO__ = previousMarker
  }
}

test('the mount table is keyed by component id, not by factory name', () => {
  // This is the exact shape the studio looks up. A table keyed by
  // 'factory_dsh_edit_turn' looks identical to a text search and is useless.
  const src = readFileSync(join(root, 'src', 'client.js'), 'utf8')
  const line = src.split('\n').find((l) => l.indexOf('const VENDORED_TABLE = ') !== -1)
  assert.ok(line, 'the bundle declares VENDORED_TABLE')
  for (const id of ORDER) {
    assert.ok(line.indexOf(JSON.stringify(id) + ':') !== -1, id + ' must be a key of the mount table: ' + line.trim())
  }
  assert.equal(/\{\s*factory_/.test(line), false, 'the table must not use bare factory-name shorthand')
})

test('applying the bundle mounts all four components', () => {
  const { marker } = runBundle()
  assert.ok(marker, 'the studio records its mount state')
  for (const id of ORDER) assert.equal(marker.mounted[id], true, id + ' must mount')
})

test('applying the bundle claims the section-2 slot allocation', () => {
  const { registered } = runBundle()
  const actions = registered.filter((row) => row.name === 'conversation.chat.assistant-actions')
  const overlay = registered.filter((row) => row.name === 'conversation.input.overlay')
  const orders = new Map(actions.map((row) => [row.id, row.order]))
  assert.equal(orders.get('edit-turn-reply'), 5)
  assert.equal(orders.get('rerun-turn-reply'), 6)
  assert.equal(orders.get('delete-turn'), 40)
  const overlayOrders = new Map(overlay.map((row) => [row.id, row.order]))
  assert.equal(overlayOrders.get('edit-turn'), 9)
  assert.equal(overlayOrders.get('rerun-turn'), 10)
  assert.equal(overlayOrders.get('delete-turn'), 8)
  // markdown-bubble renders seats, not action buttons.
  assert.ok(registered.some((row) => row.name === 'conversation.chat.node'), 'markdown-bubble claims a render seat')
  // The studio's own surface is still there.
  assert.ok(registered.some((row) => row.name === 'settings.plugins.tab' && row.id === 'as-aistudio'))
})

test('no vendored component is reached through a subpath require', () => {
  // Guard the design: the factories are stitched into this bundle, so they must
  // not depend on this package resolving its own subpaths at runtime.
  const { exports } = runBundle()
  assert.deepEqual(exports.VENDORED, ORDER)
})
