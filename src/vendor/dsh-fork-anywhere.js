// dsh-fork-anywhere browser half, VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-fork-anywhere/src/client.js  (v0.1.2, sha256 c8b7885faaaeeb20)
// Regenerate with `npm run vendor`; test/vendor-sync.test.js fails when this is stale.
//
// The component registers its factory with the host module loader; inside this
// package the factory is called directly, so only the outer wrapper is replaced.
// The factory body is the component own code, unchanged.
export default (require) => {

    const react = require('react')

    const NS = 'dsh-fork-anywhere'
    const PLUGIN_VERSION = '0.1.2'
    /** Own node namespace: only elements carrying it are ever removed (I3). */
    const HOST_ATTR = 'data-dsfa-host'
    const HOST_SELECTOR = '[data-dsfa-host="1"]'
    const CSS_TAG_ID = 'dsh-fork-anywhere/client.css'
    /**
     * Marks the strip a forked child opens on. The attribute is this plugin's own
     * namespace (never a host class hash) and the stylesheet keys on it.
     */
    /** Marks the header of a fork-closed Turn this plugin hides. */
    const FORK_TAIL_ATTR = 'data-dsfa-fork-tail'
    /** The Turn-process header the Host renders for a Turn, with its Turn number. */
    const TURN_PROCESS_ATTR = 'data-turn-process'
    const TOAST_ID = 'dsfa-toast'
    /** A pass slower than this gets one console warning (throttled). */
    const SLOW_PASS_MS = 16
    /** How often the watched column is re-validated (a remount is otherwise invisible). */
    const WATCHDOG_MS = 1000
    const SLOW_WARN_INTERVAL_MS = 5000

    /** Row kinds that open a turn from a durable prompt event. */
    const PROMPT_KINDS = new Set(['user', 'steering'])
    /**
     * Row kinds that show a landed context-compaction checkpoint.
     *
     * `compaction` is the automatic lifecycle; `manual-compaction` is the `/compact`
     * command carrying the same marker in `data.compaction`. Both expose the
     * checkpoint event seq, which is the one cut that inherits the compacted
     * state - the ordinary Turn-tail branch cuts at `turn/end`, which can sit on
     * either side of a manual compaction and therefore cannot name it.
     */
    /** Node kinds that already carry a compaction card. */
    const COMPACTION_KINDS = new Set(['compaction', 'manual-compaction'])
    /** Marks the fallback action row this plugin injects into a compaction card. */
    const COMPACT_ATTR = 'data-dsfa-compact'
    const COMPACT_SELECTOR = '[data-dsfa-compact="1"]'
    /** Marks a row another fork plugin renders, so this plugin can stand down. */
    const FOREIGN_ROW_SELECTOR = '.dfac-row'
    /** The compaction card's own leading icon: present whatever the node kind is. */
    const FLOW_ROOT_SELECTOR = '[data-chat-flow]'
    const ROW_SELECTOR = '[data-chat-flow-kind]'
    const BAR_SELECTOR = '[class*="_actions"]'

    /**
     * Translate through this plugin's own dictionary.
     *
     * The toast fired by the compaction row runs outside any slot, so it cannot
     * borrow the slot's translator; this keeps the message readable regardless.
     * @param key - dictionary key.
     * @param params - optional `{name}` substitutions.
     * @returns the translated text, or the key itself.
     */
    function translateFallback(key, params) {
      const table = dictionaries !== null && dictionaries !== undefined && dictionaries.zh !== undefined ? dictionaries.zh : {}
      let text = typeof table[key] === 'string' ? table[key] : key
      if (params !== null && params !== undefined && typeof params === 'object') {
        for (const name of Object.keys(params)) text = text.split('{' + name + '}').join(String(params[name]))
      }
      return text
    }

    const dictionaries = {
      zh: {
        'action.fork': '从此处分叉',
        'toast.failed': '分叉失败',
        'toast.unavailable': '这条消息已不在会话记录里，无法分叉',
        'toast.migration': '已打开源会话：先完成格式迁移，再点一次分叉',
        'compact.fork': '从压缩点分叉',
        'compact.copy': '复制摘要',
        'compact.copied': '已复制',
        'compact.usage': '本次压缩摘要调用的用量',
        'compact.dialog': '压缩用量',
        'compact.model': '提供方 / 模型',
        'compact.cacheRead': '缓存读取',
        'compact.input': '未缓存输入',
        'compact.cacheWrite': '缓存写入',
        'compact.output': '输出',
        'compact.total': '合计',
        'compact.cacheHit': '缓存命中',
        'compact.count': '{count} tok',
        'clock.md': '{m}月{d}日',
        'clock.ymd': '{y}年{m}月{d}日',
        'number.groupSeparator': ',',
        'copy.summary': '复制摘要',
      },
      en: {
        'action.fork': 'Fork from this message',
        'toast.failed': 'Fork failed',
        'toast.unavailable': 'This message is no longer in the session log, so it cannot be forked from',
        'toast.migration': 'Source session opened: finish the format migration, then fork again',
        'compact.fork': 'Fork after compaction',
        'compact.copy': 'Copy summary',
        'compact.copied': 'Copied',
        'compact.usage': "Token usage of this compaction's summarizer call",
        'compact.dialog': 'Compaction usage',
        'compact.model': 'Provider / model',
        'compact.cacheRead': 'Cached input',
        'compact.input': 'Uncached input',
        'compact.cacheWrite': 'Cache write',
        'compact.output': 'Output',
        'compact.total': 'Total',
        'compact.cacheHit': 'Cache hit',
        'compact.count': '{count} tok',
        'clock.md': '{m}/{d}',
        'clock.ymd': '{y}-{m}-{d}',
        'number.groupSeparator': ',',
      },
    }

    // The host's own `branch-outline` glyph (16x16, currentColor), so every fork
    // this plugin offers reads as the shipped one.
    const BRANCH_PATHS = [
      'M1.01503 8.0001L5.6964 8.0001C6.41913 8.0001 6.78049 8.0001 7.12115 7.91951C7.4232 7.84804 7.71233 7.73014 7.97821 7.57C8.27809 7.38939 8.5364 7.13669 9.05303 6.63129L11.3281 4.40564',
      'M1.01221 7.9999L5.6964 7.9999C6.41913 7.9999 6.78049 7.9999 7.12115 8.08049C7.4232 8.15196 7.71233 8.26986 7.97821 8.43C8.27809 8.61061 8.5364 8.86331 9.05303 9.36871L11.3281 11.5944',
    ]
    const BRANCH_DOTS = [[12.4502, 3.3079], [12.4502, 12.6921]]
    const COPY_ICON =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="1.3">' +
      '<rect x="5.3" y="5.3" width="8.9" height="8.9" rx="1.6" stroke="currentColor"></rect>' +
      '<path d="M10.4 5.3V3.4c0-.9-.7-1.6-1.6-1.6H3.4c-.9 0-1.6.7-1.6 1.6v5.4c0 .9.7 1.6 1.6 1.6h1.9" stroke="currentColor"></path>' +
      '</svg>'

    const CHECK_ICON =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="1.5">' +
      '<path d="M3.2 8.6l3.1 3.1 6.5-6.6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path>' +
      '</svg>'

    const USAGE_ICON =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="1.3" stroke="currentColor">' +
      '<ellipse cx="8" cy="3.7" rx="5" ry="1.9"></ellipse>' +
      '<path d="M3 3.7v8.6c0 1 2.24 1.9 5 1.9s5-.9 5-1.9V3.7"></path>' +
      '<path d="M3 8c0 1 2.24 1.9 5 1.9s5-.9 5-1.9"></path>' +
      '</svg>'

    const ICON_MARKUP =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke-width="1.3">' +
      BRANCH_PATHS.map((d) => '<path d="' + d + '" stroke="currentColor"></path>').join('') +
      BRANCH_DOTS.map(([cx, cy]) => '<circle cx="' + cx + '" cy="' + cy + '" r="1.56962" stroke="currentColor"></circle>').join('') +
      '</svg>'

    // Metrics copied from the host's MessageIconActions.module.css (28px hit
    // area, 15px glyph, tertiary label colour) so the injected button sits in
    // the strip without looking foreign.
    const CSS = [
      '.dsfa-action-host{display:inline-flex;align-items:center}',
      '.dsfa-action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));box-sizing:border-box;padding:6px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary,#81858c);cursor:pointer;transition:background-color .12s,color .12s}',
      '.dsfa-action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}',
      '.dsfa-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,#4a4d52)}',
      '.dsfa-action:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4d6bfe);outline-offset:2px}',
      '.dsfa-crow{display:flex;align-items:center;gap:8px;min-width:0;margin-top:2px;padding-left:4px;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary)}',
      '[data-dsfa-stale="1"]{display:none!important}',
      '[data-dsfa-empty-turn="1"]{display:none!important}',
      '.dsfa-dirty-row{display:flex;align-items:center;padding:2px 0 4px 34px}',
      '[data-dsfa-hide-shipped="1"]{display:none!important}',
      '[data-dsfa-fork-tail="1"]{display:none!important}',
      '.dsfa-crow--node{gap:4px;height:calc(28px + var(--dsh-content-font-delta,0px))}',
      '.dsfa-glyph{display:inline-flex;align-items:center;justify-content:center}',
      '.dsfa-glyph svg{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px))}',
      '.dsfa-usage-slot{display:inline-flex;min-width:0;margin-left:4px;position:relative}',
      '.dsfa-usage{display:inline-flex;align-items:center;gap:4px;height:calc(28px + var(--dsh-content-font-delta,0px));padding:6px 8px;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer}',
      '.dsfa-usage:hover,.dsfa-usage[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dsfa-panel{position:fixed;z-index:2147483000;padding:10px 12px;border-radius:10px;border:1px solid color-mix(in srgb,CanvasText 18%,transparent);background:Canvas;color:CanvasText;box-shadow:0 10px 28px rgba(0,0,0,.22);font-size:12px;line-height:18px}',
      '.dsfa-panel-title{font-weight:600;margin-bottom:4px}',
      '.dsfa-panel-route,.dsfa-panel-hit{opacity:.75}',
      '.dsfa-panel-row{display:flex;justify-content:space-between;gap:16px;font-variant-numeric:tabular-nums}',
      '.dsfa-cmeta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.85}',
      '.dsfa-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483601;background:Canvas;color:CanvasText;border:1px solid color-mix(in srgb,CanvasText 25%,transparent);padding:9px 16px;border-radius:999px;font-size:12px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:min(92vw,460px);pointer-events:none}',
      // A Turn the fork seed closed has no answer; its header claims a duration
      // and a completion that never happened. Hidden, never removed: the log and
      // the Turn both stay, and teardown puts the strip back.
      '@media (prefers-reduced-motion:reduce){.dsfa-action{transition:none}}',
    ].join('')

    // --- environment ----------------------------------------------------------

    /** Monotonic-ish clock for the pass-cost self check. */
    function now() {
      return typeof performance !== 'undefined' && performance !== null && typeof performance.now === 'function' ? performance.now() : Date.now()
    }

    /** One-frame scheduling, with a timer fallback for non-visual environments. */
    function requestFrame(callback) {
      if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
      return setTimeout(callback, 16)
    }

    /** Cancel a frame requested by {@link requestFrame}. */
    function cancelFrame(handle) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
      else clearTimeout(handle)
    }

    // --- styles ---------------------------------------------------------------

    function injectStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG_ID) + ']') !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-fork-anywhere'
      tag.dataset.pluginCss = CSS_TAG_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function removeStyles() {
      if (typeof document === 'undefined') return
      const tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG_ID) + ']')
      if (tag !== null) tag.remove()
    }

    /** Key the plugin publishes its state under, so a missing row can be read off disk. */
    const STATUS_KEY = 'dsh-fork-anywhere/status'

    /**
     * Publish one status patch to localStorage.
     *
     * The renderer console is unreachable from outside the app, but `localStorage`
     * is a Chromium leveldb on disk: writing here is what makes "is it loaded, did
     * the node register, is the row painted" answerable without a screenshot.
     * @param patch - fields to merge into the stored record.
     */
    function publishStatus(patch) {
      try {
        const store = typeof localStorage === 'undefined' ? null : localStorage
        if (store === null || store === undefined || typeof store.setItem !== 'function') return
        let current = {}
        try {
          const raw = store.getItem(STATUS_KEY)
          if (typeof raw === 'string' && raw !== '') current = JSON.parse(raw) || {}
        } catch {
          current = {}
        }
        store.setItem(STATUS_KEY, JSON.stringify({ ...current, ...patch, version: PLUGIN_VERSION, at: Date.now() }))
      } catch {
        /* storage is a diagnostic, never a dependency */
      }
    }

    // --- row reads ------------------------------------------------------------

    /**
     * The durable event seq a prompt row stands for, or null.
     * @param node - one ChatSnapshot node, or anything else the row key resolved to.
     * @returns the inclusive cut `session/fork` takes, or null when this row is not a prompt.
     */
    function seqOfNode(node) {
      if (node === null || typeof node !== 'object') return null
      if (!PROMPT_KINDS.has(node.kind)) return null
      const seq = node.data === undefined || node.data === null ? undefined : node.data.seq
      if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return null
      return seq
    }

    /**
     * Resolve a row's `data-chat-flow-key` through the snapshot, including the
     * composite (`["turn-tail","response"]`) spelling grouped rows use.
     * @param nodes - ChatSnapshot node map.
     * @param key - the row's own key attribute.
     * @returns the node, or null.
     */
    function nodeOf(nodes, key) {
      if (typeof key !== 'string' || key === '') return null
      const direct = nodes.get(key)
      if (direct !== undefined && direct !== null) return direct
      if (key[0] !== '[') return null
      try {
        for (const part of JSON.parse(key)) {
          if (typeof part !== 'string') continue
          const node = nodes.get(part)
          if (node !== undefined && node !== null) return node
        }
      } catch {
        /* not a composite key after all */
      }
      return null
    }

    /**
     * Normalize one summarizer usage record.
     *
     * The compacted marker the chat snapshot exposes carries the summary text but
     * not what the summarizer spent; that lives on the `compaction/summary` event
     * (`data.usage`). Input and output must both be real numbers or there is no
     * pill at all; an omitted cache bucket counts as zero - the platform's own
     * rule for usage pills.
     *
     * @param usage - `compaction/summary.data.usage`, possibly absent.
     * @returns `{ cacheRead, cacheWrite, input, output }`, or null.
     */
    function normalizeUsage(usage) {
      if (usage === null || usage === undefined || typeof usage !== 'object') return null
      const input = Number.isFinite(usage.uncachedInputTokens) ? usage.uncachedInputTokens : null
      const output = Number.isFinite(usage.outputTokens) ? usage.outputTokens : null
      if (input === null || output === null) return null
      return {
        cacheRead: Number.isFinite(usage.cacheReadTokens) ? usage.cacheReadTokens : 0,
        cacheWrite: Number.isFinite(usage.cacheWriteTokens) ? usage.cacheWriteTokens : 0,
        input,
        output,
      }
    }

    /**
     * The seq a compaction node stands for: the checkpoint it appended.
     * `manual-compaction` nests the marker one level deeper.
     * @param node - chat node of a compaction kind.
     * @returns the inclusive cut, or null.
     */
    function compactionCutOf(node) {
      if (node === null || node === undefined) return null
      const data = node.data
      if (data === null || data === undefined) return null
      const marker = data.compaction === undefined || data.compaction === null ? data : data.compaction
      const seq = marker === null || marker === undefined ? undefined : marker.seq
      return typeof seq === 'number' && Number.isInteger(seq) && seq >= 0 ? seq : null
    }

    /**
     * One short string describing a node's data shape, for the status line.
     * @param node - chat node, possibly undefined.
     * @returns `kind|<keys>` or a marker.
     */
    function describeNode(node) {
      if (node === null || node === undefined) return 'no-node'
      const kind = typeof node.kind === 'string' ? node.kind : '?'
      const data = node.data
      if (data === null || data === undefined) return kind + '|no-data'
      const keys = typeof data === 'object' ? Object.keys(data).slice(0, 6).join('+') : typeof data
      return kind + '|' + keys
    }

    

    /**
     * Where the action row goes: the card's own container, so it sits directly
     * under the card's line instead of at the end of whatever group holds it.
     * @param card - the card's leading icon element.
     * @param fallback - the row to use when no closer container is found.
     * @returns the element the row is appended to.
     */
    /**
     * The visible row a collapsed process group shows: its header.
     * @param card - the card's leading icon element.
     * @returns the header's own row, or null outside a process group.
     */
    function groupHeaderMountOf(card, row) {
      // Members are flow rows beside the Turn's process header, not inside it, so
      // the header is found by Turn number in the shared flow container and the
      // action rides that header's own row - the one visible while collapsed.
      const turn = row === null || row === undefined || typeof row.getAttribute !== 'function' ? null : row.getAttribute('data-chat-turn')
      const scope = row === null || row === undefined ? null : row.parentElement
      if (scope === null || scope === undefined || typeof scope.querySelector !== 'function') return null
      if (typeof turn === 'string' && turn !== '') {
        const header = scope.querySelector('[' + TURN_PROCESS_ATTR + '="' + turn + '"]')
        if (header !== null && header !== undefined) return closestRow(header) ?? header.parentElement
      }
      // No Turn number on the row: take the nearest preceding row that holds a
      // process header, which is the group this card belongs to.
      let previous = row === null || row === undefined ? undefined : row.previousElementSibling
      for (let depth = 0; previous !== null && previous !== undefined && depth < 8; depth += 1) {
        if (typeof previous.querySelector === 'function' && previous.querySelector('[' + TURN_PROCESS_ATTR + ']') !== null) return previous
        previous = previous.previousElementSibling
      }
      return null
    }

    /**
     * Whether an element is actually painted: layout AND not transparent.
     *
     * A hover-revealed row keeps its box while painting nothing, so `` just
     * `getClientRects()` would call it present and this plugin would stand down.
     * @param element - candidate element.
     * @returns true when the element is laid out and visible.
     */
    function paintsVisibly(element) {
      if (element === null || element === undefined) return false
      if (typeof getComputedStyle !== 'function') return true
      try {
        const style = getComputedStyle(element)
        if (style === null || style === undefined) return true
        if (style.visibility === 'hidden') return false
        if (style.opacity !== undefined && style.opacity !== '' && Number(style.opacity) === 0) return false
        return true
      } catch {
        return true
      }
    }

    /** Whether an element actually occupies space. */
    function isRendered(element) {
      if (element === null || element === undefined) return false
      if (typeof element.getClientRects !== 'function') return true
      return element.getClientRects().length > 0
    }

    /**
     * Where the action row goes for one card.
     *
     * A card inside a collapsed process group is mounted but occupies no space, so
     * a row under it would be invisible. The group header is the row the user sees
     * in that state, so the action rides there until the group opens and the card
     * itself becomes the anchor.
     * @param card - the card's leading icon element.
     * @param row - the flow row that holds the card.
     * @returns the element to append to.
     */
    function actionMountOf(card, row) {
      const cardRow = card === null || card === undefined ? null : card.parentElement
      if (cardRow !== null && isRendered(cardRow)) return mountPointOf(card, row)
      const header = groupHeaderMountOf(card, row)
      return header === null ? mountPointOf(card, row) : header
    }

    function mountPointOf(card, fallback) {
      let current = card === null || card === undefined ? null : card.parentElement
      for (let depth = 0; current !== null && current !== undefined && depth < 5; depth += 1) {
        const className = typeof current.className === 'string' ? current.className : ''
        if (className.includes('compactionRow')) return current
        current = current.parentElement
      }
      // No card container matched: the flow row itself is the safe anchor - its end
      // is below the card, while an inner icon wrapper would nest the row inside
      // the card's own label.
      return fallback
    }

    /**
     * The last compaction point in the Session's loaded event window.
     *
     * The card's own node is the preferred source for this, but a card can live in
     * a row whose node carries no marker (a process group, a command node). The log
     * still knows where the compaction landed, so the row is never left without a
     * cut.
     * @param sessions - client sessions service.
     * @param sessionId - owning Session.
     * @returns the inclusive cut, or null.
     */
    function latestCompactionInfo(sessions, sessionId) {
      const none = { cut: null, usage: null }
      if (sessions === null || sessions === undefined || typeof sessions.binding !== 'function') return none
      const binding = sessions.binding(sessionId)
      const source = binding === null || binding === undefined ? undefined : binding.eventSource
      if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return none
      let window
      try {
        window = source.getSnapshot()
      } catch {
        return none
      }
      const entries = window === null || window === undefined ? undefined : window.entries
      if (!Array.isArray(entries)) return none
      let end = null
      let usage = null
      for (const entry of entries) {
        if (entry === null || entry === undefined || entry.type !== 'event') continue
        const event = entry.event
        if (event === null || event === undefined) continue
        if (event.type === 'compaction/end' && Number.isInteger(event.seq)) end = event.seq
        else if (event.type === 'compaction/summary' && Number.isInteger(event.seq)) {
          end = end === null ? event.seq : end
          const data = event.data === null || event.data === undefined ? null : event.data
          if (data !== null) usage = normalizeUsage(data.usage)
        }
      }
      return { cut: end, usage }
    }

    function latestCompactionCut(sessions, sessionId) {
      if (sessions === null || sessions === undefined || typeof sessions.binding !== 'function') return null
      const binding = sessions.binding(sessionId)
      const source = binding === null || binding === undefined ? undefined : binding.eventSource
      if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return null
      let window
      try {
        window = source.getSnapshot()
      } catch {
        return null
      }
      const entries = window === null || window === undefined ? undefined : window.entries
      if (!Array.isArray(entries)) return null
      let end = null
      let summary = null
      for (const entry of entries) {
        if (entry === null || entry === undefined || entry.type !== 'event') continue
        const event = entry.event
        if (event === null || event === undefined) continue
        if (event.type === 'compaction/end' && Number.isInteger(event.seq)) end = event.seq
        else if (event.type === 'compaction/summary' && Number.isInteger(event.seq)) summary = event.seq
      }
      return end === null ? summary : end
    }

    /** Compact token count: 812 / 7.2K / 517K / 1.2M. */
    function shortTokens(count) {
      if (count < 1000) return String(count)
      if (count < 1000000) {
        const thousands = count / 1000
        return (thousands >= 100 ? String(Math.round(thousands)) : String(Math.round(thousands * 10) / 10)) + 'K'
      }
      const millions = count / 1000000
      return (millions >= 100 ? String(Math.round(millions)) : String(Math.round(millions * 10) / 10)) + 'M'
    }

    /** `cache-read/uncached-input/output` for one summarizer call, or null. */
    function usageLabel(usage) {
      if (usage === null || usage === undefined) return null
      return shortTokens(usage.cacheRead) + '/' + shortTokens(usage.input) + '/' + shortTokens(usage.output)
    }

    /** `HH:mm` for the checkpoint's completion time. */
    function clockText(time) {
      if (typeof time !== 'number') return ''
      try {
        return new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
      } catch {
        return ''
      }
    }

    /**
     * The `turn/end` seq of one Turn, when that Turn is already closed.
     * @param nodes - ChatSnapshot node map (unused by the turn index; kept for symmetry).
     * @param snapshot - ChatSnapshot carrying `timeline.turns`.
     * @param turn - Turn number from the row.
     * @returns the inclusive cut, or null for a running/unknown Turn.
     */
    function closedTurnEnd(nodes, snapshot, turn) {
      if (!Number.isInteger(turn) || turn < 0) return null
      const timeline = snapshot === null || snapshot === undefined ? undefined : snapshot.timeline
      const turns = timeline === null || timeline === undefined ? undefined : timeline.turns
      if (turns === undefined || turns === null || typeof turns.get !== 'function') return null
      const entry = turns.get(turn)
      const end = entry === null || entry === undefined ? undefined : entry.end
      const seq = end === null || end === undefined ? undefined : end.seq
      return typeof seq === 'number' && Number.isInteger(seq) && seq >= 0 ? seq : null
    }

    /**
     * The node key one flow row stands for.
     *
     * `data-chat-flow-key` is `routedNode.key` only for ungrouped rows; a row that
     * sits inside a process group (a compaction card folded into a Turn's
     * "executed commands" list, for one) gets `["<node key>","<part>"]`. Reading
     * the flow key alone therefore cannot find those nodes - which is why a
     * compaction card could never resolve its own event.
     * @param row - one flow row.
     * @returns the node key, or null.
     */
    function nodeKeyOfRow(row) {
      if (row === null || row === undefined || typeof row.getAttribute !== 'function') return null
      const direct = row.getAttribute('data-chat-node-key')
      if (typeof direct === 'string' && direct !== '') return direct
      const flow = row.getAttribute('data-chat-flow-key')
      if (typeof flow !== 'string' || flow === '') return null
      if (flow.charAt(0) !== '[') return flow
      try {
        const parsed = JSON.parse(flow)
        return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null
      } catch {
        return null
      }
    }

    /** Whether a class attribute carries the host's action strip class suffix. */
    function hasActionClass(element) {
      const className = element.className
      return typeof className === 'string' && className.includes('_actions')
    }

    /** Nearest enclosing chat row, or null. */
    function closestRow(node) {
      let current = node
      while (current !== null && current !== undefined) {
        if (typeof current.getAttribute === 'function' && current.getAttribute('data-chat-flow-kind') !== null) return current
        current = current.parentElement
      }
      return null
    }

    // --- injection ------------------------------------------------------------

    /**
     * Adopt the node a previous pass (or a previous instance after a reload)
     * already injected, so re-applying can never stack a second button.
     * @param container - the row's action strip (the only place this node lives).
     * @param doc - document the row belongs to.
     * @returns the host span holding this plugin's button.
     */
    function hostIn(container, doc) {
      const existing = [].slice.call(container.querySelectorAll(HOST_SELECTOR))
      for (let index = 1; index < existing.length; index += 1) existing[index].remove()
      if (existing.length > 0) return existing[0]
      const host = doc.createElement('span')
      host.className = 'dsfa-action-host'
      host.setAttribute(HOST_ATTR, '1')
      const button = doc.createElement('button')
      button.type = 'button'
      button.className = 'dsfa-action'
      button.innerHTML = ICON_MARKUP
      host.appendChild(button)
      return host
    }

    /** Drop this plugin's node from one row (never a sibling's). */
        /** Turns this snapshot records as closed by a fork. */
    function forkedTurns(snapshot) {
      const timeline = snapshot === null || snapshot === undefined ? undefined : snapshot.timeline
      const turns = timeline === null || timeline === undefined ? undefined : timeline.turns
      if (turns === null || turns === undefined || typeof turns.values !== 'function') return []
      const found = []
      for (const entry of turns.values()) {
        const reason =
          entry === null || entry === undefined || entry.end === null || entry.end === undefined || entry.end.data === null || entry.end.data === undefined
            ? undefined
            : entry.end.data.reason
        if (reason !== null && reason !== undefined && reason.kind === 'forked' && typeof entry.turn === 'number') found.push(entry.turn)
      }
      return found
    }

    /** Turns that own a compaction card, read from the snapshot's own nodes. */
    function compactionTurnsOf(snapshot) {
      const nodes = snapshot === null || snapshot === undefined ? undefined : snapshot.nodes
      if (nodes === null || nodes === undefined || typeof nodes.values !== 'function') return new Set()
      const turns = new Set()
      for (const node of nodes.values()) {
        if (node === null || node === undefined || !COMPACTION_KINDS.has(node.kind)) continue
        const turn =
          node.location === null || node.location === undefined || node.location.turn === null || node.location.turn === undefined
            ? undefined
            : node.location.turn.turn
        if (typeof turn === 'number') turns.add(turn)
      }
      return turns
    }


function removeHost(row) {
      const existing = [].slice.call(row.querySelectorAll(HOST_SELECTOR))
      for (const node of existing) node.remove()
    }

    /** Whether the transcript's newest Turn was closed by a fork. */
    function lastTurnForked(snapshot) {
      const turns = snapshot === null || snapshot === undefined || snapshot.timeline === null || snapshot.timeline === undefined ? undefined : snapshot.timeline.turns
      if (turns === undefined || turns === null || typeof turns.values !== 'function') return false
      let last = null
      for (const entry of turns.values()) {
        if (last === null || (entry !== null && entry !== undefined && entry.turn > last.turn)) last = entry
      }
      if (last === null || last === undefined || last.end === null || last.end === undefined) return false
      const reason = last.end.event !== null && last.end.event !== undefined && last.end.event.data !== null && last.end.event.data !== undefined ? last.end.event.data.reason : undefined
      return reason !== null && reason !== undefined && reason.kind === 'forked'
    }


    /** Drop every node this plugin injected anywhere. */
    function removeAll(doc) {
      if (doc === undefined || doc === null) return
      const nodes = doc.querySelectorAll(HOST_SELECTOR)
      for (const node of [].slice.call(nodes)) node.remove()
      const strips = doc.querySelectorAll(COMPACT_SELECTOR)
      for (const node of [].slice.call(strips)) node.remove()
    }


    // --- reconciliation -------------------------------------------------------

    /**
     * The transcript decorator for one Session.
     *
     * Reads the live chat nodes, translator, fork callback and document off
     * `live` at pass time (never through effect dependencies), visits only rows
     * the observer queued, and coalesces everything into one animation frame.
     *
     * @param options - sessionId, live state holder, document, and test seams.
     * @returns the reconciler: start/stop/flush plus counters.
     */
    function createReconciler(options) {
      const doc = options.doc === undefined ? document : options.doc
      const sessionId = options.sessionId
      const live = options.live
      const frame = options.frame === undefined ? requestFrame : options.frame
      const cancel = options.cancel === undefined ? cancelFrame : options.cancel
      const Observer = options.Observer === undefined ? (typeof MutationObserver === 'undefined' ? null : MutationObserver) : options.Observer
      const clock = options.now === undefined ? now : options.now

      /** Rows the observer reported and that the next pass must visit. */
      let pending = new Set()
      /** Set when the next pass has to look at the whole container. */
      let needsFull = true
      // Set once per pass: another plugin's visible row means this one must stand
      // down instead of drawing a second action for the same compaction.
      /** The reference plugin renders the compaction row itself when installed. */
      let foreignRowPresent = false
      /** Rows that hold a compaction card, found by the card's own markup. */
      const cardRows = new Map()
      /** One action row per card, moved between the card and the group header. */
      /** Set when an added subtree looks like it may hold a compaction card. */
      /** Pending frame handle, 0 when nothing is scheduled. */
      let scheduled = 0
      let observer = null
      let observedRoot = null
      let watchdog = null
      let lastSlowWarn = 0
      const decorated = new WeakMap()
      const stats = { passes: 0, rows: 0, slow: 0, skipped: 0 }

      /**
       * Ask for a pass. A `full` request survives until the pass runs.
       * @param full - collect every row in the container, not just queued ones.
       */
      function schedule(full) {
        if (full === true) needsFull = true
        if (scheduled !== 0) return
        scheduled = frame(() => {
          scheduled = 0
          pass()
        })
      }

      /** The chat column, or the body while the transcript is not mounted yet. */
      function flowRoot() {
        try {
          return doc.querySelector(FLOW_ROOT_SELECTOR) || doc.body
        } catch {
          return doc.body
        }
      }

      /** Watch the current flow root, switching when the transcript remounts. */
      function attach(root) {
        if (observer !== null) observer.disconnect()
        observedRoot = root
        if (observer !== null) observer.observe(root, { childList: true, subtree: true })
      }

      /**
       * Queue the rows an addition can bring: a new row itself, rows inside a
       * newly added subtree, or the row whose action strip was just replaced.
       * Additions this plugin makes carry neither, so its own writes cannot wake
       * it again.
       * @param node - one added element.
       * @returns whether the pass has work.
       */
      function queueAdded(node) {
        let dirty = false
        if (node.hasAttribute('data-chat-flow')) {
          needsFull = true
          dirty = true
        }
        if (node.hasAttribute('data-chat-flow-kind')) {
          pending.add(node)
          return true
        }
        // A re-rendered Turn header loses the hidden marker with the old element;
        // its appearance is what brings the marker back.
        if (node.hasAttribute(TURN_PROCESS_ATTR)) dirty = true
        // A leaf element cannot contain a row or a strip: the common case during
        // streaming (a text span) stops here instead of walking the subtree.
        if (node.childElementCount === 0) return dirty
        const rows = node.querySelectorAll(ROW_SELECTOR)
        for (const row of rows) {
          pending.add(row)
          dirty = true
        }
        if (hasActionClass(node)) {
          const row = closestRow(node)
          if (row !== null) {
            pending.add(row)
            dirty = true
          }
        } else if (node.querySelector(BAR_SELECTOR) !== null) {
          const row = closestRow(node)
          if (row !== null) {
            pending.add(row)
            dirty = true
          }
        }
        return dirty
      }

      /**
       * The flow column can be remounted without this Session's seat remounting
       * (a view switch, a panel rebuild). The observer stays attached to the dead
       * element and would never see a row again, so the root is re-validated on a
       * slow timer: one cheap query a second, and a full pass when it moved.
       */
      function revalidateRoot() {
        const root = flowRoot()
        if (root !== observedRoot || observedRoot === null || observedRoot.isConnected === false) {
          attach(root)
          needsFull = true
          schedule(false)
          return
        }
      }

      /** Observer callback: queue work, then let the frame coalesce it. */
      function onMutations(records) {
        let dirty = false
        for (const record of records) {
          if (record.type !== 'childList') continue
          const added = record.addedNodes
          for (let index = 0; index < added.length; index += 1) {
            const node = added[index]
            if (node === null || node.nodeType !== 1) continue
            if (queueAdded(node)) dirty = true
          }
        }
        if (dirty) schedule(false)
      }

      /**
       * Keep one prompt row decorated. Returns false when the row holds no
       * durable prompt (or its cut is still unknown), which also clears a stale
       * node and defers the row until the timeline knows its previous Turn.
       * @param row - one `[data-chat-flow-kind]` row.
       * @param nodes - the live ChatSnapshot node map.
       * @param snapshot - the live ChatSnapshot (for Turn boundaries).
       * @returns whether the row now carries the action.
       */
      function decorate(row, nodes, snapshot) {
        const kind = row.getAttribute('data-chat-flow-kind')
        const key = nodeKeyOfRow(row)
        const status = live === null || live === undefined ? undefined : live.diagnose
        if (status !== undefined && status !== null) {
          status.rows += 1
          status.kinds.set(String(kind), (status.kinds.get(String(kind)) === undefined ? 0 : status.kinds.get(String(kind))) + 1)
          if (String(key).indexOf('compact') >= 0) status.compactionish += 1
        }
        const signature = String(sessionId) + '|' + String(key)
        // Compaction rows are transcript nodes now; a card row carries nothing here.
        if (COMPACTION_KINDS.has(kind)) return false
        if (!PROMPT_KINDS.has(kind)) return false
        const previous = decorated.get(row)
        if (previous !== undefined && previous.signature === signature && previous.host.isConnected === true) {
          stats.skipped += 1
          return true
        }
        // ⚠ FROZEN (feature 2, verified working in the field at 0.32.0): the cut is
        // this row's own event seq. Do not change the semantics here without a bug
        // report from the user; feature 1 below is the only open area.
        //
        // 点哪里，哪里就是尾部：切点就是这一行自己的事件 seq。子会话到这条为止，
        // 后面的事件一律不带。这个 Turn 因此在子会话里没有回答，Host 会补一个
        // `forked` 的合拢事件。那个收尾轮的过程头**不隐藏**：它是展开该轮过程组的
        // 唯一入口，藏了它，组里的压缩卡片就再也点不开——那正是分叉子会话里
        // “看不到压缩卡片和操作行”的原因。
        const messageSeq = seqOfNode(nodeOf(nodes, key))
        const atSeq = messageSeq
        if (atSeq === null) {
          decorated.delete(row)
          removeHost(row)
          return false
        }
        // The strip is small; the row is not (a prompt can carry a whole rendered
        // document). Every adoption query is scoped to the strip for that reason.
        const bar = row.querySelector(BAR_SELECTOR)
        if (bar === null) {
          decorated.delete(row)
          removeHost(row)
          return false
        }
        const host = hostIn(bar, doc)
        const button = host.querySelector('button')
        const label = live.t('action.fork')
        if (button !== null && button.getAttribute('aria-label') !== label) {
          button.setAttribute('aria-label', label)
          button.setAttribute('title', label + ' · v' + PLUGIN_VERSION)
        }
        host.setAttribute('data-dsfa-seq', String(atSeq))
        host.setAttribute('data-dsfa-session', String(sessionId))
        if (button !== null && button.getAttribute('data-dsfa-wired') !== '1') {
          // Wired once per button: this pass runs whenever a row changes, and an
          // adopted button keeps the listener of the instance that built it.
          button.setAttribute('data-dsfa-wired', '1')
          button.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            const atSeq = Number(host.getAttribute('data-dsfa-seq'))
            const source = host.getAttribute('data-dsfa-session')
            if (!Number.isInteger(atSeq) || source === null || source === '') return
            live.fork(source, atSeq)
          })
        }
        // The anchor must be a FOREIGN button: on a later pass this plugin's own
        // button can be the only one in the strip, and anchoring to it would move
        // the node onto itself on every pass (a mutation, so the observer would
        // wake again: an endless reconciliation loop).
        const first = [].slice.call(bar.querySelectorAll('button')).filter((candidate) => candidate !== button)[0] || null
        if (first !== null) {
          // Right after the shipped copy button: sibling plugins append at the end,
          // so this anchor is the one position nobody else moves.
          if (host.parentElement !== bar || host.previousSibling !== first) bar.insertBefore(host, first.nextSibling)
        } else if (host.parentElement !== bar || host.nextSibling !== null) {
          // No action button to anchor to: stay last, and do nothing when already
          // last so a pass never mutates the tree for nothing.
          bar.insertBefore(host, null)
        }
        decorated.set(row, { signature, host })
        return true
      }

      /** One coalesced pass over queued rows (plus a full collect when asked). */
      function pass() {
        const snapshot = live.snapshot
        const nodes = snapshot === undefined || snapshot === null ? undefined : snapshot.nodes
        if (nodes === undefined || nodes === null || typeof nodes.get !== 'function') return
        const root = flowRoot()
        if (root !== observedRoot) {
          attach(root)
          needsFull = true
        }
        if (needsFull) {
          needsFull = false
          const rows = root.querySelectorAll(ROW_SELECTOR)
          for (const row of rows) pending.add(row)
        }
        if (pending.size === 0) return
        const batch = pending
        pending = new Set()
        const started = clock()
        // One query per pass, never per row: a visible foreign row decides whether
        // this plugin stands down.
        // Only a *visible* foreign row replaces ours: the reference plugin's row can
        // sit inside a collapsed group, and standing down for an invisible one would
        // leave the card with no action at all.
        foreignRowPresent = false
        if (live !== null && live !== undefined && live.diagnose !== undefined) live.diagnose.vendorRow = false
        // The row this plugin registers as a transcript node counts too: when it is
        // painted, the DOM fallback has nothing to add.
        if (typeof root.querySelectorAll === 'function') {
          for (const candidate of root.querySelectorAll('[data-dsfa-node-row]')) {
            if ((typeof candidate.getClientRects !== 'function' || candidate.getClientRects().length > 0) && paintsVisibly(candidate)) {
              foreignRowPresent = true
              if (live !== null && live !== undefined && live.diagnose !== undefined) live.diagnose.vendorRow = true
              break
            }
          }
        }
        if (foreignRowPresent !== true && typeof root.querySelectorAll === 'function') {
          for (const candidate of root.querySelectorAll(FOREIGN_ROW_SELECTOR)) {
            if (typeof candidate.getClientRects !== 'function' || candidate.getClientRects().length > 0) {
              // The reference row reveals itself on hover for every row that is not
              // the transcript tail (`data-dfac-reveal="hover"` + `opacity:0`). It
              // occupies space, so a rect test alone would treat an invisible row as
              // present and leave the card with no action at all.
              if (paintsVisibly(candidate)) {
                foreignRowPresent = true
                if (live !== null && live !== undefined && live.diagnose !== undefined) live.diagnose.vendorRow = true
                break
              }
            }
          }
        }
        for (const row of batch) {
          try {
            decorate(row, nodes, snapshot)
          } catch (error) {
            if (live !== null && live !== undefined && live.diagnose !== undefined) live.diagnose.errors += 1
            console.warn('[dsh-fork-anywhere] row decoration failed:', error)
          }
        }
        // Only when nothing at all carries the action yet (no card strip placed by
        // the sweep above, and no other fork plugin's painted row).
        if (typeof live.sessions === 'function') {
          // Cosmetic clean-up only: never let it disturb the transcript.
          try {
            hideStaleInputs(root, staleInputTexts(live.sessions(), sessionId))
          } catch (error) {
            console.warn('[dsh-fork-anywhere] stale-input clean-up skipped:', error)
          }
          try {
            const tails = typeof root.querySelectorAll === 'function' ? root.querySelectorAll('[data-turn-tail]') : []
            publishStatus({
              turnTails: tails.length,
              turnTailValues: [].slice.call(tails).map((el) => el.getAttribute('data-turn-tail')).join(','),
              turnProcessValues: [].slice.call(root.querySelectorAll('[' + TURN_PROCESS_ATTR + ']')).map((el) => el.getAttribute(TURN_PROCESS_ATTR)).join(','),
            })
            decorateDirtyTurns(root, dirtyTurnEnds(live.sessions(), sessionId), {
              t: live.t,
              fork: live.fork,
              sessionId,
              doc,
            })
          } catch (error) {
            console.warn('[dsh-fork-anywhere] stopped-turn action skipped:', error)
          }
          try {
            hideEmptyForkedTurns(root, forkedTurnNumbers(live.sessions(), sessionId))
          } catch (error) {
            console.warn('[dsh-fork-anywhere] empty-turn clean-up skipped:', error)
          }
        }
        const hasActionRow = true
        if (false) {
          try {
          } catch (error) {
            if (live !== null && live !== undefined && live.diagnose !== undefined) live.diagnose.errors += 1
            console.warn('[dsh-fork-anywhere] header action failed:', error)
          }
        }
        stats.passes += 1
        if (live !== null && live !== undefined && typeof live.notify === 'function') live.notify()
        stats.rows += batch.size
        const cost = clock() - started
        if (cost > SLOW_PASS_MS) {
          stats.slow += 1
          const at = clock()
          if (at - lastSlowWarn > SLOW_WARN_INTERVAL_MS) {
            lastSlowWarn = at
            console.warn('[dsh-fork-anywhere] reconcile pass took ' + cost.toFixed(1) + 'ms over ' + batch.size + ' rows')
          }
        }
      }

      return {
        start() {
          if (Observer !== null) {
            observer = new Observer(onMutations)
            attach(flowRoot())
          }
          if (typeof setInterval === 'function') watchdog = setInterval(revalidateRoot, WATCHDOG_MS)
          schedule(true)
        },
        stop() {
          if (scheduled !== 0) {
            cancel(scheduled)
            scheduled = 0
          }
          if (observer !== null) observer.disconnect()
          observer = null
          if (watchdog !== null) {
            clearInterval(watchdog)
            watchdog = null
          }
          pending = new Set()
          removeAll(doc)
        },
        /** Re-validate the watched column now (the watchdog's own step). */
        revalidate() {
          revalidateRoot()
        },
        /** Run the pending frame now (tests and teardown flush). */
        flush() {
          if (scheduled !== 0) {
            cancel(scheduled)
            scheduled = 0
          }
          pass()
        },
        stats() {
          return { ...stats, pending: pending.size, needsFull }
        },
        observerCallback: onMutations,
      }
    }

    // --- fork -----------------------------------------------------------------

    /**
     * Ask the Host to fork the session at one inclusive prompt event and open the
     * result. Deliberately the SHIPPED operation: this plugin chooses the cut,
     * never the mechanics.
     * @param ctx - client cordis context, used to reach the services lazily.
     * @param t - translator for the toast copy.
     * @param sessionId - source session.
     * @param atSeq - inclusive event cut (the prompt's own seq).
     */
    /**
     * 平台那排操作里被禁用的分支按钮。
     *
     * 平台的 `MessageIconActions` 用 `aria-disabled` / `data-unavailable` 标记不可用
     * 的动作；只有分支会带这个标记，所以命中即分支按钮。
     * @returns 那个按钮，没有则 null。
     */
    function disabledBranchButton(container) {
      if (container === null || container === undefined || typeof container.querySelectorAll !== 'function') return null
      for (const button of [].slice.call(container.querySelectorAll('button'))) {
        if (typeof button.getAttribute !== 'function') continue
        if (button.getAttribute('data-dsfa-hide-shipped') === '1') return null
        const disabled = button.getAttribute('aria-disabled') === 'true' || (typeof button.hasAttribute === 'function' && button.hasAttribute('data-unavailable'))
        if (disabled) return button
      }
      return null
    }

    /**
     * 容器里是否已有平台自己的操作按钮。
     *
     * 平台的 MessageIconActions（复制 / 分支 / 时间）渲染在 div[data-turn-tail]
     * 里；只要里面有一个不是本插件创建的 button，就说明这一轮平台已经提供了入口。
     */
    function hasShippedActions(container) {
      if (container === null || container === undefined || typeof container.querySelectorAll !== 'function') return false
      for (const button of [].slice.call(container.querySelectorAll('button'))) {
        const host = typeof button.closest === 'function' ? button.closest('[' + HOST_ATTR + '="1"]') : null
        if (host === null || host === undefined) return true
      }
      return false
    }

    /** Turns a fork closed with a synthetic `forked` end. */
    function forkedTurnNumbers(sessions, sessionId) {
      const none = []
      if (sessions === null || sessions === undefined || typeof sessions.binding !== 'function') return none
      const binding = sessions.binding(sessionId)
      const source = binding === null || binding === undefined ? undefined : binding.eventSource
      if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return none
      let entries
      try {
        entries = source.getSnapshot().entries
      } catch {
        return none
      }
      if (!Array.isArray(entries)) return none
      // 只有“从用户消息分叉”才需要收尾：切点落在某条 user/message 或 steering 上。
      // 从压缩点分叉时，切点是 compaction/end，这一轮本身带着压缩卡片，不能动。
      let boundary = -1
      for (const entry of entries) {
        const event = entry === null || entry === undefined ? undefined : entry.event
        if (event === undefined || event === null) continue
        if (event.type === 'session/end-seed' && event.data !== null && event.data !== undefined && event.data.inherited === true) boundary = event.seq
      }
      if (boundary < 0) return none
      const cutEvent = (() => {
        for (const entry of entries) {
          const event = entry === null || entry === undefined ? undefined : entry.event
          if (event !== undefined && event !== null && event.seq === boundary - 1) return event
        }
        return undefined
      })()
      if (cutEvent === undefined) return none
      if (cutEvent.type !== 'user/message' && cutEvent.type !== 'steering') return none
      const turns = []
      for (const entry of entries) {
        const event = entry === null || entry === undefined ? undefined : entry.event
        if (event === undefined || event === null || event.type !== 'turn/end') continue
        const reason = event.data === null || event.data === undefined ? undefined : event.data.reason
        if (reason === undefined || reason === null || reason.kind !== 'forked') continue
        const turn = event.data.turn
        if (typeof turn === 'number') turns.push(turn)
      }
      return turns
    }

    /** Turns the log records as stopped, interrupted or otherwise not completed. */
    function dirtyTurnEnds(sessions, sessionId) {
      const none = []
      if (sessions === null || sessions === undefined || typeof sessions.binding !== 'function') return none
      const binding = sessions.binding(sessionId)
      const source = binding === null || binding === undefined ? undefined : binding.eventSource
      if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return none
      let entries
      try {
        entries = source.getSnapshot().entries
      } catch {
        return none
      }
      if (!Array.isArray(entries)) return none
      const found = []
      for (const entry of entries) {
        const event = entry === null || entry === undefined ? undefined : entry.event
        if (event === undefined || event === null || event.type !== 'turn/end') continue
        const reason = event.data === null || event.data === undefined ? undefined : event.data.reason
        const kind = reason === undefined || reason === null ? undefined : reason.kind
        if (kind === undefined || kind === 'completed' || kind === 'forked') continue
        const turn = event.data.turn
        if (typeof turn !== 'number') continue
        found.push({ turn, seq: event.seq })
      }
      return found
    }

    /**
     * Put a fork action on a Turn that ended without completing.
     *
     * A stopped Turn can leave no reply row to carry the action, so the Turn's own
     * process header takes it: the cut is that Turn's `turn/end`, which is exactly
     * where it stopped.
     * @returns how many headers received the action this pass.
     */
    function decorateDirtyTurns(root, entries, options) {
      const translate = options === undefined || options === null || typeof options.t !== 'function' ? (key) => key : options.t
      const fork = options === undefined || options === null || typeof options.fork !== 'function' ? null : options.fork
      const session = options === undefined || options === null ? undefined : options.sessionId
      const targetDoc =
        options !== undefined && options !== null && options.doc !== undefined
          ? options.doc
          : root !== null && root !== undefined && root.ownerDocument !== undefined && root.ownerDocument !== null
            ? root.ownerDocument
            : typeof document === 'undefined'
              ? undefined
              : document
      if (entries.length === 0 || root === null || root === undefined || typeof root.querySelector !== 'function') return 0
      let mounted = 0
      for (const entry of entries) {
        // The platform renders every Turn's action row inside div[data-turn-tail].
        // A stopped Turn has that container too, just empty - that is the area under
        // the Turn's content. Anything appended to the header row lands between the
        // title and the content, which is the wrong place.
        const tail = root.querySelector('[data-turn-tail="' + entry.turn + '"]')
        const header = root.querySelector('[' + TURN_PROCESS_ATTR + '="' + entry.turn + '"]')
        const anchorRow = header === null || header === undefined ? null : closestRow(header)
        let container = null
        if (tail !== null && tail !== undefined) {
          // 平台已经放了一排操作时：
          // - 分支按钮可用 → 收掉自己的，避免两个入口；
          // - 分支按钮是禁用态（“仅可从已完成轮次的最后一条消息分支”）→ 把这个
          //   点不动的按钮藏起来，留自己的可点按钮。页面上始终只有一个可点的 fork。
          const shippedDisabled = disabledBranchButton(tail)
          if (shippedDisabled !== null) {
            shippedDisabled.setAttribute('data-dsfa-hide-shipped', '1')
          } else if (hasShippedActions(tail)) {
            for (const mine of [].slice.call(tail.querySelectorAll('[data-dsfa-dirty="1"]'))) mine.remove()
            continue
          }
          container = tail
        } else if (anchorRow !== null && anchorRow !== undefined) {
          // No such container: the action becomes its own row strictly BELOW the
          // Turn's last content row, never between the title and the content.
          let lastRow = anchorRow
          if (typeof anchorRow.querySelectorAll === 'function') {
            const inner = [].slice.call(anchorRow.querySelectorAll('[data-chat-flow-key]'))
            if (inner.length > 0) lastRow = inner[inner.length - 1]
          }
          if (lastRow === anchorRow) {
            if (anchorRow.parentElement === null) continue
            container = targetDoc.createElement('div')
            container.className = 'dsfa-dirty-row'
            anchorRow.parentElement.insertBefore(container, anchorRow.nextSibling)
          } else {
            if (lastRow.parentElement === null) continue
            container = targetDoc.createElement('div')
            container.className = 'dsfa-dirty-row'
            lastRow.parentElement.insertBefore(container, lastRow.nextSibling)
          }
        }
        if (container === null) continue
        const host = hostIn(container, targetDoc)
        if (host.parentElement !== container) container.appendChild(host)
        host.setAttribute('data-dsfa-dirty', '1')
        const button = host.querySelector('button')
        if (button === null) continue
        const label = translate('action.fork')
        if (button.getAttribute('aria-label') !== label) {
          button.setAttribute('aria-label', label)
          button.setAttribute('title', label + ' · v' + PLUGIN_VERSION)
        }
        host.setAttribute('data-dsfa-seq', String(entry.seq))
        host.setAttribute('data-dsfa-session', String(session))
        if (button.getAttribute('data-dsfa-wired') !== '1') {
          button.setAttribute('data-dsfa-wired', '1')
          button.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            const atSeq = Number(host.getAttribute('data-dsfa-seq'))
            const source = host.getAttribute('data-dsfa-session')
            if (!Number.isInteger(atSeq) || source === null || source === '' || fork === null) return
            fork(source, atSeq)
          })
        }
        mounted += 1
      }
      return mounted
    }

    /**
     * Hide a forked Turn that holds nothing but its own completion header.
     *
     * A fork closes the half Turn it cut, and an empty one renders as a lone
     * "已完成 · 用时 1 秒". A forked Turn that still carries rows (a compaction
     * card, steps) is left alone: its header is the only way to open the group.
     * @returns how many headers were hidden this pass.
     */
    function hideEmptyForkedTurns(root, turns) {
      if (turns.length === 0 || root === null || root === undefined || typeof root.querySelector !== 'function') return 0
      let hidden = 0
      for (const turn of turns) {
        const header = root.querySelector('[' + TURN_PROCESS_ATTR + '="' + turn + '"]')
        if (header === null || header === undefined) continue
        const row = closestRow(header)
        if (row === null || row === undefined) continue
        // The row is only empty when it carries nothing but its own header text.
        // Counting nested rows is not enough: members can sit outside the row in
        // the DOM, and hiding the row then takes a compaction card with it.
        const headerText = typeof header.textContent === 'string' ? header.textContent.trim() : ''
        const rowText = typeof row.textContent === 'string' ? row.textContent.trim() : ''
        // 空 = 行里没有任何子级流行（组头本身不是流行）。只看文字会漏掉带时长或
        // 时间戳的组头；只看子行又担心成员不在行内，所以两者合起来判：有子行且
        // 文字还有别的内容才保留，其余视为空轮。
        if (typeof row.querySelector === 'function' && row.querySelector('[data-compaction-icon]') !== null) continue
        const hasChildRow =
          typeof row.querySelectorAll === 'function' && row.querySelectorAll('[data-chat-flow-key]').length > 0
        if (hasChildRow && headerText !== '' && rowText !== headerText) continue
        if (row.getAttribute('data-dsfa-empty-turn') !== '1') {
          row.setAttribute('data-dsfa-empty-turn', '1')
          hidden += 1
        }
      }
      return hidden
    }

    /**
     * Hide the rows that render an inherited, undeliverable input.
     *
     * Matched by the input's exact text, so a delivered message that merely
     * contains it is untouched.
     * @returns how many rows were hidden this pass.
     */
    function hideStaleInputs(root, texts) {
      if (texts.length === 0 || root === null || root === undefined || typeof root.querySelectorAll !== 'function') return 0
      const wanted = new Set(texts)
      let hidden = 0
      for (const row of [].slice.call(root.querySelectorAll('[data-chat-flow-key]'))) {
        const text = typeof row.textContent === 'string' ? row.textContent.trim() : ''
        if (wanted.has(text) !== true) continue
        // Never touch a row backed by a durable transcript node: a real message
        // that happens to share the text must survive.
        const durable =
          (typeof row.getAttribute === 'function' && row.getAttribute('data-chat-node-key') !== null) ||
          (typeof row.querySelectorAll === 'function' && row.querySelectorAll('[data-chat-node-key]').length > 0)
        if (durable) continue
        if (row.getAttribute('data-dsfa-stale') !== '1') {
          row.setAttribute('data-dsfa-stale', '1')
          hidden += 1
        }
      }
      return hidden
    }

    /**
     * Text of the inputs a fork inherited but can never deliver.
     *
     * A fork copies the event prefix, and the prefix can contain
     * `agent/inbox/spliced` items that were queued for a later turn and never
     * consumed before the cut. The inbox projection replays them as pending
     * input, so a child forked at a compaction shows an unsent bubble that
     * belongs to the parent's later turn.
     * @returns the dangling input texts, empty outside a fork child.
     */
    function staleInputTexts(sessions, sessionId) {
      const none = []
      if (sessions === null || sessions === undefined || typeof sessions.binding !== 'function') return none
      const binding = sessions.binding(sessionId)
      const source = binding === null || binding === undefined ? undefined : binding.eventSource
      if (source === undefined || source === null || typeof source.getSnapshot !== 'function') return none
      let entries
      try {
        entries = source.getSnapshot().entries
      } catch {
        return none
      }
      if (!Array.isArray(entries)) return none
      const boundary = (() => {
        let found = -1
        for (const entry of entries) {
          const event = entry === null || entry === undefined ? undefined : entry.event
          if (event === undefined || event === null) continue
          if (event.type === 'session/end-seed' && event.data !== null && event.data !== undefined && event.data.inherited === true) found = event.seq
        }
        return found
      })()
      if (boundary < 0) return none
      const queued = new Map()
      const delivered = new Set()
      for (const entry of entries) {
        const event = entry === null || entry === undefined ? undefined : entry.event
        if (event === undefined || event === null || typeof event.seq !== 'number' || event.seq >= boundary) continue
        if (event.type === 'agent/inbox/spliced') {
          const inserted = event.data !== null && event.data !== undefined && Array.isArray(event.data.inserted) ? event.data.inserted : []
          for (const item of inserted) {
            const text = (Array.isArray(item.content) ? item.content : []).map((block) => (block !== null && typeof block === 'object' && typeof block.text === 'string' ? block.text : '')).join('').trim()
            if (text !== '') queued.set(text, event.seq)
          }
        }
        if (event.type === 'user/message') {
          const text = (Array.isArray(event.data.content) ? event.data.content : []).map((block) => (block !== null && typeof block === 'object' && typeof block.text === 'string' ? block.text : '')).join('').trim()
          if (text !== '') delivered.add(text)
        }
      }
      const stale = []
      for (const [text] of queued) if (delivered.has(text) !== true) stale.push(text)
      return stale
    }

    function forkSessionAt(ctx, t, sessionId, atSeq, context) {
      const sessions = ctx.get('sessions')
      const uiWorkspace = ctx.get('uiWorkspace')
      if (sessions === null || sessions === undefined || typeof sessions.fork !== 'function') {
        toast(t('toast.failed') + ': sessions service unavailable', true)
        return
      }
      const report = (error) => {
        const code =
          error !== null && typeof error === 'object'
            ? (error.rpcError !== null && typeof error.rpcError === 'object' && typeof error.rpcError.code === 'string' ? error.rpcError.code : typeof error.code === 'string' ? error.code : '')
            : ''
        if (code === 'session/migration-required') {
          if (uiWorkspace !== null && uiWorkspace !== undefined) uiWorkspace.openSession(sessionId)
          toast(t('toast.migration'), true)
          return
        }
        if (code === 'session/fork-unavailable') {
          toast(t('toast.unavailable'), true)
          return
        }
        const detail = error !== null && typeof error === 'object' && typeof error.message === 'string' ? error.message : String(error)
        console.warn('[dsh-fork-anywhere] fork rejected:', error)
        toast(t('toast.failed') + ': ' + detail, true)
      }
      let pending
      try {
        pending = sessions.fork({ sessionId, atSeq, increaseTitle: true })
      } catch (error) {
        report(error)
        return
      }
      Promise.resolve(pending).then((childId) => {
        if (typeof childId !== 'string' || childId === '') {
          report(new Error('fork returned no session id'))
          return
        }
        // No success notice: the child session opens on its own, and a toast under
        // the transcript only covers the row the fork came from. Failures still
        // report, because a silent failure is worse than none.
        if (uiWorkspace !== null && uiWorkspace !== undefined) uiWorkspace.openSession(childId)
      }, report)
    }

    // --- toast ----------------------------------------------------------------

    let toastTimer = null

    /**
     * One-line transient notice in this plugin's own namespace; the host has no
     * public toast service, and a silent failure here would look like a dead button.
     * @param message - already-localized text.
     * @param isError - error styling.
     */
    function toast(message, isError) {
      if (typeof document === 'undefined' || document.body === null) return
      let node = document.getElementById(TOAST_ID)
      if (node === null) {
        node = document.createElement('div')
        node.id = TOAST_ID
      }
      node.className = 'dsfa-toast' + (isError === true ? ' dsfa-toast-error' : '')
      node.textContent = String(message)
      node.style.display = 'block'
      document.body.appendChild(node)
      if (toastTimer !== null) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => {
        toastTimer = null
        node.style.display = 'none'
      }, 2800)
    }

    // --- locale ---------------------------------------------------------------

    /**
     * Bound translator with a built-in fallback, so the button still has a label
     * on a profile where the locale service is not up yet.
     * @param locale - client locale service, possibly undefined.
     * @returns `t(key)`.
     */
    function translator(locale) {
      let bound = null
      if (locale !== null && locale !== undefined && typeof locale.bind === 'function') {
        try {
          bound = locale.bind(NS)
        } catch {
          bound = null
        }
      }
      return (key, params) => {
        let template
        if (bound !== null) {
          try {
            const value = bound(key)
            if (typeof value === 'string' && value !== key) template = value
          } catch {
            /* fall through to the built-in copy */
          }
        }
        if (template === undefined) template = dictionaries.zh[key] ?? dictionaries.en[key] ?? key
        if (params === undefined) return template
        return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      }
    }

    // --- compaction row: a transcript node -------------------------------------
    //
    // One landed compaction becomes one row, registered as a chat node so the
    // Conversation layer places it right after the event it belongs to. The shape
    // follows the reference plugin's contract: `anchorSeq = compaction/end + 0.1`,
    // `location` from the lifecycle's first match, no `groupTree` (a turn-level
    // node would split the Turn's process group and render its header twice).

    /** Node kind of the compaction row; also the `conversation.chat.node` key. */
    const COMPACTION_ROW_KIND = 'dsh-fork-anywhere-compaction'

    /** Summary body of one `compaction/summary` event, or null. */
    function summaryTextOf(event) {
      const blocks = event === null || event === undefined || event.data === null || event.data === undefined ? undefined : event.data.summary
      if (!Array.isArray(blocks)) return null
      const text = blocks.map((block) => (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string' ? block.text : '')).join('').trim()
      return text === '' ? null : text
    }

    /** Last Match of one event type in a node definition context. */
    function lastMatchOf(context, type) {
      let found
      for (const match of context.matches) {
        if (match !== null && match !== undefined && match.event !== null && match.event !== undefined && match.event.type === type) found = match
      }
      return found
    }

    /** Group a compaction lifecycle event by id, or null when it carries none. */
    function compactionMatchOf(event) {
      const data = event === null || event === undefined || event.data === null || event.data === undefined ? {} : event.data
      const id =
        typeof data.compactionId === 'string' && data.compactionId !== ''
          ? data.compactionId
          : typeof data.sourceCommandId === 'string' && data.sourceCommandId !== ''
            ? data.sourceCommandId
            : undefined
      if (id === undefined) return null
      return { id, role: event.type === 'compaction/start' ? 'start' : 'update' }
    }

    /**
     * The compaction row definition.
     *
     * A failed or running compaction produces no node, so the row only ever
     * describes a checkpoint that really landed.
     * @param tally - optional counters for the status global.
     * @returns the node definition handed to `uiConversation.events.register`.
     */
    function compactionRowDefinition(tally) {
      const count = tally === undefined || tally === null ? {} : tally
      return {
        kind: COMPACTION_ROW_KIND,
        target: 'chat',
        match: {
          'compaction/start': compactionMatchOf,
          'compaction/summary': compactionMatchOf,
          'compaction/end': compactionMatchOf,
        },
        start: () => ({}),
        update: (context, match) => {
          const state = context.state === undefined || context.state === null ? {} : context.state
          if (match.event.type === 'compaction/end') return { ...state, end: match }
          if (match.event.type === 'compaction/summary') return { ...state, summary: match }
          return state
        },
        buildViewNode: (context) => {
          count.built = (count.built === undefined ? 0 : count.built) + 1
          const state = context.state === undefined || context.state === null ? {} : context.state
          const end = state.end === undefined ? lastMatchOf(context, 'compaction/end') : state.end
          if (end === undefined) return null
          if (end.event.data !== undefined && end.event.data !== null && end.event.data.error !== undefined) return null
          const summary = state.summary === undefined ? lastMatchOf(context, 'compaction/summary') : state.summary
          const summaryData = summary === undefined || summary.event.data === null || summary.event.data === undefined ? null : summary.event.data
          // 位置取“最后一个 match”（也就是 compaction/end）的位置，不是起点。
          // 取起点会把这一行排到压缩开始所在的那一步之后——页面上看起来就像被
          // 插进一段助手消息中间，而不是排在末尾。
          const location =
            (end !== undefined && end !== null && end.location !== undefined && end.location !== null
              ? end.location
              : undefined) ??
            (context.start !== undefined && context.start !== null && context.start.location !== undefined
              ? context.start.location
              : undefined) ??
            (context.matches.length > 0 && context.matches[0] !== undefined && context.matches[0].location !== undefined
              ? context.matches[0].location
              : { kind: 'unresolved' })
          count.nodes = (count.nodes === undefined ? 0 : count.nodes) + 1
          return {
            key: context.key,
            kind: COMPACTION_ROW_KIND,
            id: context.id,
            target: 'chat',
            anchorSeq: end.event.seq + 0.1,
            location,
            visibility: 'visible',
            data: {
              seq: end.event.seq,
              time: end.event.time,
              summarySeq: summary === undefined ? null : summary.event.seq,
              provider: summaryData === null ? null : textFieldOf(summaryData.provider),
              model: summaryData === null ? null : textFieldOf(summaryData.model),
              summaryText: summary === undefined ? null : summaryTextOf(summary.event),
              usage: summaryData === null ? null : normalizeUsage(summaryData.usage),
              // The reference only shows the pill when the summarizer reported both
              // an input and an output count; a partial record would read as zeroes.
              usageComplete:
                summaryData !== null &&
                summaryData.usage !== null &&
                typeof summaryData.usage === 'object' &&
                Number.isSafeInteger(summaryData.usage.uncachedInputTokens) &&
                summaryData.usage.uncachedInputTokens >= 0 &&
                Number.isSafeInteger(summaryData.usage.outputTokens) &&
                summaryData.usage.outputTokens >= 0,
            },
          }
        },
      }
    }

    /** One non-empty string field, or null. */
    function textFieldOf(value) {
      return typeof value === 'string' && value !== '' ? value : null
    }

    /** `HH:mm` today, `3月5日 HH:mm` this year, `2025年3月5日 HH:mm` otherwise. */
    function clockLabel(time, t) {
      if (typeof time !== 'number') return ''
      const date = new Date(time)
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      const clock = pad(date.getHours()) + ':' + pad(date.getMinutes())
      if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()) return clock
      const params = { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }
      const template = date.getFullYear() === now.getFullYear() ? t('clock.md', params) : t('clock.ymd', params)
      return String(template) + ' ' + clock
    }

    /** Exact count with the locale's digit grouping. */
    function exactTokens(value, t) {
      const digits = String(Math.max(0, Math.floor(value)))
      const groups = []
      for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end))
      return groups.join(t('number.groupSeparator'))
    }

    /** Write text through the clipboard, reporting success. */
    function clipboardWrite(text) {
      try {
        const nav = typeof navigator === 'undefined' ? undefined : navigator
        if (nav !== undefined && nav !== null && nav.clipboard !== null && nav.clipboard !== undefined && typeof nav.clipboard.writeText === 'function') {
          return Promise.resolve(nav.clipboard.writeText(text)).then(() => true, () => false)
        }
      } catch {
        /* a refused write leaves the action unchanged */
      }
      return Promise.resolve(false)
    }

    /** Place a fixed-position panel above its trigger, clamped to the viewport. */
    function panelPosition(trigger) {
      const fallback = { position: 'fixed', left: 0, top: 0 }
      if (trigger === null || trigger === undefined || typeof trigger.getBoundingClientRect !== 'function') return fallback
      let rect
      try {
        rect = trigger.getBoundingClientRect()
      } catch {
        return fallback
      }
      if (rect === null || rect === undefined) return fallback
      const width = 240
      const viewportWidth = typeof window === 'undefined' || window.innerWidth === undefined ? 0 : window.innerWidth
      const left = Math.max(12, Math.min(rect.left, viewportWidth === 0 ? rect.left : viewportWidth - width - 12))
      const top = Math.max(12, rect.top - 8)
      return { position: 'fixed', left: left + 'px', top: top + 'px', transform: 'translateY(-100%)', width: width + 'px' }
    }

    /** Exact-usage accounting for one compaction, shown in a popover. */
    function CompactionUsagePanel(props) {
      const { usage, provider, model, t, anchor, onClose } = props
      react.useEffect(() => {
        const doc = typeof document === 'undefined' ? undefined : document
        if (doc === undefined) return undefined
        const onKeyDown = (event) => {
          if (event !== null && event.key === 'Escape') onClose()
        }
        const onPointer = (event) => {
          if (anchor === null || anchor === undefined) return
          if (event !== null && typeof event.target === 'object' && anchor.contains !== undefined && anchor.contains(event.target) === true) return
          onClose()
        }
        doc.addEventListener('keydown', onKeyDown)
        doc.addEventListener('click', onPointer, true)
        return () => {
          doc.removeEventListener('keydown', onKeyDown)
          doc.removeEventListener('click', onPointer, true)
        }
      }, [anchor, onClose])
      const rows = [
        [t('compact.cacheRead'), usage.cacheRead],
        [t('compact.input'), usage.input],
        [t('compact.cacheWrite'), usage.cacheWrite],
        [t('compact.output'), usage.output],
        [t('compact.total'), usage.cacheRead + usage.input + usage.output],
      ]
      const denominator = usage.cacheRead + usage.input
      const hit = denominator === 0 ? null : Math.round((usage.cacheRead / denominator) * 100)
      const children = [
        react.createElement('div', { key: 'title', className: 'dsfa-panel-title' }, t('compact.dialog')),
        react.createElement('div', { key: 'route', className: 'dsfa-panel-route' }, t('compact.model') + ' · ' + (provider === null ? '—' : provider) + (model === null ? '' : ' / ' + model)),
      ]
      if (hit !== null) children.push(react.createElement('div', { key: 'hit', className: 'dsfa-panel-hit' }, t('compact.cacheHit') + ' · ' + hit + '%'))
      for (const [label, value] of rows) {
        children.push(
          react.createElement(
            'div',
            { key: 'row-' + label, className: 'dsfa-panel-row' },
            react.createElement('span', null, label),
            react.createElement('span', null, t('compact.count', { count: exactTokens(value, t) })),
          ),
        )
      }
      return react.createElement(
        'div',
        { className: 'dsfa-panel', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('compact.dialog'), style: panelPosition(anchor) },
        ...children,
      )
    }

    /**
     * The compaction row: copy the summary, fork at the checkpoint, show the
     * summarizer's usage, and the completion time.
     *
     * Fork uses the Chat view's own `forkAt` when it is supplied, so the child is
     * created through exactly the platform path; otherwise it falls back to this
     * plugin's fork callback with the Session id the seat receives.
     * @param props - node, translator, fork callbacks, access hook, session id.
     * @returns the row element, or null when the row does not apply.
     */
    function CompactionRowView(props) {
      const node = props === null || props === undefined ? undefined : props.node
      const data = node === null || node === undefined ? undefined : node.data
      const t = typeof props.t === 'function' ? props.t : (key) => key
      // Every hook runs before any early return: `useAccess` is a hook, and a
      // changing access decision must not change the hook order of this component.
      const allowed = typeof props.useAccess === 'function' ? props.useAccess('session/fork') : true
      const [copied, setCopied] = react.useState(false)
      const [open, setOpen] = react.useState(false)
      const timer = react.useRef(null)
      const pill = react.useRef(null)
      react.useEffect(
        () => () => {
          if (timer.current !== null) clearTimeout(timer.current)
        },
        [],
      )
      const summaryText = data === undefined || data === null ? null : data.summaryText
      const copy = react.useCallback(() => {
        if (summaryText === null || summaryText === undefined || copied) return
        clipboardWrite(summaryText).then((ok) => {
          if (ok !== true) return
          setCopied(true)
          timer.current = setTimeout(() => {
            timer.current = null
            setCopied(false)
          }, 1000)
        })
      }, [summaryText, copied])
      if (data === undefined || data === null) return null
      if (node.kind !== undefined && node.kind !== COMPACTION_ROW_KIND) return null
      if (allowed === false) return null
      const forkAt =
        typeof props.forkAt === 'function'
          ? props.forkAt
          : typeof props.fork === 'function' && typeof props.sessionId === 'string'
            ? (seq) => props.fork(props.sessionId, seq)
            : null
      const usage = data.usage === undefined || data.usage === null || data.usageComplete === false ? null : data.usage
      const parts = []
      if (data.summaryText !== null && data.summaryText !== undefined) {
        parts.push(
          react.createElement(
            'button',
            {
              key: 'copy',
              type: 'button',
              className: 'dsfa-action',
              title: t(copied ? 'compact.copied' : 'compact.copy'),
              'aria-label': t(copied ? 'compact.copied' : 'compact.copy'),
              onClick: copy,
            },
            react.createElement('span', { className: 'dsfa-glyph', 'aria-hidden': 'true', dangerouslySetInnerHTML: { __html: copied ? CHECK_ICON : COPY_ICON } }),
          ),
        )
      }
      if (forkAt !== null) {
        parts.push(
          react.createElement(
            'button',
            {
              key: 'fork',
              type: 'button',
              className: 'dsfa-action',
              title: t('compact.fork'),
              'aria-label': t('compact.fork'),
              onClick: () => forkAt(data.seq),
            },
            react.createElement('span', { className: 'dsfa-glyph', 'aria-hidden': 'true', dangerouslySetInnerHTML: { __html: ICON_MARKUP } }),
          ),
        )
      }
      const label = usage === null ? null : usageLabel(usage)
      if (label !== null) {
        parts.push(
          react.createElement(
            'span',
            { key: 'usage', className: 'dsfa-usage-slot', ref: pill },
            react.createElement(
              'button',
              {
                type: 'button',
                className: 'dsfa-usage',
                title: t('compact.usage'),
                'aria-label': t('compact.dialog'),
                'aria-haspopup': 'dialog',
                'aria-expanded': open,
                onClick: () => setOpen(!open),
              },
              react.createElement('span', { className: 'dsfa-glyph', 'aria-hidden': 'true', dangerouslySetInnerHTML: { __html: USAGE_ICON } }),
              react.createElement('span', { className: 'dsfa-usage-label' }, label),
            ),
            // Rendered as its own element: it owns hooks, so calling it as a plain
            // function inside a conditional would break the hook order.
            open
              ? react.createElement(CompactionUsagePanel, {
                  key: 'panel',
                  usage,
                  provider: data.provider === undefined ? null : data.provider,
                  model: data.model === undefined ? null : data.model,
                  t,
                  anchor: pill.current,
                  onClose: () => setOpen(false),
                })
              : null,
          ),
        )
      }
      parts.push(react.createElement('span', { key: 'time', className: 'dsfa-cmeta' }, clockLabel(data.time, t)))
      return react.createElement('div', { className: 'dsfa-crow dsfa-crow--node', 'data-dsfa-node-row': '1' }, ...parts)
    }

    // --- slot entry -----------------------------------------------------------

    /**
     * Invisible per-session seat. It subscribes to the chat nodes so the ref is
     * always current, and owns one reconciler whose lifetime is the Session's -
     * the effect depends on `sessionId` alone, so streamed output never rebuilds
     * the observer.
     * @param props - injected sessionId/translator/fork plus the standard `useChat` hook.
     * @returns null; the plugin renders into the transcript, not here.
     */
    function OverlayEntry(props) {
      const { useChat, sessionId, t, fork, fallbackCut, infoFor, sessionsOf, rowTally } = props
      const snapshot = typeof useChat === 'function' ? useChat((state) => state) : undefined
      const live = react.useRef(null)
      const [, bump] = react.useState(0)
      if (live.current === null) live.current = { snapshot: undefined, t, fork }
      const diagnose = live.current.diagnose === undefined
        ? { seen: 0, cut: 0, done: 0, errors: 0, lastKey: null, rows: 0, kinds: new Map(), compactionish: 0, cardMax: 0, stripMax: 0 }
        : live.current.diagnose
      // Peak values, not instantaneous ones: the transcript unmounts rows that
      // scroll out of view, so a live count reads zero right after it worked.
      if (typeof document !== 'undefined') {
        diagnose.cardMax = Math.max(diagnose.cardMax, document.querySelectorAll('[data-compaction-icon]').length)
        diagnose.stripMax = Math.max(diagnose.stripMax, document.querySelectorAll('[data-dsfa-compact="1"]').length)
      }
      live.current.diagnose = diagnose
      live.current.snapshot = snapshot
      live.current.t = t
      live.current.fork = fork
      live.current.fallbackCut = fallbackCut
      live.current.sessions = sessionsOf
      live.current.usageFor = typeof infoFor === 'function' ? () => infoFor().usage : null
      live.current.notify = () => bump((value) => value + 1)
      // One record, rewritten each render: version, which cut rule is loaded, and
      // what the DOM actually holds. A missing row is then readable from disk.
      let domCounts = null
      if (typeof document !== 'undefined' && document !== null) {
        const countOf = (selector) => {
          try {
            return document.querySelectorAll(selector).length
          } catch {
            return -1
          }
        }
        let painted = -1
        try {
          painted = [].slice.call(document.querySelectorAll('[data-dsfa-node-row]')).filter((element) => element.getClientRects().length > 0).length
        } catch {
          painted = -1
        }
        domCounts = {
          nodeRows: countOf('[data-dsfa-node-row]'),
          nodeRowsPainted: painted,
          compactionIcons: countOf('[data-compaction-icon]'),
          processHeaders: countOf('[data-turn-process]'),
          strips: countOf('[data-dsfa-compact="1"]'),
          promptHosts: countOf('[data-dsfa-host="1"]'),
        }
      }
      publishStatus({
        sessionId,
        cutRule: 'row-self',
        rowBuildCalls: rowTally === undefined || rowTally === null ? -1 : (rowTally.built === undefined ? 0 : rowTally.built),
        rowNodesBuilt: rowTally === undefined || rowTally === null ? -1 : (rowTally.nodes === undefined ? 0 : rowTally.nodes),
        rows: diagnose.rows,
        cards: diagnose.seen,
        strips: diagnose.done,
        errors: diagnose.errors,
        why: diagnose.why === undefined ? null : diagnose.why,
        data: diagnose.lastData === undefined ? null : diagnose.lastData,
        dom: domCounts,
      })
      try {
        globalThis.__dshForkAnywhere = {
          version: PLUGIN_VERSION,
          rows: diagnose.rows,
          cards: diagnose.seen,
          strips: diagnose.done,
          errors: diagnose.errors,
          why: diagnose.why === undefined ? null : diagnose.why,
          data: diagnose.lastData === undefined ? null : diagnose.lastData,
          at: Date.now(),
        }
      } catch {
        /* a diagnostic must never break the seat */
      }
      react.useEffect(() => {
        const reconciler = createReconciler({ sessionId, live: live.current, doc: document })
        reconciler.start()
        return () => reconciler.stop()
      }, [sessionId])
      if (diagnose.seen > 0 && diagnose.done === 0 && diagnose.vendorRow !== true) {
        return react.createElement('div', {
          style: { fontSize: '11px', lineHeight: '15px', opacity: 0.7, paddingLeft: '6px', fontFamily: 'ui-monospace, monospace' },
        }, 'fork-anywhere v' + PLUGIN_VERSION + ' · 压缩卡片 ' + diagnose.seen + ' · 动作 0 · ' + (diagnose.why === undefined ? '?' : diagnose.why) + ' · ' + (diagnose.lastData === undefined ? '-' : String(diagnose.lastData).slice(0, 32)))
      }
      return null
    }

    // --- compaction row -------------------------------------------------------
    //
    // The row hangs off the compaction card itself: the card is the thing the user
    // is looking at, so a row inserted right after it is visible exactly when the
    // card is. A separate transcript node would depend on the card's Turn/group
    // placement, and a card folded into a Turn's process group takes any row with
    // it when the group collapses.

    // --- plugin ---------------------------------------------------------------

    /**
     * Browser plugin body: install styles, register the dictionaries, and mount
     * one overlay seat on `conversation.input.overlay`. Disposal removes every
     * node this plugin owns.
     * @param ctx - client cordis context.
     */
    function apply(ctx) {
      // Feature 1's fork must land on `compaction/end` exactly; the platform's own
      // `forkAt` cannot express that, so the vendored row calls this instead.
      globalThis.__dsfaForkAtCompaction = (sessionId, atSeq) =>
        forkSessionAt(ctx, translateFallback, sessionId, atSeq)

      injectStyles()
      // Load-time beacon: console + a DOM attribute, so a stale page is one glance
      // away instead of an argument.
      try {
        if (typeof document !== 'undefined' && document.documentElement !== null) document.documentElement.setAttribute('data-dsfa-version', PLUGIN_VERSION)
        console.info('[dsh-fork-anywhere] client v' + PLUGIN_VERSION)
      } catch {
        /* a diagnostics aid must never be the reason apply fails */
      }
      const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
      const slots = typeof ctx.get === 'function' ? ctx.get('slots') : undefined
      const t = translator(locale)
      const fork = (sessionId, atSeq, context) => forkSessionAt(ctx, t, sessionId, atSeq, context)

      const disposers = []
      if (locale !== null && locale !== undefined && typeof locale.register === 'function') {
        try {
          disposers.push(locale.register(NS, dictionaries))
        } catch (error) {
          console.warn('[dsh-fork-anywhere] locale registration failed:', error)
        }
      }
      try {
        globalThis.__dshForkAnywhere = {
          version: PLUGIN_VERSION,
          rows: 0,
          cards: 0,
          strips: 0,
          errors: 0,
          why: null,
          data: null,
          at: Date.now(),
          /**
           * What this page actually holds. One call in the DevTools console answers
           * "is it loaded, is there a card, is there a row" without a screenshot.
           * @returns counts of the markers this plugin keys on.
           */
          scan() {
            const count = (selector) => (typeof document === 'undefined' ? 0 : document.querySelectorAll(selector).length)
            return {
              build: PLUGIN_VERSION,
              flow: count('[data-chat-flow]'),
              cards: count('[data-compaction-icon]'),
              actionRows: count('[data-dsfa-compact="1"]'),
              promptForks: count('[data-dsfa-host="1"]'),
              processHeaders: count('[data-turn-process]'),
              reasons: count('[data-dsfa-turn]'),
            }
          },
        }
        console.info('[dsh-fork-anywhere] v' + PLUGIN_VERSION)
      } catch {
        /* diagnostics only */
      }
      publishStatus({
        loaded: true,
        feature1: 'own compaction row (dom)',
        services: {
          slots: slots !== null && slots !== undefined,
          locale: locale !== null && locale !== undefined,
          uiConversation: typeof ctx.get === 'function' && ctx.get('uiConversation') !== undefined,
        },
      })
      // Feature 1 is a transcript node: the platform places it after the event it
      // belongs to, so no DOM scanning, no observer work, no re-decoration.
      const rowTally = { built: 0, nodes: 0 }
      const conversation = typeof ctx.get === 'function' ? ctx.get('uiConversation') : undefined
      if (conversation !== null && conversation !== undefined && conversation.events !== undefined && typeof conversation.events.register === 'function') {
        try {
          disposers.push(conversation.events.register(compactionRowDefinition(rowTally)))
        } catch (error) {
          console.warn('[dsh-fork-anywhere] compaction node registration failed:', error)
        }
      }
      if (slots !== null && slots !== undefined && typeof slots.inject === 'function') {
        try {
          disposers.push(
            slots.inject('conversation.chat.node', () =>
              slots.register(
                { name: 'conversation.chat.node', key: COMPACTION_ROW_KIND, locale: NS },
                CompactionRowView,
              ),
            ),
          )
        } catch (error) {
          console.warn('[dsh-fork-anywhere] compaction row slot failed:', error)
        }
      }
      if (slots !== null && slots !== undefined && typeof slots.inject === 'function') {
        try {
          disposers.push(
            slots.inject('conversation.input.overlay', () =>
              slots.register(
                {
                  name: 'conversation.input.overlay',
                  id: 'fork-turn',
                  order: 60,
                  inject: (sessionId) => ({
                    sessionId,
                    t,
                    fork,
                    rowTally,
                    fallbackCut: () => latestCompactionCut(typeof ctx.get === 'function' ? ctx.get('sessions') : undefined, sessionId),
                    infoFor: () => latestCompactionInfo(typeof ctx.get === 'function' ? ctx.get('sessions') : undefined, sessionId),
                    sessionsOf: () => (typeof ctx.get === 'function' ? ctx.get('sessions') : undefined),
                  }),
                },
                OverlayEntry,
              ),
            ),
          )
        } catch (error) {
          console.warn('[dsh-fork-anywhere] slot registration failed:', error)
        }
      } else {
        console.warn('[dsh-fork-anywhere] slots service unavailable: the prompt fork action stays off')
      }

      ctx.effect(() => () => {
        for (let index = disposers.length - 1; index >= 0; index -= 1) {
          try {
            disposers[index]()
          } catch {
            /* already disposed */
          }
        }
        removeAll(typeof document === 'undefined' ? null : document)
        removeStyles()
        if (toastTimer !== null) {
          clearTimeout(toastTimer)
          toastTimer = null
        }
      }, 'dsh-fork-anywhere: teardown')
    }

    // `uiConversation` is a Cordis service provided by the Conversation package:
    // naming it here is what makes the runtime wait for it instead of letting this
    // plugin apply against a half-built client and silently skip its row.
    const plugin = { apply, inject: ['slots', 'locale', 'uiConversation'] }
    // Test seam: the pure pieces a Node test can drive without a browser.
    Object.defineProperty(plugin, '__dsfa', {
      value: {
        createReconciler,
        seqOfNode,
        nodeOf,
        nodeKeyOfRow,
        describeNode,
        latestCompactionCut,
        latestCompactionInfo,
        mountPointOf,
        actionMountOf,
        usageLabel,
        shortTokens,
        clockText,
        clockLabel,
        compactionRowDefinition,
        CompactionRowView,
        summaryTextOf,
        staleInputTexts,
        hideStaleInputs,
        forkedTurnNumbers,
        hideEmptyForkedTurns,
        hasShippedActions,
        disabledBranchButton,
        dirtyTurnEnds,
        decorateDirtyTurns,
        usageLabel,
        exactTokens,
        compactionCutOf,
        normalizeUsage,
        dictionaries,
        PLUGIN_VERSION,
        HOST_ATTR,
        HOST_SELECTOR,
        CSS,
      },
      enumerable: false,
    })
    return plugin
  }
