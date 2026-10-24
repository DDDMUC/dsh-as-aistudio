// dsh-markdown-bubble host half (dsh-markdown-bubble.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-markdown-bubble/src/index.js  (v0.1.5, sha256 27114f0f8f55a7c6)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * dsh-markdown-bubble — host half.
 *
 * The plugin has no host-side behavior: a sent message's bubble is drawn by
 * the browser's chat view, and how it renders is a client-side projection of
 * the same text the drawer already receives. The host row exists so the
 * package is mounted by the Loader — the client-module scanner scans Loader
 * entries for packages declaring `dsh.client` — and so the bundle patch has a
 * row id to insert.
 *
 * @module dsh-markdown-bubble
 */

/** Stable plugin id (matches the bundle patch's insert id and the client module id). */
export const PLUGIN_ID = 'dsh-markdown-bubble'

/** Keep in sync with package.json and src/client.js. */
export const PLUGIN_VERSION = '0.1.5'

/** Cordis plugin name; the bundle patch resolves the package by this row. */
export const name = PLUGIN_ID

/** Services the inert entry needs: none. */
export const inject = []

/**
 * Inert apply: the browser half owns every behavior.
 * @param {import('@deepseek-ai/cordis').Context} _ctx - owning context.
 */
export function apply(_ctx) {}
