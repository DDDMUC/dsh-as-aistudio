// dsh-fork-anywhere host half (dsh-fork-anywhere.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-fork-anywhere/src/index.js  (v0.1.0, sha256 53e4d54dc9eb5d6e)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * dsh-fork-anywhere — host half.
 *
 * The plugin has no host-side behavior. A fork is the shipped Host operation
 * `session/fork` (`atSeq` is its inclusive cut), and the only thing missing was
 * a way to reach it from a row - a prompt row or a compaction checkpoint, both
 * of which are client-side rendering concerns. The host row exists so the package is mounted by the Loader — the
 * client-module scanner scans Loader entries for packages declaring
 * `dsh.client` — and so the bundle patch has a row id to insert.
 *
 * @module dsh-fork-anywhere
 */

/** Stable plugin id (matches the bundle patch's insert id and the client module id). */
export const PLUGIN_ID = 'dsh-fork-anywhere'

/** Keep in sync with package.json and src/client.js. */
export const PLUGIN_VERSION = '0.1.0'

/** Cordis plugin name; the bundle patch resolves the package by this row. */
export const name = PLUGIN_ID

/** Services the inert entry needs: none. */
export const inject = []

/**
 * Inert apply: the browser half owns every behavior.
 * @param {unknown} _ctx - owning context.
 */
export function apply(_ctx) {}
