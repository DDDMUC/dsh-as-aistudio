// dsh-bare-preset host half (dsh-bare-preset.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-bare-preset/lib/index.js  (v0.2.0, sha256 e9ea6fd8c4ccb3a1)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
/**
 * bare-preset（宿主）—— 把「裸模模式」这个 agent 预设置成一个插件。
 *
 * 为什么不再用预设目录 + bundle patch：
 *
 *   • bundle patch 里的行要注册进 registry，registry 挂载时用的是它自己的
 *     baseUrl，`./persona-file.mjs` 这类相对路径解析不到（写死绝对路径又绑死目录）；
 *     外加 id 必须是字符串、声明归属还要和「预设工作台」的运行时声明抢所有权。
 *   • 现在这个包自己做主：激活时 `agentPresets.register()`，卸载时注销；
 *     组合里的提示词行用包内绝对 file URL，没有任何相对路径问题。
 *
 * 剪裁策略是「全清」，不是名单：
 *
 *   1. 全局（继承来的）工具由 persona 行的 `tools.restrict({ allow: [] })` 挡掉；
 *   2. **agent 本层**注册的工具（谁塞的都算）—— `view().registrations` 给出的是
 *      注册表里的真身，把 `when` 换成恒假，`resolve()` 的 admit 阶段就整个剔除；
 *      只动本层，绝不碰全局层（碰了会影响所有会话）；
 *   3. **agent 本层的 context** 直接 `required = false`；**祖先/全局层的 context**
 *      在本层放一个 `required: false` 的影子 —— 装配末尾
 *      `contexts.filter(e => requiredContexts.has(e.name))` 会把它们整条丢掉，
 *      同样不修改全局对象。
 *
 *   于是不管以后哪个插件往 agent 作用域里注册工具或 context，都会在下一轮开始
 *   前被清掉（`turn/start` 早于本步的 tools.resolve / 上下文装配），不需要维护名单。
 *
 * 这套剪裁只对本预设的 agent 生效，其他会话（含团队协作）一点都不受影响。
 */

export const name = 'bare-preset'

/** 预设注册表（必需）；tools / agents / systemPrompt 由内层 inject 按可选依赖处理。 */
export const inject = ['agentPresets']

/** 预设 id。 */
const PRESET_ID = 'bare'

/** 恒假的 admit 条件；同一个函数对象也用来做幂等标记。 */
const DENIED = function () {
  return false
}

/** 提示词行的绝对 file URL（组合里的行由 registry 在它自己的 baseUrl 下加载）。 */
const PERSONA_URL = new URL('./dsh-bare-preset..persona.mjs', import.meta.url).href

/** 交给 registry 的预设声明。 */
const DEFINITION = {
  id: PRESET_ID,
  name: '裸模模式',
  description: '没有任何系统提示词，也看不到任何工具——只剩你说的话和模型本身。想观察模型的原生行为，或当作「从零开始」的底板。',
  order: 6,
  plugins: [
    {
      id: 'persona',
      name: PERSONA_URL,
      config: {
        complete: true,
        includeRuntimeContext: false,
        noTools: true,
      },
    },
    {
      // 长对话压缩：与 standard / bare 模板同一套栈，避免上下文无限增长。
      id: 'compaction',
      name: 'cordis:group',
      group: true,
      isolate: {
        compaction: true,
      },
      config: [
        { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
        { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
      ],
    },
  ],
}

/**
 * @param ctx - 宿主插件上下文。
 */
export function apply(ctx) {
  const presets = ctx.agentPresets
  if (presets === undefined) return

  // ── 1. 注册预设（卸载时注销）──────────────────────────────────────────
  ctx.effect(() => {
    let alive = true
    let dispose
    Promise.resolve()
      .then(() => presets.register(DEFINITION))
      .then((undo) => {
        if (alive) {
          dispose = undo
          return
        }
        try { Promise.resolve(undo()).catch(() => {}) } catch (_) { /* ignore */ }
      })
      .catch((error) => {
        try {
          ctx.logger.warn('bare-preset: register failed: ' + (error && error.message ? error.message : String(error)))
        } catch (_) { /* ignore */ }
      })
    return () => {
      alive = false
      if (typeof dispose !== 'function') return
      try { Promise.resolve(dispose()).catch(() => {}) } catch (_) { /* ignore */ }
    }
  }, 'bare-preset.register()')

  // ── 2. 每轮开清空 agent 本层的工具与上下文 ─────────────────────────────
  ctx.inject(['tools', 'agents', 'systemPrompt'], (sctx) => {
    const tools = sctx.get('tools')
    const agentSvc = sctx.get('agents')
    const prompt = sctx.get('systemPrompt')

    /** 已经在本层放过影子的 context 名（WeakMap<agent, Set<name>>）。 */
    const shadowedContexts = new WeakMap()

    const isBare = function (agent) {
      try {
        return String(presets.composedPreset(agent.ctx) || '') === PRESET_ID
      } catch (_) {
        return false
      }
    }

    /**
     * 把 agent 本层注册的工具全部 deny 掉。
     *
     * 只认本层的 registration（`layers.peek(agent).tools.get(name)` 与视图里的对象
     * 是同一个才动手）：全局层的对象是所有会话共用的，动一下会波及整台机器。
     * @param agent - 目标 agent。
     */
    const denyOwnTools = function (agent) {
      let layers
      let view
      try {
        layers = tools.layers
        view = tools.view(agent)
      } catch (_) {
        return
      }
      const ownLayer = layers === undefined ? undefined : layers.peek(agent)
      const ownTools = ownLayer === undefined ? undefined : ownLayer.tools
      if (ownTools === undefined) return
      for (const [toolName, registration] of view.registrations) {
        if (ownTools.get(toolName) !== registration) continue
        if (registration.when === DENIED) continue
        registration.when = DENIED
      }
    }

    /**
     * 让本 agent 看不到任何 context（团队身份、cwd、时长、沙盒策略……全都在内）。
     *
     * 本层注册的直接翻 `required`；祖先/全局层的在本层放 `required: false` 的影子，
     * 凭借「就近覆盖」和装配末尾的 required 过滤把原条目顶掉，不去改全局对象。
     * @param agent - 目标 agent。
     */
    const suppressContexts = function (agent) {
      const layers = prompt === undefined ? undefined : prompt.layers
      if (layers === undefined || !(layers.scoped instanceof Map)) return
      let merged
      try {
        merged = layers.merge(agent, (layer) => layer.contexts)
      } catch (_) {
        return
      }
      const ownLayer = layers.peek(agent)
      const ownContexts = ownLayer === undefined ? undefined : ownLayer.contexts
      let shadowed = shadowedContexts.get(agent)
      if (shadowed === undefined) {
        shadowed = new Set()
        shadowedContexts.set(agent, shadowed)
      }
      const actx = agent.ctx
      for (const [contextName, entry] of merged) {
        if (entry === undefined || entry === null) continue
        if (ownContexts !== undefined && ownContexts.get(contextName) === entry) {
          if (entry.required !== false) entry.required = false
          continue
        }
        if (shadowed.has(contextName)) continue
        shadowed.add(contextName)
        if (actx === undefined || actx === null || actx.systemPrompt === undefined) continue
        try {
          actx.effect(() => actx.systemPrompt.context({
            name: contextName,
            order: Number.isFinite(entry.order) ? entry.order : 0,
            required: false,
            text: '',
          }), 'bare-preset.shadowContext(' + contextName + ')')
        } catch (_) { /* 影子失败不影响主流程 */ }
      }
    }

    const trim = function (agent) {
      if (agent === undefined || agent === null) return
      if (!isBare(agent)) return
      denyOwnTools(agent)
      suppressContexts(agent)
    }

    const trimAll = function () {
      let list = []
      try { list = agentSvc.list() } catch (_) { return }
      for (const agent of list) trim(agent)
    }

    trimAll()

    // 工具/上下文是别的插件在 agent 创建时挂上去的：等同步监听器跑完，再补一刀延时兜底。
    sctx.on('agent/created', function (event) {
      const agent = event && event.agent
      queueMicrotask(function () { trim(agent) })
      setTimeout(function () { trim(agent) }, 120)
    })

    // 最稳的一刀：turn/start 一定早于本步的 tools.resolve() 与上下文装配。
    // 运行中新注册的工具/上下文也会在这里被清掉，不需要维护名单。
    sctx.on('session/event', function (subject, event) {
      if (event === undefined || event.type !== 'turn/start') return
      let agent
      try { agent = agentSvc.get(subject.id) } catch (_) { return }
      trim(agent)
    })
  })
}
