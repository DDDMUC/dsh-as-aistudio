// dsh-as-aistudio — the component manifest.
//
// One table, read by the host half, the browser half and the tests. It is the
// single place that knows which plugins this studio composes, and the only
// place that has to change when a component is added or retired.
//
// A component is always an independent npm package with its own repo, its own
// cordis.patch.yml and its own working UI when installed alone. This file does
// not vendor, wrap or re-implement any of them: it names them, and the bundle
// patch enables the rows that mount them.
//
// Each component is mounted by ONE row of the bundle patch, named
// `<this package>/<suffix>` (see rowNameOf below) with the component package in
// its config.plugin; src/shell.js is the file every one of those names resolves
// to. The suffixes are part of the manifest because three things have to agree
// on them: cordis.patch.yml, package.json exports, and the status route that
// matches a component to its row.
//
// "optional" is the honest word for a component: the studio boots with any
// subset of them present (none, one, two, three, four), because every row the
// patch inserts fails in isolation when its package is missing — one entry
// reports the missing module, every other entry still starts (see
// @cordisjs/plugin-loader: Entry#_init catches the import error and returns).

/** This package. Kept in sync with package.json and the client half. */
export const STUDIO_ID = 'dsh-as-aistudio'

/** Keep in sync with package.json and src/client.js. */
export const STUDIO_VERSION = '0.2.8'

/**
 * The AI Studio action strip this studio composes, in the order the user meets
 * it on a message: edit a prompt and re-run it, re-run a reply in place, delete
 * what should never have been said — and the reader that turns a sent prompt
 * into rendered Markdown.
 *
 * `slot` records the registration the component owns; it is documentation and
 * an assertion source (test/manifest.test.js proves the allocation is unique),
 * never a runtime dependency. Each component registers itself.
 *
 * `suffix` is the bundle-patch row that mounts the component: the row is named
 * `<this package>/<suffix>`. Two properties ride on that name, and both are
 * load-bearing (docs/INTEROP.md section 11):
 *
 *   - the plugin list is a deduplicated set of package identities, and a subpath
 *     of this package resolves to this package's identity, so four extra rows
 *     still cost exactly zero extra list rows;
 *   - the client-module scanner accepts only an exact package specifier, so a
 *     subpath row never becomes a second browser source for the component - its
 *     browser half keeps travelling inside this package's bundle.
 */
export const COMPONENTS = [
  {
    id: 'dsh-edit-turn',
    package: 'dsh-edit-turn',
    suffix: 'edit',
    feature: 'edit',
    kind: 'action',
    repo: 'https://github.com/DDDMUC/dsh-edit-turn',
    slot: { name: 'conversation.chat.assistant-actions', entryId: 'edit-turn-reply', order: 5 },
    overlay: { name: 'conversation.input.overlay', entryId: 'edit-turn', order: 9 },
    title: { zh: '编辑并重跑', en: 'Edit & re-run' },
    pitch: {
      zh: '在消息行上就地改提示词，会话回滚到那一条之前再用新措辞重问一次；日志一个字节都不改写。',
      en: 'Rewrite a prompt in place on the message row, roll the conversation back to just before it, then re-prompt with the new wording. The append-only log is never rewritten.',
    },
  },
  {
    id: 'dsh-rerun-turn',
    package: 'dsh-rerun-turn',
    suffix: 'rerun',
    feature: 'rerun',
    kind: 'action',
    repo: 'https://github.com/DDDMUC/dsh-rerun-turn',
    slot: { name: 'conversation.chat.assistant-actions', entryId: 'rerun-turn-reply', order: 6 },
    overlay: { name: 'conversation.input.overlay', entryId: 'rerun-turn', order: 10 },
    title: { zh: '原位重跑', en: 'Re-run in place' },
    pitch: {
      zh: '同一句提示词重新生成一条回复，后面所有轮次原样存活 —— 后续模型调用读到的是 A B C1 D E F G。',
      en: 'Regenerate one reply from the same prompt while every later turn survives, so later model calls read A B C1 D E F G.',
    },
  },
  {
    id: 'dsh-delete-turn',
    package: 'dsh-delete-turn',
    suffix: 'delete',
    feature: 'delete',
    kind: 'action',
    repo: 'https://github.com/DDDMUC/dsh-delete-turn',
    slot: { name: 'conversation.chat.assistant-actions', entryId: 'delete-turn', order: 40 },
    overlay: { name: 'conversation.input.overlay', entryId: 'delete-turn', order: 8 },
    title: { zh: '删除这一轮', en: 'Delete this turn' },
    pitch: {
      zh: '把一条消息、一个步骤或整条回复从模型上下文里真正拿掉，同时从当前转录里隐藏。',
      en: 'Remove a message, one reply step or a whole reply from the derived model context, and hide it from the visible transcript.',
    },
  },
  {
    id: 'dsh-markdown-bubble',
    package: 'dsh-markdown-bubble',
    suffix: 'markdown',
    feature: 'render',
    kind: 'reader',
    repo: 'https://github.com/DDDMUC/dsh-markdown-bubble',
    slot: null,
    overlay: null,
    title: { zh: 'Markdown 气泡', en: 'Markdown bubble' },
    pitch: {
      zh: '发出的提示词按 Markdown 渲染（列表、代码、表格、引用），排队与预览仍保持纯文本投影。',
      en: 'Sent prompts render as Markdown (lists, code, tables, quotes) while queues and previews keep the plain projection.',
    },
  },
]

/** Component ids, in manifest order. */
export const COMPONENT_IDS = COMPONENTS.map((c) => c.id)

/**
 * The bundle-patch row that mounts one component, in this package's namespace.
 * @param component - a manifest entry.
 * @returns the Loader row name, e.g. 'dsh-as-aistudio/edit'.
 */
export function rowNameOf(component) {
  return STUDIO_ID + '/' + component.suffix
}

/** Every component row name, in manifest order. */
export const COMPONENT_ROW_NAMES = COMPONENTS.map(rowNameOf)

/**
 * The interop contract this studio verifies (docs/INTEROP.md §2 and §4). The
 * browser half renders it in the studio panel so a user can see — without
 * reading the sources — which row each component claims and why a combination
 * cannot fight over a row.
 */
export const INTEROP = {
  hideOwners: [
    { id: 'dsh-delete-turn', key: 'dshdt', attr: 'data-dshdt-hidden' },
    { id: 'dsh-edit-turn', key: 'dshet', attr: 'data-dshet-hidden' },
    { id: 'dsh-rerun-turn', key: 'dsrr', attr: 'data-dsrr-hidden' },
  ],
  overlayOrders: [
    { id: 'dsh-delete-turn', order: 8 },
    { id: 'dsh-edit-turn', order: 9 },
    { id: 'dsh-rerun-turn', order: 10 },
    { id: STUDIO_ID, order: 12 },
  ],
}
