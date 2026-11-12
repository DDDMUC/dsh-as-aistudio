// dsh-bubble-pro host half (dsh-bubble-pro.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-bubble-pro/src/index.js  (v0.1.0, sha256 9a6aed91430cadb7)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * dsh-bubble-pro — host half.
 *
 * 浏览器半部独占全部行为：它只给「用户消息」的座位加一层样式，把气泡改成
 * 铺满对话列、与输入框同宽的记录式排版。宿主侧没有任何行为，这一行只是让
 * Loader 有东西可挂、让 bundle patch 有 id 可插。
 *
 * @module dsh-bubble-pro
 */

/** 稳定插件 id（与 bundle patch、client 模块 id 一致）。 */
export const PLUGIN_ID = 'dsh-bubble-pro'

/** 与 package.json / src/client.js 保持同步。 */
export const PLUGIN_VERSION = '0.1.0'

/** Loader 行使用的插件名。 */
export const name = PLUGIN_ID

/** 不需要任何服务。 */
export const inject = []

/**
 * 空实现：行为都在浏览器半部。
 * @param {unknown} _ctx - 所属上下文。
 */
export function apply(_ctx) {}
