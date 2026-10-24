// The component-row shell: the one file every `dsh-as-aistudio/<suffix>` row
// resolves to (package.json maps all four subpaths to src/shell.js).
//
// The shell is what makes the composition work at all now: the studio no longer
// mounts anything itself, so a component is mounted exactly when its row applies
// and this file mounts config.plugin. These tests drive it with data: URLs, so
// they need neither the component repositories nor a profile to be installed.
//
//   node --test "test/*.test.js"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Config, apply, inject, name } from '../src/shell.js'
import { COMPONENTS, STUDIO_ID } from '../src/components.js'
import { pluginOf } from '../src/index.js'

/** A context stub recording what the shell mounted. */
function contextStub() {
  const mounted = []
  return {
    mounted,
    ctx: {
      plugin: (plugin) => {
        mounted.push(plugin)
        return { dispose() {} }
      },
    },
  }
}

test('the shell exports the row contract', () => {
  assert.equal(typeof apply, 'function')
  assert.deepEqual(inject, [], 'the shell must activate on its own, before any service')
  assert.equal(name, STUDIO_ID + '/component')
})

test('the shell config is a Standard Schema that passes the row through', () => {
  const schema = Config['~standard']
  assert.equal(schema.version, 1)
  assert.deepEqual(schema.validate({ plugin: 'dsh-edit-turn' }), { value: { plugin: 'dsh-edit-turn' } })
  assert.deepEqual(schema.validate(undefined), { value: undefined })
  const rejected = schema.validate(['not', 'a', 'mapping'])
  assert.ok(Array.isArray(rejected.issues), 'a non-mapping is refused with issues')
  assert.match(rejected.issues[0].message, /dsh-as-aistudio/)
})

// The three shapes the four components actually export. dsh-edit-turn and
// dsh-delete-turn have a default export; dsh-rerun-turn and dsh-markdown-bubble
// export only named members, so the module namespace itself is the plugin and
// its apply() is what gets mounted. Judged by pluginOf, the same function the
// shell runs on whatever the vendored file exports.
test('the three plugin shapes are recognised, and nothing else is', () => {
  const fn = function editTurn() {}
  assert.equal(pluginOf({ default: fn }), fn, 'a default-exported function')
  const named = { apply() {} }
  assert.equal(pluginOf(named), named, 'a namespace with its own apply')
  const object = { apply() {} }
  assert.equal(pluginOf({ default: object }), object, 'a default-exported plugin object')
  assert.equal(pluginOf({ answer: 42 }), null, 'anything else has no usable shape')
  assert.equal(pluginOf(null), null)
})

test('a component row mounts the vendored host half of that component', async () => {
  // The point of the vendoring: the row names the COMPONENT, and what gets
  // mounted is the copy beside this package - no component package installed.
  // dsh-markdown-bubble's host half is the one that imports nothing but node
  // builtins, so it is the one that can be imported here; the other three import
  // the platform's own packages, which exist only inside a running DSH. That
  // their vendored copies are current is what test/sync.test.js guards.
  const stub = contextStub()
  await apply(stub.ctx, { plugin: 'dsh-markdown-bubble' })
  assert.equal(stub.mounted.length, 1, 'exactly one plugin is mounted')
  assert.equal(stub.mounted[0].name, 'dsh-markdown-bubble', 'the vendored host half is what got mounted')
})

test('a row that names no plugin fails loudly instead of mounting nothing', async () => {
  // A silent no-op here is the "advertised but cannot work" failure: the row
  // would be listed, its fiber would look healthy, and no component would exist.
  for (const config of [undefined, {}, { plugin: '' }, { plugin: 7 }]) {
    await assert.rejects(
      () => apply(contextStub().ctx, config),
      /dsh-as-aistudio: this component row names no plugin/,
      'config ' + JSON.stringify(config) + ' must be refused',
    )
  }
})

test('a row naming a package that is not one of ours is refused by name', async () => {
  await assert.rejects(
    () => apply(contextStub().ctx, { plugin: 'dsh-a-package-that-does-not-exist' }),
    /dsh-a-package-that-does-not-exist.*is not one of this studio's components/,
  )
})

test('a component that fails to start makes the row fail, not a bare no-op', async () => {
  // The row's fiber must end up failed so /status reports hostMounted: false.
  // Swallowing the rejection here would report a component that never started.
  const stub = contextStub()
  stub.ctx.plugin = () => Promise.reject(new Error('a tool is already registered'))
  await assert.rejects(() => apply(stub.ctx, { plugin: 'dsh-markdown-bubble' }), /a tool is already registered/)
})
