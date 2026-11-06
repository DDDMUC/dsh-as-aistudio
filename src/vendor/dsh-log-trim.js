// dsh-log-trim browser half, VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/client.js  (v0.7.4, sha256 78fedf7aa1e43df5)
// Regenerate with `npm run vendor`; test/vendor-sync.test.js fails when this is stale.
//
// The component registers its factory with the host module loader; inside this
// package the factory is called directly, so only the outer wrapper is replaced.
// The factory body is the component own code, unchanged.
export default (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')
    const { jsx, jsxs } = require('react/jsx-runtime')

    const PLUGIN_VERSION = '0.7.4'
    const ROUTE_PREFIX = '/api/dsh-log-trim'

    /** The knobs this card edits, in the order they are drawn. */
    const FIELDS = [      { key: 'enabled', label: '启用插件', hint: '关掉后不再自动裁剪', kind: 'toggle' },
      { key: 'scanOnBoot', label: '启动时扫描', hint: '启动那一刻是唯一"会话还没被打开"的窗口', kind: 'toggle' },
      {
        key: 'flattenOnBoot',
        label: '① 启动时折叠编辑痕迹',
        hint: '把 edit/rerun/delete 的载体就地落实、删掉载体与被盖住的行，再按表面重写（不可逆，有备份，校验不过不写）',
        kind: 'toggle',
      },
      {
        key: 'streamOnBoot',
        label: '② 启动时清理流式回放',
        hint: '回放记录与最终正文重复，完成之后界面不再读它，启动时一律清空（缺用量或正文含图片的行不动）。这一项不提供保留轮数',
        kind: 'toggle',
      },
      {
        key: 'losslessOnBoot',
        label: '③ 启动时清理已遮蔽事件',
        hint: '只删被 replace 盖住、界面早就不显示的行。① 跑的时候自动跳过（折叠已把它们带走）；要重编号，收益约 13%，默认关',
        kind: 'toggle',
      },
      {
        key: 'trimOnBoot',
        label: '④ 启动时裁剪窗口',
        hint: '把模型早已看不到的旧窗口切掉，切点对齐检查点保留的尾巴，模型视图不变',
        kind: 'toggle',
      },
      { key: 'keepWindows', label: '保留窗口数', hint: '只保留最后 N 个检查点窗口（最少 1，默认 2）。切点在检查点「保留的尾巴」起点，所以 1 也不会丢模型内容', min: 1, max: 50, step: 1, kind: 'number' },
      {
        key: 'minDroppableEvents',
        label: '至少要能省下',
        hint: '裁剪后日志至少少掉这么多条事件才动手（1 条 = 一条消息、一次工具调用或一条状态记录）。默认 500；设小就更容易裁，设大则只对很长的会话动手。',
        min: 0,
        max: 200000,
        step: 50,
        kind: 'number',
        suffix: '条',
      },
      { key: 'minRatio', label: '最少可丢占比', hint: '占整份日志的比例，默认 0.2（20%）', min: 0, max: 1, step: 0.05, kind: 'ratio' },
      {
        key: 'recordLedger',
        label: '记录裁剪统计',
        hint: '每次改写日志记一笔（窗口数 / 事件数 / 字节），写到 ~/.dsh/dsh-log-trim/ledger.json；dsh-session-pages 会读它显示，其它插件也能读。关掉就不记',
        kind: 'toggle',
      },
      { key: 'minBytes', label: '最小日志体积', hint: '小于它就根本不读，默认 1 MB', min: 0, max: 200, step: 1, kind: 'mb' },
      {
        key: 'backupKeep',
        label: '保留备份数',
        hint: '每个会话保留几份 .precompact 备份；0 = 一份都不留（连刚生成的那份也删，出问题就回不去了）。默认 2（一次坏写入之后仍留一份能还原的）。',
        min: 0,
        max: 10,
        step: 1,
        kind: 'number',
        suffix: '份',
      },
      { key: 'dryRun', label: '只看不写（演练）', hint: '打开后只报告，不落盘', kind: 'toggle' },
      { key: 'repairOnBoot', label: '启动时修复装不上的日志', hint: '用宿主自己的装载检查逐份验一遍；装不上的，自动用最新一份能装上的备份还原（当前文件先另存一份，验不过自动回滚）', kind: 'toggle' },
      {
        key: 'rebuildFallback',
        label: '无法无损切窗时自动重写',
        hint: '重写（rebuild）按模型看到的表面整份重建日志，是唯一"凭空造行"的路径；宿主对日志行的隐式要求（行时间、assistant 的 stream、表面第一个节点必须是受保护的 system/message）漏一个就是整份打不开。默认关：没有无损切点就跳过。手动选 mode=rebuild 仍然可用。',
        kind: 'toggle',
      },
      { key: 'requireModelUnchanged', label: '模型视图必须不变', hint: '保守开关：模型看到的内容有任何变化就不裁', kind: 'toggle' },
    ]

    const style = {
      card: { display: 'flex', flexDirection: 'column', gap: '14px' },
      lead: { margin: 0, opacity: 0.75, fontSize: '13px', lineHeight: 1.6 },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px 16px' },
      row: { display: 'flex', flexDirection: 'column', gap: '3px' },
      label: { fontSize: '12px', fontWeight: 600 },
      hint: { fontSize: '11px', opacity: 0.6, lineHeight: 1.45 },
      input: {
        width: '96px',
        boxSizing: 'border-box',
        padding: '3px 6px',
        fontSize: '13px',
        lineHeight: '20px',
        borderRadius: '5px',
        border: '1px solid var(--dsw-border, rgba(128,128,128,.35))',
        background: 'transparent',
        color: 'inherit',
      },
      inputRow: { display: 'flex', alignItems: 'center', gap: '6px' },
      suffix: { fontSize: '11px', opacity: 0.6 },
      toggleRow: { display: 'flex', alignItems: 'center', gap: '8px' },
      toggleText: { display: 'flex', flexDirection: 'column', gap: '1px' },
      bar: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      button: {
        padding: '5px 12px',
        fontSize: '13px',
        borderRadius: '6px',
        border: '1px solid var(--dsw-border, rgba(128,128,128,.35))',
        background: 'var(--dsw-surface, transparent)',
        color: 'inherit',
        cursor: 'pointer',
      },
      primary: { background: 'var(--dsw-accent, #2f6feb)', color: '#fff', borderColor: 'transparent' },
      status: { fontSize: '12px', opacity: 0.8, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
      small: { padding: '2px 8px', fontSize: '11px' },
      table: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' },
      tableRow: { display: 'grid', gridTemplateColumns: '1fr 118px 64px 118px 1fr auto', gap: '8px', alignItems: 'center' },
      cell: { opacity: 0.7 },
      mono: { fontFamily: 'ui-monospace, Menlo, monospace' },
      error: { fontSize: '12px', color: 'var(--dsw-danger, #d33)' },
    }

    /**
     * Call the plugin's own bridge.
     *
     * @param {string} path - route path after the prefix.
     * @param {object} [body] - JSON body; omitted for GET.
     * @returns {Promise<object>} the parsed answer.
     */
    async function call(path, body) {
      const response = await fetch(`${ROUTE_PREFIX}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok !== true) throw new Error(data.error ? String(data.error) : `HTTP ${response.status}`)
      return data
    }

    /** One number input bound to a config key. */
    function NumberField({ field, value, onChange }) {
      const shown = field.kind === 'ratio' ? Math.round(Number(value) * 100) : field.kind === 'mb' ? Math.round(Number(value) / 1048576) : Number(value)
      return jsxs('label', {
        style: style.row,
        children: [
          jsx('span', { style: style.label, children: field.label }),
          jsxs('span', { style: style.inputRow, children: [
          jsx('input', {
            type: 'number',
            style: style.input,
            min: field.kind === 'ratio' ? 0 : field.min,
            max: field.kind === 'ratio' ? 100 : field.max,
            step: field.kind === 'ratio' ? 1 : field.step,
            value: Number.isFinite(shown) ? String(shown) : '',
            onChange: (event) => {
              const raw = Number(event.target.value)
              if (!Number.isFinite(raw)) return
              onChange(field.kind === 'ratio' ? raw / 100 : field.kind === 'mb' ? Math.round(raw * 1048576) : raw)
            },
          }),
          field.suffix === undefined ? null : jsx('span', { style: style.suffix, children: field.suffix }),
          ] }),
          jsx('span', { style: style.hint, children: field.hint }),
        ],
      })
    }

    /** One drop-down bound to a config key. */
    function SelectField({ field, value, onChange }) {
      return jsxs('label', {
        style: style.row,
        children: [
          jsx('span', { style: style.label, children: field.label }),
          jsx('select', {
            style: { ...style.input, width: '180px' },
            value: String(value),
            onChange: (event) => onChange(event.target.value),
            children: field.options.map(([optionValue, text]) => jsx('option', { value: optionValue, children: text }, optionValue)),
          }),
          jsx('span', { style: style.hint, children: field.hint }),
        ],
      })
    }

    /** One checkbox bound to a config key. */
    function ToggleField({ field, value, onChange }) {
      return jsxs('label', {
        style: style.toggleRow,
        children: [
          jsx('input', { type: 'checkbox', checked: value === true, onChange: (event) => onChange(event.target.checked) }),
          jsxs('span', { style: style.toggleText, children: [
            jsx('span', { style: style.label, children: field.label }),
            jsx('span', { style: style.hint, children: field.hint }),
          ] }),
        ],
      })
    }

    /** The card itself. */
    function CompactCard() {
      const [config, setConfig] = react.useState(null)
      const [draft, setDraft] = react.useState(null)
      const [savedDefaults, setSavedDefaults] = react.useState(null)
      const [status, setStatus] = react.useState(null)
      const [busy, setBusy] = react.useState('')
      const [backups, setBackups] = react.useState(null)
      const [backupInfo, setBackupInfo] = react.useState(null)
      const [legacy, setLegacy] = react.useState(null)
      const [error, setError] = react.useState('')
      const [note, setNote] = react.useState('')

      react.useEffect(() => {
        let live = true
        void (async () => {
          try {
            const data = await call('/backups')
            if (live) {
              setBackups(Array.isArray(data.backups) ? data.backups : [])
              setBackupInfo({ sessionsRoot: data.sessionsRoot, total: data.total, bytes: data.bytes })
            }
          } catch {
            // 备份读不到不影响改设置
          }
          try {
            const data = await call('/config')
            if (!live) return
            setConfig(data.config)
            setDraft(data.config)
            setSavedDefaults(data.defaults)
          } catch (failure) {
            if (live) setError(String(failure.message || failure))
          }
          try {
            const data = await call('/legacy')
            if (live) setLegacy({ files: data.files, bytes: data.bytes })
          } catch {
            // 旧格式统计读不到不影响改设置
          }
          try {
            const data = await call('/status')
            if (live) setStatus(data)
          } catch {
            // 状态读不到不影响改设置
          }
        })()
        return () => {
          live = false
        }
      }, [])

      const loadBackups = async () => {
        try {
          const data = await call('/backups')
          setBackups(Array.isArray(data.backups) ? data.backups : [])
          setBackupInfo({ sessionsRoot: data.sessionsRoot, total: data.total, bytes: data.bytes })
        } catch (failure) {
          setBackupInfo({ error: String(failure.message || failure) })
        }
      }

      const loadLegacy = async () => {
        try {
          const data = await call('/legacy')
          setLegacy({ files: data.files, bytes: data.bytes })
        } catch {
          setLegacy(null)
        }
      }

      const cleanupLegacy = async () => {
        setBusy('legacy')
        setError('')
        setNote('')
        try {
          const data = await call('/legacy', { confirm: true })
          setNote(`清理了 ${data.removed} 个旧格式日志，释放 ${(data.bytes / 1048576).toFixed(1)} MB`)
          void loadLegacy()
        } catch (failure) {
          setError(String(failure.message || failure))
        } finally {
          setBusy('')
        }
      }

      const reveal = async (target) => {
        try {
          await call('/reveal', { path: target })
        } catch (failure) {
          setError(String(failure.message || failure))
        }
      }

      const set = (key, value) => {
        setDraft((previous) => (previous === null ? previous : { ...previous, [key]: value }))
        setNote('')
      }

      const save = async () => {
        if (draft === null) return
        setBusy('save')
        setError('')
        setNote('')
        try {
          const patch = {}
          for (const field of FIELDS) patch[field.key] = draft[field.key]
          const data = await call('/config', patch)
          setConfig(data.config)
          setDraft(data.config)
          setNote(data.saved ? '已保存，下一次扫描起生效' : '已生效，但没能写到磁盘（下次启动会回到配置里的初始值）')
        } catch (failure) {
          setError(String(failure.message || failure))
        } finally {
          setBusy('')
        }
      }

      const scan = async () => {
        setBusy('scan')
        setError('')
        setNote('')
        try {
          const data = await call('/run', {})
          if (data.started === false) setNote('已经在扫了，等它跑完…')
          // 扫描在后台跑：轮询 /status，直到 running 变回 false。
          let last = data.result || null
          for (let attempt = 0; attempt < 240; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 500))
            const state = await call('/status')
            setStatus(state)
            if (state.error) {
              setError(`扫描失败：${state.error}`)
              return
            }
            if (state.running !== true) {
              last = state.last || last
              break
            }
          }
          const scanned = last || {}
          setNote(`扫了 ${scanned.scanned || 0} 个会话：裁 ${(scanned.trimmed || []).length}，跳过 ${(scanned.skipped || []).length}，失败 ${(scanned.failed || []).length}`)
          void loadBackups()
        } catch (failure) {
          setError(String(failure.message || failure))
        } finally {
          setBusy('')
        }
      }

      const reset = () => {
        if (savedDefaults === null) return
        setDraft({ ...savedDefaults })
        setNote('已填回默认值，点「保存」才生效')
      }

      if (draft === null) {
        return jsx('p', { style: style.lead, children: error === '' ? '正在读取设置…' : `读取设置失败：${error}` })
      }

      /** 备份列表：路径、大小、时间，每行一个「打开目录」。 */
      const renderBackups = () => {
        const restoreBackup = async (row) => {
          const label = row.title === undefined || row.title === '' ? row.sessionId : row.title
          if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            const ok = window.confirm(`用这份备份还原「${label}」？\n\n当前日志会先另存成一份新备份，再把备份复制回来；校验不过会自动回滚。`)
            if (!ok) return
          }
          try {
            await call('/restore', { sessionId: row.sessionId, backup: row.path })
            await loadBackups()
          } catch (error) {
            setBackupInfo({ ...(backupInfo || {}), error: error instanceof Error ? error.message : String(error) })
          }
        }

        const rows = (backups || []).slice(0, 8)
        const sizeText = (bytes) => `${(Number(bytes || 0) / 1048576).toFixed(1)} MB`
        const when = (mtime) => {
          const date = new Date(Number(mtime || 0))
          if (!Number.isFinite(date.getTime())) return ''
          const pad = (n) => String(n).padStart(2, '0')
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
        }
        return jsxs('div', {
          style: style.card,
          children: [
            jsxs('div', { style: style.bar, children: [
              jsx('span', { style: style.label, children: '备份' }),
              jsx('span', {
                style: style.hint,
                children: backupInfo === null
                  ? '读取中…'
                  : backupInfo.error !== undefined
                    ? `读取失败：${backupInfo.error}`
                    : `共 ${backupInfo.total} 份，${sizeText(backupInfo.bytes)}；${backupInfo.sessionsRoot}`,
              }),
              jsx('button', { type: 'button', style: { ...style.button, ...style.small }, onClick: () => void loadBackups(), children: '刷新' }),
              backupInfo !== null && backupInfo.sessionsRoot !== undefined
                ? jsx('button', { type: 'button', style: { ...style.button, ...style.small }, onClick: () => void reveal(backupInfo.sessionsRoot), children: '打开会话目录' })
                : null,
            ] }),
            rows.length === 0
              ? jsx('span', { style: style.hint, children: '还没有备份（每次裁剪都会把原文件改名成 <日志>.precompact-<时间戳> 留在它旁边）' })
              : jsxs('div', {
                  style: style.table,
                  children: rows.map((row) => jsxs('div', {
                    style: style.tableRow,
                    children: [
                      // 会话标题在前：备份是"哪个对话的"，比一串 id 有用；id 缩在后面。
                      jsx('span', {
                        style: { ...style.cell, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                        title: row.title === '' ? row.sessionId : `${row.title}\n${row.sessionId}`,
                        children: row.title === '' ? row.sessionId.slice(0, 26) : row.title,
                      }),
                      jsx('span', { style: { ...style.mono, opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: row.sessionId, children: row.sessionId.slice(0, 14) }),
                      jsx('span', { style: style.cell, children: sizeText(row.bytes) }),
                      jsx('span', { style: style.cell, children: when(row.mtime) }),
                      jsx('span', { style: { ...style.mono, opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: row.path, children: row.dir }),
                      jsx('button', { type: 'button', style: { ...style.button, ...style.small }, onClick: () => void restoreBackup(row), title: '把这份备份放回去（当前日志先另存一份）', children: '还原' }),
                      jsx('button', { type: 'button', style: { ...style.button, ...style.small }, onClick: () => void reveal(row.dir), children: '打开目录' }),
                    ],
                  }, row.path)),
                }),
          ],
        })
      }

      const last = status === null ? null : status.last
      const lastLine =
        last === null || last === undefined
          ? '还没有扫描记录（重启 DSH 或点「现在扫一遍」）'
          : `${last.startedAt || ''}  扫 ${last.scanned || 0} 个会话：裁 ${(last.trimmed || []).length}，跳过 ${(last.skipped || []).length}，失败 ${(last.failed || []).length}  省 ${(((last.savedBytes || 0) / 1048576) || 0).toFixed(1)} MB（${last.ms || 0} ms${last.dryRun ? '，演练' : ''}）`

      return jsxs('div', {
        style: style.card,
        children: [
          jsxs('p', {
            style: style.lead,
            children: [
              '长会话的日志只增不减，而宿主的压缩是累积的 —— 更早的窗口模型早已看不到，却还压在日志里。这里决定它什么时候把那些窗口切掉。',
              jsx('br', {}),
              `版本 ${PLUGIN_VERSION}；设置在 ~/.dsh/dsh-log-trim/config.json，配置文件里的那一行只是初始值。`,
            ],
          }),
          status !== null && status !== undefined && status.duplicateStudio === true
            ? jsx('p', {
                style: { ...style.status, color: 'var(--dsw-alias-state-warning-primary, #d98b00)' },
                children: '检测到同时安装了 dsh-as-aistudio（它内置了本插件）：两份会各跑一次启动扫描，建议在插件列表里只保留一份。',
              })
            : null,
          jsx('div', {
            style: style.grid,
            children: FIELDS.filter((field) => field.kind === 'select').map((field) =>
              jsx(SelectField, { field, value: draft[field.key], onChange: (value) => set(field.key, value) }, field.key)),
          }),
          jsx('div', {
            style: style.grid,
            children: FIELDS.filter((field) => field.kind === 'number' || field.kind === 'ratio' || field.kind === 'mb').map((field) =>
              jsx(NumberField, { field, value: draft[field.key], onChange: (value) => set(field.key, value) }, field.key)),
          }),
          jsxs('div', {
            style: style.card,
            children: FIELDS.filter((field) => field.kind === 'toggle').map((field) =>
              jsx(ToggleField, { field, value: draft[field.key], onChange: (value) => set(field.key, value) }, field.key)),
          }),
          jsxs('div', {
            style: style.bar,
            children: [
              jsx('button', { type: 'button', style: { ...style.button, ...style.primary }, onClick: save, disabled: busy !== '', children: busy === 'save' ? '保存中…' : '保存' }),
              jsx('button', { type: 'button', style: style.button, onClick: scan, disabled: busy !== '', children: busy === 'scan' ? '扫描中…' : '现在扫一遍' }),
              jsx('button', { type: 'button', style: style.button, onClick: reset, disabled: busy !== '', children: '填回默认值' }),
            ],
          }),
          note === '' ? null : jsx('div', { style: style.status, children: note }),
          renderBackups(),
          jsxs('div', { style: style.bar, children: [
            jsx('span', { style: style.label, children: '旧格式日志' }),
            jsx('span', {
              style: style.hint,
              children: legacy === null
                ? '读取中…'
                : legacy.files === 0
                  ? '没有（宿主只读当前格式，旧格式日志永远不会被再次读取）'
                  : `${legacy.files} 个，${(legacy.bytes / 1048576).toFixed(1)} MB —— 宿主只读当前格式，这部分是纯占用`,
            }),
            legacy !== null && legacy.files > 0
              ? jsx('button', { type: 'button', style: { ...style.button, ...style.small }, disabled: busy !== '', onClick: cleanupLegacy, children: busy === 'legacy' ? '清理中…' : '清理旧格式日志' })
              : null,
          ] }),
          error === '' ? null : jsx('div', { style: style.error, children: `出错：${error}` }),
          jsx('div', { style: style.status, children: lastLine }),
        ],
      })
    }

    /** The one-liner the plugin row shows while the page is closed. */
    function summaryText() {
      return '日志裁剪：启动时把超过窗口数的旧日志切掉（保留备份、先验后写）'
    }

    /**
     * Register the card where free-search puts its own.
     *
     * @param {object} ctx - the client plugin context.
     */
    function apply(ctx) {
      const render = (slotProps) =>
        slotProps && slotProps.view === 'summary' ? summaryText() : jsx(CompactCard, { page: true })
      ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-log-trim' }, render))
    }

    exports.apply = apply
    exports.inject = ['slots']
    exports.ConfigCard = CompactCard
    exports.PLUGIN_VERSION = PLUGIN_VERSION
    return module.exports
  }
