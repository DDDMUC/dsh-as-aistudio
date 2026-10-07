// dsh-as-aistudio - the studio's own browser half (SOURCE).
//
// An ordinary component-style bundle, kept this way so it can be unit-tested on
// its own. tools/build.mjs stitches it together with the four vendored component
// factories into src/client.js - the single bundle the plugin actually ships -
// placing each factory verbatim into this scope and declaring VENDORED_TABLE.
// After changing this file, run "node tools/build.mjs" (NOT "npm run build",
// which first re-vendors src/vendor/ from the component checkouts).
//
// Self-contained: the plugin list shows ONE row (this package). This bundle is
// served for that row, so it is the only way the four components' browser halves
// can reach the page. They travel in src/vendor/<component>.js, generated from
// the component sources by tools/vendor.mjs, and build.mjs places each factory
// verbatim into this scope.
//
// What is deliberately NOT here: no copy of any component logic. The host halves
// (routes, rollback, replay) run in the components themselves, mounted by the
// component rows in cordis.patch.yml through src/shell.js; only the browser
// factories travel here, which is the part that cannot be delegated because a
// bundle is served per Loader row.
//
// Mount order is the manifest order (edit, rerun, delete, render) and it matters:
// the slot registrations are ordered by it, and each slot id / order pair is
// unique by contract (docs/INTEROP.md section 2).
//
// Mounting is GATED on the host's own report. A component whose host half is not
// really up (its package is missing, its row was disabled, its start failed) has
// no routes behind it, so drawing its buttons would offer an action that cannot
// work - the exact failure this package exists to prevent. So the gate asks
// /api/dsh-as-aistudio/status first and mounts only what that answer calls
// mounted; a host that cannot answer at all is treated as "unknown" and every
// factory is mounted, which is the pre-gate behaviour.
//
// One surface is added on top: the Settings -> Plugins -> AI Studio tab, which
// lists each component's live state. That is where a reader sees which of the
// four are actually reachable, instead of guessing.
window.__ModuleLoader__.load({
  id: 'dsh-as-aistudio',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')

    /** Plugin identity; also the locale namespace. */
    const NS = 'dsh-as-aistudio'

    /** Keep in sync with package.json and src/components.js. */
    const PLUGIN_VERSION = '0.2.11'

    /** Presence marker the live verifier reads. */
    const DEBUG_KEY = '__DSH_AS_AISTUDIO__'

    /** Style tag id claimed by this plugin (HMR and dispose remove it by id). */
    const CSS_TAG = NS + '/as-aistudio.css'

    /** The host route this half reads. Relative on purpose: web and desktop share it. */
    const STATUS_ROUTE = '/api/dsh-as-aistudio/status'

    /** The four vendored factory names, in mount order. */
    const VENDORED = ['dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn', 'dsh-markdown-bubble']

    const h = react.createElement

    // --- copy ------------------------------------------------------------------

    const zh = {
      tab: 'AI Studio',
      heading: 'AI Studio 组件',
      intro:
        '这些组件就是 AI Studio 式的一轮循环：改提示词并重跑、原位重跑、删掉这一轮，以及把发出的提示词按 Markdown 渲染。四个都是独立插件，单独安装也能用，任意子集都能共存。这个面板显示它们各自的实际状态。',
      statusMounted: '已启用',
      statusInstalled: '已安装，宿主未挂载',
      statusMissing: '未安装',
      statusUnknown: '宿主未报告',
      hostOnly: '（独立安装时走自己的插件行）',
      row: '行 {row}',
      version: '版本 {version}',
      versionUnknown: '版本未知',
      repo: '仓库',
      refresh: '刷新',
      loading: '正在读取组件状态…',
      error: '读取组件状态失败：{reason}',
      interopHeading: '互操作契约',
      interopOverlay: '输入浮层槽 order 分配（同槽不得撞号）',
      interopHide: '行隐藏归属属性（别人声明的隐藏，我不能清掉）',
      host: '宿主 DSH {version}',
      hostUnknown: '宿主版本未知',
      note: '四个组件由这个包的四个补丁行挂载（dsh-as-aistudio/edit 等），插件列表里仍然只有 AI Studio 一行；它们仍是独立 npm 包，单独安装时自己出现一行。宿主未挂载的组件不会画到界面上。',
    }

    const en = {
      tab: 'AI Studio',
      heading: 'AI Studio components',
      intro:
        'These components are the AI Studio loop for a turn: revise a prompt and re-run it, re-run a reply in place, delete the turn, and render sent prompts as Markdown. All four are independent plugins that also work alone, and any subset coexists. This panel shows what each one is actually doing.',
      statusMounted: 'Enabled',
      statusInstalled: 'Installed, host not mounted',
      statusMissing: 'Not installed',
      statusUnknown: 'Host did not report',
      hostOnly: '(a standalone install also shows its own row)',
      row: 'row {row}',
      version: 'v{version}',
      versionUnknown: 'version unknown',
      repo: 'Repo',
      refresh: 'Refresh',
      loading: 'Reading component status…',
      error: 'Could not read component status: {reason}',
      interopHeading: 'Interop contract',
      interopOverlay: 'Input overlay slot order allocation (one order per slot)',
      interopHide: 'Row-hide ownership attributes (a foreign hide is never cleared)',
      host: 'host DSH {version}',
      hostUnknown: 'host version unknown',
      note: 'The four components are mounted by the four patch rows of this package (dsh-as-aistudio/edit and friends), so the plugin list still shows only AI Studio; they remain independent npm packages that show their own row when installed standalone. A component whose host half is not mounted is not drawn at all.',
    }

    const COMPONENT_COPY = {
      'dsh-edit-turn': {
        zh: { title: '编辑并重跑', pitch: '就地改提示词，回滚到那一条之前再用新措辞重问。' },
        en: { title: 'Edit & re-run', pitch: 'Rewrite a prompt in place, roll back to just before it, re-prompt.' },
      },
      'dsh-rerun-turn': {
        zh: { title: '原位重跑', pitch: '同一句提示词重新生成，后面所有轮次原样存活。' },
        en: { title: 'Re-run in place', pitch: 'Regenerate one reply from the same prompt while later turns survive.' },
      },
      'dsh-delete-turn': {
        zh: { title: '删除这一轮', pitch: '把一条消息、一个步骤或整条回复从模型上下文里拿掉。' },
        en: { title: 'Delete this turn', pitch: 'Remove a message, a step or a whole reply from the derived context.' },
      },
      'dsh-markdown-bubble': {
        zh: { title: 'Markdown 气泡', pitch: '发出的提示词按 Markdown 渲染；排队与预览保持纯文本。' },
        en: { title: 'Markdown bubble', pitch: 'Sent prompts render as Markdown; queues and previews stay plain.' },
      },
    }

    /** The overlay allocation from docs/INTEROP.md section 2. */
    const OVERLAY_ORDERS = [
      { id: 'dsh-delete-turn', order: 8 },
      { id: 'dsh-edit-turn', order: 9 },
      { id: 'dsh-rerun-turn', order: 10 },
    ]

    /** The hide-ownership attributes from docs/INTEROP.md section 4. */
    const HIDE_OWNERS = ['data-dshdt-hidden', 'data-dshet-hidden', 'data-dsrr-hidden']

    /** Fill {key} placeholders; an unknown key stays visible instead of printing undefined. */
    function fill(text, vars) {
      return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
      )
    }

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
      '.dsas-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.7;margin:0}',
    ].join('')

    function injectStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = NS
      tag.dataset.pluginCss = CSS_TAG
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function removeStyles() {
      if (typeof document === 'undefined') return
      const tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']')
      if (tag !== null) tag.remove()
    }

    // --- the vendored components ------------------------------------------------

    /**
     * Apply one vendored factory into this fiber.
     *
     * Each factory is the component own code and registers its own slots, its own
     * locale namespace and its own stylesheet; nothing here reaches inside it. The
     * guard is deliberately per component: one that throws or refuses to build
     * must not stop the other three, because a partially working strip beats a
     * dead page, and because "any subset works" is the whole point of the studio.
     *
     * @param ctx - this plugin's client context.
     * @param id - component id, also the vendored module path.
     * @returns true when the factory applied.
     */
    function vendoredFactory(id) {
      // tools/build.mjs declares VENDORED_TABLE with the four stitched factories;
      // running this file on its own (its own unit tests) has none, and mounts
      // nothing, which is exactly the "nothing vendored" case.
      if (typeof VENDORED_TABLE === 'undefined') return null
      const factory = VENDORED_TABLE[id]
      return typeof factory === 'function' ? factory : null
    }

    function applyVendored(ctx, id) {
      try {
        const factory = vendoredFactory(id)
        if (factory === null) return false
        const plugin = factory(require)
        if (typeof plugin !== 'object' || plugin === null || typeof plugin.apply !== 'function') {
          console.error('[' + NS + '] vendored ' + id + ' has no apply()', plugin)
          return false
        }
        plugin.apply(ctx)
        return true
      } catch (error) {
        console.error('[' + NS + '] vendored ' + id + ' failed to apply:', error)
        return false
      }
    }

    /**
     * Whether one component of a status payload is worth drawing: exactly the
     * components the panel reports as 已启用 / Enabled.
     *
     * The gate and the panel therefore cannot disagree - "the status says it is
     * up" and "we mounted it" are the same predicate, in one place.
     *
     * @param component - one entry of the status payload's components.
     * @returns true when its UI may be mounted.
     */
    function shouldMount(component) {
      return stateOf(component) === 'mounted'
    }

    /**
     * The vendored ids a status payload allows, in mount order.
     *
     * A component the payload does not mention stays off: the host half that
     * generated the payload is the only authority on what is running, and a
     * bundle newer than the host must not draw what the host never mounted.
     *
     * @param payload - the status document, or null when the host did not answer.
     * @returns component ids to mount; every id when there is no payload.
     */
    function mountableComponents(payload) {
      if (payload === null || payload === undefined) return VENDORED.slice()
      const reported = new Map()
      for (const component of payload.components) {
        if (component !== null && typeof component === 'object' && typeof component.id === 'string') reported.set(component.id, component)
      }
      return VENDORED.filter((id) => {
        const component = reported.get(id)
        return component !== undefined && shouldMount(component)
      })
    }

    /**
     * Read the host's status document once.
     *
     * Every failure reads as "unknown" rather than "nothing is running": a host
     * that cannot answer has said nothing about the components, and guessing
     * "down" would blank the whole strip for a host that is merely busy.
     *
     * @returns the status document, or null.
     */
    function readStatus() {
      if (typeof fetch !== 'function') return Promise.resolve(null)
      let pending
      try {
        pending = fetch(statusUrl(0), { headers: { accept: 'application/json' } })
      } catch (error) {
        return Promise.resolve(null)
      }
      return Promise.resolve(pending)
        .then((response) => response.json())
        .then((body) => (body !== null && body !== undefined && body.ok === true && Array.isArray(body.components) ? body : null))
        .catch(() => null)
    }

    /**
     * Mount the vendored browser halves whose host half is really up.
     *
     * @param ctx - this plugin's client context.
     * @returns which ones mounted, by id (the marker's payload).
     */
    async function mountLiveComponents(ctx) {
      const payload = await readStatus()
      const ids = mountableComponents(payload)
      return mountComponents(ctx, ids)
    }

    /**
     * Mount the vendored browser halves named by the gate, in interop order.
     * @param ctx - this plugin's client context.
     * @param ids - component ids the host reported as mounted.
     * @returns which ones mounted, by id; gated-off ones are false.
     */
    function mountComponents(ctx, ids) {
      const mounted = {}
      const gate = Array.isArray(ids) ? ids : VENDORED.slice()
      for (const id of VENDORED) mounted[id] = gate.indexOf(id) === -1 ? false : applyVendored(ctx, id)
      globalThis[DEBUG_KEY] = { version: PLUGIN_VERSION, mounted, gate: gate.slice(), route: STATUS_ROUTE }
      return mounted
    }

    // --- the studio tab ----------------------------------------------------------

    function stateOf(component) {
      if (component.hostMounted === true) return 'mounted'
      if (component.installed === true) return component.hostMounted === null ? 'mounted' : 'installed'
      return 'missing'
    }

    function stateLabel(t, state) {
      if (state === 'mounted') return t('statusMounted')
      if (state === 'installed') return t('statusInstalled')
      return t('statusMissing')
    }

    function statusUrl(request) {
      return request === 0 ? STATUS_ROUTE : STATUS_ROUTE + '?n=' + String(request)
    }

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
        ready ? h('ul', { className: 'dsas-list', key: 'list' }, rows) : null,
        h('p', { className: 'dsas-note', key: 'note' }, t('note')),
        renderInterop(t),
      ])
    }

    function renderRow(component, copy, t) {
      const state = stateOf(component)
      const text = copy(component.id)
      const stateLabelText =
        state === 'mounted' ? t('statusMounted') : state === 'installed' ? t('statusInstalled') : t('statusMissing')
      const version =
        component.version === null || component.version === undefined
          ? t('versionUnknown')
          : fill(t('version'), { version: component.version })
      const ownRows = typeof component.ownRows === 'number' && component.ownRows > 0 ? t('hostOnly') : ''
      const rowLine =
        typeof component.hostRow === 'string' && component.hostRow !== '' ? fill(t('row'), { row: component.hostRow }) : ''
      const tail = [rowLine, ownRows].filter((part) => part !== '').join(' · ')
      return h('li', { className: 'dsas-row', key: component.id }, [
        h('div', { className: 'dsas-rowHead', key: 'head' }, [
          h('span', { className: 'dsas-dot', 'data-state': state, key: 'dot' }),
          h('span', { className: 'dsas-name', key: 'name' }, text.title),
          h('span', { className: 'dsas-badge', key: 'badge' }, stateLabelText),
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
     * Browser plugin body: dictionaries, the four vendored components, the studio
     * tab, lifecycle cleanup.
     * @param ctx - client cordis context (slots and locale by injection).
     */
    function apply(ctx) {
      injectStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-as-aistudio: dictionaries')

      const t = ctx.locale.bind(NS)
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
            order: 100,
            label: () => t('tab'),
            locale: NS,
            inject: () => ({ currentLocale }),
          },
          StudioPanel,
        ),
      )

      ctx.effect(
        () => () => {
          delete globalThis[DEBUG_KEY]
          removeStyles()
        },
        NS + ': lifecycle',
      )

      // The components mount last, and the gate is a network read: the studio's
      // own tab is registered above so a host that never answers delays the
      // components, never the panel that reports on them. Awaiting it is what
      // makes the marker (and this plugin's fiber) mean "the gate has settled".
      return mountLiveComponents(ctx)
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
    exports.VENDORED = VENDORED
    exports.applyVendored = applyVendored
    exports.shouldMount = shouldMount
    exports.mountableComponents = mountableComponents
    exports.mountComponents = mountComponents
    exports.zh = zh
    exports.en = en
    return module.exports
  },
})
