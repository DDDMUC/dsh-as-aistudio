// dsh-bare-preset host half (dsh-bare-preset..persona.mjs), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-bare-preset/lib/index.js  (v0.1.1, sha256 802e33451d61a6ed)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
/**
 * bare-persona —— 裸模模式唯一的一条提示词行。
 *
 * 两件事：
 *
 * 1. 人设：用一个 `complete: true` 的空段落独占系统提示词，并关掉运行时快照，
 *    于是渲染出来的系统消息是零个 content block —— 也就是"没有系统提示词"。
 *
 * 2. 工具表：`tools.restrict({ allow: [] })` 把继承来的（宿主/全局）工具全挡掉。
 *    注意它管不到"注册进 agent 自己那一层"的工具（如 Agent Teams 的 9 个），
 *    那部分由本包的宿主插件 lib/index.js 在每个 agent 创建/每轮开始前剪掉。
 *
 * 配置项（组合里传）：complete / includeRuntimeContext / noTools / text。
 */

export const name = 'bare-persona'

/** 提示词注册表 + 工具视图。 */
export const inject = ['systemPrompt', 'tools']

/**
 * @param ctx - 该预设的 agent 作用域。
 * @param config - complete、includeRuntimeContext、noTools、text。
 */
export function apply(ctx, config = {}) {
  const text = String(config.text ?? '')
  const complete = config.complete ?? true
  const includeRuntimeContext = config.includeRuntimeContext ?? false
  const noTools = config.noTools ?? true

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'deployment:persona',
    order: 0,
    text,
    ...(complete ? { complete: true } : {}),
  }), 'bare-persona.section()')

  if (!includeRuntimeContext) ctx.systemPrompt.suppressRuntimeContext()

  // 空 allow = 这个作用域看不到任何继承来的工具；本作用域自己注册的不受影响。
  if (noTools) ctx.effect(() => ctx.tools.restrict({ allow: [] }), 'bare-persona.restrict()')
}
