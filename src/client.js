// dsh-as-aistudio — browser half.
//
// What this does
// --------------
// The action strip the studio composes already lives on the message rows:
// dsh-edit-turn's pencil, dsh-rerun-turn's arrows and dsh-delete-turn's bin,
// plus dsh-markdown-bubble's renderer. What no single component can answer is
// *which of them are on right now*, so this half adds exactly one surface and
// nothing else:
//
//   Settings -> Plugins -> "AI Studio"
//
// It reads GET /api/dsh-as-aistudio/status (the host half) and renders one row
// per component with its live state — enabled, installed but not enabled, or
// absent — plus the interop allocation the components agree on
// (docs/INTEROP.md §2, §4), so a reader can see why a combination cannot fight
// over a row.
//
// Deliberately absent, because the components own those surfaces and a second
// writer would break them: no MutationObserver, no row injection, no hiding, no
// action strip, no keyboard listener, no polling. This half mounts a tab and
// fetches once per open; a missing host route renders as copy, not as a crash.
//
// The bundle follows the client-modules contract: it registers a factory with
// window.__ModuleLoader__.load and returns the plugin exports.
window.__ModuleLoader__.load({
  id: 'dsh-as-aistudio',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')

    /** Plugin identity; also the locale namespace. */
    const NS = 'dsh-as-aistudio'

    /** Keep in sync with package.json and src/components.js. */
    const PLUGIN_VERSION = '0.1.1'

    /** Presence marker the live verifier reads. */
    const DEBUG_KEY = '__DSH_AS_AISTUDIO__'

    /** Style tag id claimed by this plugin (HMR and dispose remove it by id). */
    const CSS_TAG = NS + '/as-aistudio.css'

    /** The host route this half reads. Relative on purpose: web and desktop share it. */
    const STATUS_ROUTE = '/api/dsh-as-aistudio/status'

    /** Tab placement: behind the platform's own plugin-list tabs. */
    const TAB_ORDER = 100

    const h = react.createElement

    // --- copy ------------------------------------------------------------------

    const zh = {
      tab: 'AI Studio',
      heading: 'AI Studio 组件',
      intro:
        '这些组件就是 AI Studio 式的一轮循环：改提示词并重跑、原位重跑、删掉这一轮，以及把发出的提示词按 Markdown 渲染。每一个都是独立插件 —— 只装一个也能用，任意子集都能共存，全部装上互不打架。',
      summary: '已启用 {mounted} / {total} 个组件。',
      statusMounted: '已启用',
      statusInstalled: '已安装，未启用',
      statusMissing: '未安装',
      enabledEntries: '{count} 条启用条目',
      version: '版本 {version}',
      versionUnknown: '版本未知',
      repo: '仓库',
      claimsNone: '不占槽位（只替换聊天节点渲染器）',
      refresh: '刷新',
      loading: '正在读取组件状态…',
      error: '读取组件状态失败：{reason}',
      loaderHidden: '宿主的 loader 不可见，状态以「已安装」为准。',
      interopHeading: '互操作契约',
      interopOverlay: '输入浮层槽 order 分配（同槽不得撞号）',
      interopHide: '行隐藏归属属性（别人声明的隐藏，我不能清掉）',
      host: '宿主 DSH {version}',
      hostUnknown: '宿主版本未知',
    }

    const en = {
      tab: 'AI Studio',
      heading: 'AI Studio components',
      intro:
        'These components are the AI Studio loop for a turn: revise a prompt and re-run it, re-run a reply in place, delete the turn, and render sent prompts as Markdown. Each one is an independent plugin — one alone works, any subset coexists, and all four together stay out of each other\u2019s way.',
      summary: '{mounted} of {total} components are enabled.',
      statusMounted: 'Enabled',
      statusInstalled: 'Installed, not enabled',
      statusMissing: 'Not installed',
      enabledEntries: '{count} enabled entries',
      version: 'v{version}',
      versionUnknown: 'version unknown',
      repo: 'Repo',
      claimsNone: 'No slot (replaces chat node renderers only)',
      refresh: 'Refresh',
      loading: 'Reading component status…',
      error: 'Could not read component status: {reason}',
      loaderHidden: 'The host loader is not visible; status falls back to \"installed\".',
      interopHeading: 'Interop contract',
      interopOverlay: 'Input overlay slot order allocation (one order per slot)',
      interopHide: 'Row-hide ownership attributes (a foreign hide is never cleared)',
      host: 'host DSH {version}',
      hostUnknown: 'host version unknown',
    }

    /** Fill {key} placeholders; an unknown key stays visible instead of printing undefined. */
    function fill(text, vars) {
      return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
      )
    }

    // --- per-component copy ------------------------------------------------------

    const COMPONENT_COPY = {
      'dsh-edit-turn': {
        zh: { title: '编辑并重跑', pitch: '就地改提示词，回滚到那一条之前再用新措辞重问；日志不改写。' },
        en: {
          title: 'Edit & re-run',
          pitch: 'Rewrite a prompt in place, roll back to just before it, re-prompt. The log is never rewritten.',
        },
      },
      'dsh-rerun-turn': {
        zh: { title: '原位重跑', pitch: '同一句提示词重新生成，后面所有轮次原样存活（A B C1 D E F G）。' },
        en: {
          title: 'Re-run in place',
          pitch: 'Regenerate one reply from the same prompt while later turns survive (A B C1 D E F G).',
        },
      },
      'dsh-delete-turn': {
        zh: { title: '删除这一轮', pitch: '把一条消息、一个步骤或整条回复从模型上下文里真正拿掉。' },
        en: {
          title: 'Delete this turn',
          pitch: 'Remove a message, a step or a whole reply from the derived model context.',
        },
      },
      'dsh-markdown-bubble': {
        zh: { title: 'Markdown 气泡', pitch: '发出的提示词按 Markdown 渲染；排队与预览保持纯文本。' },
        en: { title: 'Markdown bubble', pitch: 'Sent prompts render as Markdown; queues and previews stay plain.' },
      },
    }

    /** The overlay allocation from docs/INTEROP.md §2, mirrored for display. */
    const OVERLAY_ORDERS = [
      { id: 'dsh-delete-turn', order: 8 },
      { id: 'dsh-edit-turn', order: 9 },
      { id: 'dsh-rerun-turn', order: 10 },
      { id: 'dsh-as-aistudio', order: 12 },
    ]

    /** The hide-ownership attributes from docs/INTEROP.md §4, mirrored for display. */
    const HIDE_OWNERS = ['data-dshdt-hidden', 'data-dshet-hidden', 'data-dsrr-hidden']

    /**
     * Pick the copy for one component in one language.
     * @param id - component id.
     * @param chinese - whether the active locale is Chinese.
     * @returns title and pitch, falling back to the bare id.
     */
    function copyFor(id, chinese) {
      const row = COMPONENT_COPY[id]
      if (row === undefined) return { title: id, pitch: '' }
      return chinese ? row.zh : row.en
    }

    // --- styles -----------------------------------------------------------------

    const CSS = [
      '.dsas-root{flex-direction:column;gap:14px;display:flex;padding:2px 0 8px}',
      '.dsas-intro{color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size,14px);line-height:1.6;margin:0}',
      '.dsas-bar{align-items:center;gap:10px;display:flex;flex-wrap:wrap}',
      '.dsas-summary{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size,14px);font-weight:500;margin:0}',
      '.dsas-meta{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);margin:0}',
      '.dsas-refresh{border:.5px solid var(--dsw-alias-border-l2,#0000001f);border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:var(--dsh-content-font-size-secondary,13px);padding:4px 10px}',
      '.dsas-refresh:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsas-refresh:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}',
      '.dsas-list{flex-direction:column;gap:8px;display:flex;list-style:none;margin:0;padding:0}',
      '.dsas-row{border:.5px solid var(--dsw-alias-border-l2,#0000001f);border-radius:12px;flex-direction:column;gap:6px;display:flex;padding:10px 12px}',
      '.dsas-rowHead{align-items:center;gap:8px;display:flex;flex-wrap:wrap}',
      '.dsas-dot{border-radius:50%;flex:none;width:8px;height:8px;background:var(--dsw-alias-label-tertiary)}',
      '.dsas-dot[data-state=mounted]{background:var(--dsw-alias-state-success-primary,#22a06b)}',
      '.dsas-dot[data-state=installed]{background:var(--dsw-alias-state-warning-primary,#d98b00)}',
      '.dsas-dot[data-state=missing]{background:var(--dsw-alias-state-danger-primary,#d94040)}',
      '.dsas-name{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size,14px);font-weight:600}',
      '.dsas-badge{border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;padding:1px 8px;background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsas-pitch{color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:1.6;margin:0}',
      '.dsas-foot{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.7;margin:0}',
      '.dsas-code{font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px}',
      '.dsas-link{color:inherit;text-decoration:underline}',
      '.dsas-error{color:var(--dsw-alias-state-danger-primary,#d94040);font-size:var(--dsh-content-font-size-secondary,13px);margin:0}',
      '.dsas-interop{border-top:.5px solid var(--dsw-alias-border-l2,#0000001f);flex-direction:column;gap:6px;display:flex;padding-top:12px}',
      '.dsas-interopTitle{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);font-weight:600;margin:0}',
    ].join('')

    /** Inject the stylesheet once; HMR sweeps by data-plugin, dispose by tag id. */
    function injectStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = NS
      tag.dataset.pluginCss = CSS_TAG
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /** Remove the stylesheet this plugin injected, if still present. */
    function removeStyles() {
      if (typeof document === 'undefined') return
      const tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']')
      if (tag !== null) tag.remove()
    }

    // --- status read ------------------------------------------------------------

    /**
     * One row's state. `mounted` needs the loader view; when the host did not
     * report one (`mounted === null`) an installed package reads as available
     * rather than as broken.
     * @param component - one component row from the host payload.
     * @returns mounted, installed or missing.
     */
    function stateOf(component) {
      if (component.mounted === true) return 'mounted'
      if (component.installed === true) return component.mounted === null ? 'mounted' : 'installed'
      return 'missing'
    }

    /** The status route, with a cache-buster so a refresh always re-reads. */
    function statusUrl(request) {
      return request === 0 ? STATUS_ROUTE : STATUS_ROUTE + '?n=' + String(request)
    }

    // --- react entries ----------------------------------------------------------

    /**
     * The studio tab: one row per component, plus the interop allocation.
     * @param props - slot props: t (locale-bound) and currentLocale.
     */
    function StudioPanel({ t, currentLocale }) {
      const [request, setRequest] = react.useState(0)
      const [view, setView] = react.useState({ status: 'loading' })

      react.useEffect(() => {
        let current = true
        setView({ status: 'loading' })
        const done = (next) => {
          if (current) setView(next)
        }
        let pending
        try {
          pending = fetch(statusUrl(request), { headers: { accept: 'application/json' } })
        } catch (error) {
          done({ status: 'error', reason: String((error && error.message) || error) })
          return undefined
        }
        Promise.resolve(pending)
          .then((response) =>
            response.json().then(
              (body) => ({ response, body }),
              () => ({ response, body: null }),
            ),
          )
          .then(({ response, body }) => {
            if (body !== null && body.ok === true && Array.isArray(body.components)) {
              done({ status: 'ready', body })
              return
            }
            done({ status: 'error', reason: 'HTTP ' + response.status })
          })
          .catch((error) => done({ status: 'error', reason: String((error && error.message) || error) }))
        return () => {
          current = false
        }
      }, [request])

      const localeId = typeof currentLocale === 'function' ? currentLocale() : ''
      const chinese = String(localeId).toLowerCase().startsWith('zh')
      const copy = (id) => copyFor(id, chinese)
      const ready = view.status === 'ready'
      const summary = ready
        ? fill(t('summary'), { mounted: view.body.summary.mounted, total: view.body.summary.total })
        : t('heading')
      const hostLine =
        ready && view.body.dsh !== null && view.body.dsh !== undefined
          ? fill(t('host'), { version: view.body.dsh })
          : ready
            ? t('hostUnknown')
            : ''
      const rows = ready ? view.body.components.map((component) => renderRow(component, copy, t)) : []
      return h('div', { className: 'dsas-root' }, [
        h('p', { className: 'dsas-intro', key: 'intro' }, t('intro')),
        h('div', { className: 'dsas-bar', key: 'bar' }, [
          h('p', { className: 'dsas-summary', key: 'summary' }, summary),
          h(
            'button',
            {
              type: 'button',
              className: 'dsas-refresh',
              key: 'refresh',
              onClick: () => setRequest((value) => value + 1),
            },
            t('refresh'),
          ),
        ]),
        hostLine === '' ? null : h('p', { className: 'dsas-meta', key: 'host' }, hostLine),
        view.status === 'loading' ? h('p', { className: 'dsas-meta', key: 'loading' }, t('loading')) : null,
        view.status === 'error'
          ? h('p', { className: 'dsas-error', key: 'error', role: 'status' }, fill(t('error'), { reason: view.reason }))
          : null,
        ready && view.body.loaderVisible === false
          ? h('p', { className: 'dsas-meta', key: 'loader' }, t('loaderHidden'))
          : null,
        ready ? h('ul', { className: 'dsas-list', key: 'list' }, rows) : null,
        renderInterop(t),
      ])
    }

    /** One component row. */
    function renderRow(component, copy, t) {
      const state = stateOf(component)
      const text = copy(component.id)
      const stateLabel =
        state === 'mounted' ? t('statusMounted') : state === 'installed' ? t('statusInstalled') : t('statusMissing')
      const claims =
        component.feature === 'render'
          ? t('claimsNone')
          : 'conversation.chat.assistant-actions + conversation.input.overlay'
      const enabled = Array.isArray(component.entries)
        ? fill(t('enabledEntries'), { count: component.entries.filter((entry) => !entry.disabled).length })
        : ''
      const version =
        component.version === null || component.version === undefined
          ? t('versionUnknown')
          : fill(t('version'), { version: component.version })
      const tail = [claims, enabled].filter((part) => part !== '').join(' · ')
      return h('li', { className: 'dsas-row', key: component.id }, [
        h('div', { className: 'dsas-rowHead', key: 'head' }, [
          h('span', { className: 'dsas-dot', 'data-state': state, key: 'dot' }),
          h('span', { className: 'dsas-name', key: 'name' }, text.title),
          h('span', { className: 'dsas-badge', key: 'badge' }, stateLabel),
          h('span', { className: 'dsas-badge dsas-code', key: 'version' }, version),
        ]),
        h('p', { className: 'dsas-pitch', key: 'pitch' }, text.pitch),
        h(
          'p',
          { className: 'dsas-foot', key: 'foot' },
          h('span', { className: 'dsas-code', key: 'pkg' }, component.package),
          ' · ',
          h(
            'a',
            { className: 'dsas-link', href: component.repo, target: '_blank', rel: 'noreferrer', key: 'repo' },
            t('repo'),
          ),
          tail === '' ? '' : ' · ',
          tail,
        ),
      ])
    }

    /** The interop allocation, rendered as documentation. */
    function renderInterop(t) {
      return h('div', { className: 'dsas-interop' }, [
        h('p', { className: 'dsas-interopTitle', key: 'title' }, t('interopHeading')),
        h(
          'p',
          { className: 'dsas-foot', key: 'overlay' },
          t('interopOverlay') + ' — ' + OVERLAY_ORDERS.map((row) => row.order + ' ' + row.id).join(' · '),
        ),
        h('p', { className: 'dsas-foot', key: 'hide' }, t('interopHide') + ' — ' + HIDE_OWNERS.join(' · ')),
      ])
    }

    // --- plugin -----------------------------------------------------------------

    /**
     * Browser plugin body: dictionaries, the studio tab, lifecycle cleanup.
     * @param ctx - client cordis context (slots and locale by injection).
     */
    function apply(ctx) {
      injectStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-as-aistudio: dictionaries')

      const t = ctx.locale.bind(NS)
      // The active locale id, read through the public snapshot: the panel
      // re-renders on a locale switch because the tab is registered with
      // locale: NS and a registration bump republishes every outlet.
      const currentLocale = () => {
        try {
          const snapshot = ctx.locale.getLocale()
          const active = snapshot && snapshot.active ? snapshot.active : undefined
          if (active === undefined) return ''
          return typeof active === 'string' ? active : String(active.id || '')
        } catch {
          return ''
        }
      }

      ctx.slots.inject('settings.plugins.tab', () =>
        ctx.slots.register(
          {
            name: 'settings.plugins.tab',
            id: 'as-aistudio',
            order: TAB_ORDER,
            label: () => t('tab'),
            locale: NS,
            inject: () => ({ currentLocale }),
          },
          StudioPanel,
        ),
      )

      globalThis[DEBUG_KEY] = { version: PLUGIN_VERSION, route: STATUS_ROUTE }

      ctx.effect(
        () => () => {
          delete globalThis[DEBUG_KEY]
          removeStyles()
        },
        NS + ': lifecycle',
      )
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.PLUGIN_VERSION = PLUGIN_VERSION
    exports.NS = NS
    exports.STATUS_ROUTE = STATUS_ROUTE
    exports.StudioPanel = StudioPanel
    exports.stateOf = stateOf
    exports.copyFor = copyFor
    exports.fill = fill
    exports.OVERLAY_ORDERS = OVERLAY_ORDERS
    exports.HIDE_OWNERS = HIDE_OWNERS
    exports.zh = zh
    exports.en = en
    return module.exports
  },
})
