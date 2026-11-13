// dsh-bare-preset host half (dsh-bare-preset.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-bare-preset/lib/index.js  (v0.1.1, sha256 96cd941e9f97a674)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
/**
 * bare-preset（宿主）—— 把「裸模模式」这个 agent 预设置成一个插件。
 *
 * 为什么不再用预设目录 + bundle patch：
 *
 *   • bundle patch 里的行要注册进 registry，registry 挂载时用的是它自己的
 *     baseUrl，`./persona-file.mjs` 这类相对路径解析不到（而写死绝对路径又
 *     绑死目录）；另外 id 必须是字符串、声明归属还要和「预设工作台」的运行时
 *     声明抢所有权 —— 这一串坑都踩过了。
 *   • 现在这个包自己做主：激活时直接 `agentPresets.register()`，卸载时注销；
 *     组合里的提示词行用包内子路径 `dsh-bare-preset/persona`，由 node 自己解析，
 *     没有任何相对路径问题。
 *
 * 顺带一件事：`tools.restrict()` 只裁「继承来的」全局工具，而 Agent Teams 用
 * `const scoped = agent.ctx` 把 9 个团队工具注册进 agent 自己那一层，按设计不受
 * restrict 约束、也不能同名遮蔽（同层 duplicate）。但 `view().registrations` 给出
 * 的是注册表里的真身（不是副本）：把它的 `when` 换成恒假，`resolve()` 在 admit
 * 阶段就会整个剔除 —— wire 上没有、系统提示的工具目录里也没有。
 *
 * 这个剪裁只对本预设的 agent 生效，其他会话（含团队协作）一点都不受影响。
 */

export const name = 'bare-preset'

/** 预设注册表（必需）；tools / agents 由内层 inject 按可选依赖处理。 */
export const inject = ['agentPresets']

/** 预设 id。 */
const PRESET_ID = 'bare'

/** 本预设要剪掉的「agent 作用域工具」——目前就是 Agent Teams 那一套。 */
const PRUNED_TOOL_NAMES = [
  'spawn_teammate',
  'list_agents',
  'send_message',
  'wait_agent',
  'interrupt_agent',
  'team_task_create',
  'team_task_get',
  'team_task_list',
  'team_task_update',
]

/**
 * 要让这个预设"看不到"的 runtime context 名字。
 *
 * `team:identity` 由 tool-agent-team 注册进 agent 本层；`working-directory:current`
 * 由 working-directory 注册在全局层。把本层的条目标成 `required: false`（全局那条
 * 则在本层放一个 required:false 的影子），装配末尾的
 * `contexts.filter(entry => requiredContexts.has(entry.name))` 就会把它们整条丢掉。
 *
 * 为什么不能像工具那样在 `agent/pre-step` 里事后删消息：agent-loop 在真正 append
 * 之前会**重新算一遍**（`refreshContext` + `runtimeContext.project`），所以那条
 * runtime-context 消息根本不是 pre-step 里能摘掉的那一份。必须在装配阶段让它为空。
 */
const SUPPRESSED_CONTEXTS = ['team:identity', 'working-directory:current']

/** 恒假的 admit 条件；同一个函数对象也用来做幂等标记。 */
const DENIED = function () {
  return false
}

/** 提示词行的绝对 file URL（组合里的行由 registry 在它自己的 baseUrl 下加载）。 */
const PERSONA_URL = new URL('../persona.mjs', import.meta.url).href

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

  // ── 2. 剪掉别人塞进 agent 作用域的工具与团队身份行 ──────────────────────
  ctx.inject(['tools', 'agents', 'systemPrompt'], (sctx) => {
    const tools = sctx.get('tools')
    const agentSvc = sctx.get('agents')
    const prompt = sctx.get('systemPrompt')
    if (tools === undefined || agentSvc === undefined) return

    const isBare = function (agent) {
      try {
        return String(presets.composedPreset(agent.ctx) || '') === PRESET_ID
      } catch (_) {
        return false
      }
    }

    const prune = function (agent) {
      if (agent === undefined || agent === null) return
      if (!isBare(agent)) return
      let view
      try { view = tools.view(agent) } catch (_) { return }
      for (const toolName of PRUNED_TOOL_NAMES) {
        const registration = view.registrations.get(toolName)
        if (registration === undefined || registration.when === DENIED) continue
        registration.when = DENIED
      }
      suppressContexts(agent)
    }

    /** 已经在本层放过影子的 context 名（WeakMap<agent, Set<name>>）。 */
    const shadowedContexts = new WeakMap()

    /**
     * 让本 agent 的装配结果里不再出现 SUPPRESSED_CONTEXTS 列出的 runtime context。
     *
     * - `team:identity` 由 tool-agent-team 注册在 **agent 本层**：直接把 required 翻 false；
     * - `working-directory:current` 注册在 **全局层**：不能全局改（会波及所有会话），
     *   于是在 agent 本层放一个 `required: false` 的影子 —— merge 时本层优先，
     *   装配末尾 `requiredContexts.has(name)` 就不认它了，working-directory 那条
     *   assemble 监听器事后补回去的贡献同样会被这一步滤掉。
     *
     * 全部被滤掉后，`joinContextSections([])` 得到空串，`project()` 在"从没有过快照"
     * 的会话里直接返回 undefined —— 那条 runtime-context user 消息就不会出现。
     */
    const suppressContexts = function (agent) {
      const layers = prompt === undefined ? undefined : prompt.layers
      if (layers === undefined || !(layers.scoped instanceof Map)) return
      let layer
      try { layer = layers.peek(agent) } catch (_) { return }

      for (const contextName of SUPPRESSED_CONTEXTS) {
        const own = layer === undefined || layer.contexts === undefined
          ? undefined
          : layer.contexts.get(contextName)
        if (own !== undefined) {
          if (own.required !== false) own.required = false
          continue
        }
        const globalEntry = layers.global === undefined || layers.global.contexts === undefined
          ? undefined
          : layers.global.contexts.get(contextName)
        if (globalEntry === undefined) continue
        let done = shadowedContexts.get(agent)
        if (done === undefined) {
          done = new Set()
          shadowedContexts.set(agent, done)
        }
        if (done.has(contextName)) continue
        done.add(contextName)
        const actx = agent.ctx
        if (actx === undefined || actx === null || actx.systemPrompt === undefined) continue
        actx.effect(() => actx.systemPrompt.context({
          ...globalEntry,
          required: false,
          text: '',
        }), 'bare-preset.shadowContext(' + contextName + ')')
      }
    }

    const pruneAll = function () {
      let list = []
      try { list = agentSvc.list() } catch (_) { return }
      for (const agent of list) prune(agent)
    }

    pruneAll()

    // 团队工具也挂在 agent/created 上安装：等同步监听器跑完再剪，再补一刀延时兜底。
    sctx.on('agent/created', function (event) {
      const agent = event && event.agent
      queueMicrotask(function () { prune(agent) })
      setTimeout(function () { prune(agent) }, 120)
    })

    // 最稳的一刀：turn/start 一定早于本次 step 的 tools.resolve()。
    sctx.on('session/event', function (subject, event) {
      if (event === undefined || event.type !== 'turn/start') return
      let agent
      try { agent = agentSvc.get(subject.id) } catch (_) { return }
      prune(agent)
    })
  })
}
