// Contract tests for the composition itself: the manifest is the one place that
// knows which plugins this studio composes, so these tests are the gate that
// keeps a new component from silently colliding with an existing one.
//
// What is asserted here is exactly what docs/INTEROP.md promises:
//   - every component is an independent package with its own repo;
//   - every slot order is unique, so no two components can fight over a row;
//   - the studio's own registrations never collide with a component's;
//   - every component carries copy in both languages.
//
//   node --test "test/*.test.js"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COMPONENTS, COMPONENT_IDS, INTEROP, STUDIO_ID, STUDIO_VERSION } from '../src/components.js'

const NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const SEMVER = /^\d+\.\d+\.\d+$/

test('the studio names itself and keeps one version', () => {
  assert.equal(STUDIO_ID, 'dsh-as-aistudio')
  assert.match(STUDIO_VERSION, SEMVER)
  assert.match(STUDIO_ID, NPM_NAME)
})

test('every component is an independent npm package with its own repo', () => {
  for (const component of COMPONENTS) {
    assert.equal(component.id, component.package, component.id + ': id and package must agree')
    assert.match(component.package, NPM_NAME)
    assert.match(component.repo, /^https:\/\/github\.com\//, component.id + ': needs a repo link')
    assert.ok(['action', 'reader'].includes(component.kind), component.id + ': kind')
    assert.notEqual(component.package, STUDIO_ID)
  }
})

test('component ids are unique and ordered', () => {
  assert.equal(new Set(COMPONENT_IDS).size, COMPONENT_IDS.length)
  assert.deepEqual(COMPONENT_IDS, [...COMPONENT_IDS])
})

test('every component speaks both languages', () => {
  for (const component of COMPONENTS) {
    for (const locale of ['zh', 'en']) {
      assert.equal(typeof component.title[locale], 'string', component.id + ': title.' + locale)
      assert.ok(component.title[locale].length > 0, component.id + ': title.' + locale + ' is empty')
      assert.equal(typeof component.pitch[locale], 'string', component.id + ': pitch.' + locale)
      assert.ok(component.pitch[locale].length > 0, component.id + ': pitch.' + locale + ' is empty')
    }
  }
})

test('no two components claim the same slot order', () => {
  const seen = new Map()
  for (const component of COMPONENTS) {
    for (const registration of [component.slot, component.overlay]) {
      if (registration === null || registration === undefined) continue
      const key = registration.name + '#' + registration.order
      assert.equal(seen.has(key), false, key + ' is claimed by ' + seen.get(key) + ' and ' + component.id)
      seen.set(key, component.id)
    }
  }
})

test('the assistant action strip is ordered edit, rerun, delete', () => {
  const strip = COMPONENTS.filter((component) => component.slot !== null && component.slot.name === 'conversation.chat.assistant-actions')
  const ordered = [...strip].sort((a, b) => a.slot.order - b.slot.order).map((component) => component.id)
  assert.deepEqual(ordered, ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn'])
})

test('the input overlay allocation matches the published contract', () => {
  const overlay = COMPONENTS.filter((component) => component.overlay !== null && component.overlay !== undefined)
    .map((component) => ({ id: component.id, order: component.overlay.order }))
  const published = INTEROP.overlayOrders.filter((row) => row.id !== STUDIO_ID)
  assert.deepEqual(overlay.sort((a, b) => a.order - b.order), published.sort((a, b) => a.order - b.order))
})

test('the studio overlay order collides with nothing', () => {
  const orders = new Set()
  for (const component of COMPONENTS) {
    if (component.overlay !== null && component.overlay !== undefined) orders.add(component.overlay.order)
  }
  const own = INTEROP.overlayOrders.filter((row) => row.id === STUDIO_ID)
  assert.equal(own.length, 1, 'the studio claims exactly one overlay order')
  assert.equal(orders.has(own[0].order), false, 'the studio overlay order must not collide')
})

test('the hide-owner table names one attribute per owning component', () => {
  const owners = INTEROP.hideOwners.map((row) => row.id)
  for (const row of INTEROP.hideOwners) {
    assert.match(row.attr, /^data-ds[a-z]+-hidden$/, row.id + ': attribute shape')
    assert.ok(COMPONENT_IDS.includes(row.id), row.id + ' must be a component')
  }
  assert.equal(new Set(owners).size, owners.length)
})
