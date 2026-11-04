// dsh-log-trim host half (dsh-log-trim.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/index.js  (v0.6.0, sha256 1ef6710b85f69330)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * dsh-log-trim —— 启动时自动裁掉空闲会话的历史窗口。
 *
 * ## 为什么需要它
 *
 * 宿主的压缩是**累积**的：每个检查点覆盖前一个，所以更早的窗口对模型早已不可见，
 * 却还压在日志里、还显示在对话区。实测一个会话能涨到 13 MB，裁掉前 7 窗后剩 4.8 MB
 * 而**模型看到的内容完全不变**。
 *
 * 但这件事有个绕不开的时间窗：宿主只要打开过某个会话（侧栏点开、标签页恢复），就会
 * 持有它的 `session.lock` 直到进程退出，此时改文件会被随后的写入覆盖。而"宿主刚启动、
 * 会话还没被打开"是唯一稳定可用的窗口——所以这个插件在**启动时**扫一遍。
 *
 * ## 安全措施
 *
 * - 被持有的会话一律跳过（`session.lock` 被打开）；
 * - 达到阈值才裁（可丢弃事件数、占比，以及"模型视图必须完全不变"）；
 * - **先验后写**：裁剪结果要先过宿主自己的三层校验器（格式层 / 会话层 / 投影层），
 *   任何一项不过就删掉暂存文件、原文件一个字节都不动；
 * - 原文件改名成 `<日志>.precompact-<时间戳>` 保留，可随时改回；
 * - `dryRun` 只报告不落盘。
 *
 * 路由（仅本机）：
 *   GET  /api/dsh-log-trim/status   上次扫描结果 + 生效配置
 *   POST /api/dsh-log-trim/run      立刻再扫一遍（返回本次摘要）
 */

import { spawn as spawnChild } from 'node:child_process'
import { discoverRoots, isCurrentLog, listLegacy } from './dsh-log-trim.roots.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyTrim, foldSurface, isSessionLocked, keepLastWindows, readLog, renumber, windowsOf } from './dsh-log-trim.vendor.compact-session.mjs'
import { applyFlatten, applyLossless, applyStreamOnly, planLossless, applyRebuild } from './dsh-log-trim.lossless.js'
import { readLedger, recordFor } from './dsh-log-trim.ledger.js'

export const name = 'dsh-log-trim'
export const PLUGIN_ID = name
export const PLUGIN_VERSION = '0.6.0'
export const ROUTE_PREFIX = '/api/dsh-log-trim'

/**
 * Where the per-file verdicts are remembered.
 *
 * A boot scan reads every candidate log (19 of them are over a megabyte, and
 * decoding one costs one to two seconds), so the second boot used to spend half a
 * minute re-deciding what it had already decided. The verdict is remembered per
 * file keyed by its size and mtime: a log that has not moved cannot have gained a
 * window, and a trimmed log's mtime changes, so it is looked at again.
 */
const MEMORY_FILE = 'dsh-log-trim/scan-memory.json'
const LEGACY_MEMORY_FILE = 'dsh-session-compact/scan-memory.json'

/** Where the settings card's values are kept. */
const CONFIG_FILE = 'dsh-log-trim/config.json'
/** 重命名前的目录，只读兜底。 */
const LEGACY_CONFIG_FILE = 'dsh-session-compact/config.json'

/**
 * The settings the card has saved, on top of whatever the patch declares.
 *
 * The patch block is a row's INITIAL value: a fresh install is configured there,
 * a running one through the card. The file wins so a save survives a restart even
 * though the patch is never rewritten.
 *
 * @returns {object} the saved values (partial, unknown keys dropped later).
 */
export function readSavedConfig() {
  // The plugin used to be called dsh-session-compact, and that name read as
  // "compacts the context" - which is a different thing entirely. Values saved
  // under the old directory are still honoured so a rename costs nobody their
  // settings, but new saves go to the new path only.
  for (const relative of [CONFIG_FILE, LEGACY_CONFIG_FILE]) {
    try {
      const file = path.join(os.homedir(), '.dsh', relative)
      if (!fs.existsSync(file)) continue
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      // 换下一个候选
    }
  }
  return {}
}

/**
 * Persist the settings card's values.
 *
 * @param {object} config - the full resolved config to remember.
 * @returns {boolean} whether it was written.
 */
export function writeSavedConfig(config) {
  try {
    const file = path.join(os.homedir(), '.dsh', CONFIG_FILE)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const kept = {}
    for (const key of Object.keys(DEFAULTS)) kept[key] = config[key]
    fs.writeFileSync(file, `${JSON.stringify(kept, null, 2)}\n`)
    return true
  } catch {
    return false
  }
}

/**
 * Trim one session on demand, with the same guard rails the boot scan uses:
 * a held session is refused, the result is verified, the original is kept as a
 * backup.
 *
 * @param {string} logFile - the session's log.
 * @param {number} keepWindows - how many windows to keep.
 * @param {number} backupKeep - how many backups to keep afterwards.
 * @returns {Promise<object>} what happened.
 */

/**
 * 窗口裁剪写完之后记一笔账：窗口数、事件数、字节数都来自这次操作本身。
 *
 * @param {string} logFile - 日志路径。
 * @param {object} result - `applyTrim` 的返回。
 * @param {boolean} record - 是否记录（配置项）。
 */
function noteWindowTrim(logFile, result, record) {
  if (record === false) return
  try {
    let windowsAfter = null
    try {
      windowsAfter = windowsOf(readLog(logFile).events).length
    } catch {
      windowsAfter = null
    }
    recordFor(logFile, 'window', [], [], {
      windowsBefore: result?.before?.windows,
      windowsAfter: windowsAfter === null ? undefined : windowsAfter,
      eventsBefore: result?.before?.events,
      eventsAfter: result?.after?.events,
      bytesBefore: result?.before?.bytes,
      bytesAfter: result?.after?.bytes,
    })
  } catch {
    // 记账失败不影响裁剪本身。
  }
}

export async function trimOne(logFile, config) {
  if (isSessionLocked(logFile)) {
    throw new Error('这个会话正被宿主打开着（session.lock）。先切到别的对话或重启 DSH，再压缩它')
  }
  const before = fs.statSync(logFile).size
  let result
  if (config.mode === 'rebuild') {
    result = await applyRebuild(logFile, config)
  } else if (config.mode === 'flatten') {
    result = await applyFlatten(logFile, config)
  } else if (config.mode === 'window') {
    result = await applyTrim(logFile, config.keepWindows, { streamKeepTurns: 0 })
    noteWindowTrim(logFile, result, config.recordLedger)
  } else {
    const plan = planLossless(logFile, config)
    if (!plan.should) throw new Error(plan.reason)
    result = await applyLossless(logFile, config, plan)
  }
  const pruned = pruneBackups(logFile, config.backupKeep)
  return {
    sessionId: path.basename(path.dirname(logFile)),
    mode: config.mode,
    before: { events: result.before.events, bytes: before, windows: result.before.windows ?? 0 },
    after: { events: result.after.events, bytes: result.after.bytes },
    dropped: result.dropped,
    model: result.model,
    backup: path.basename(result.backup),
    prunedBackups: pruned,
  }
}

/**
 * The log file of one session id under a sessions root.
 *
 * @param {string} root - sessions root.
 * @param {string} sessionId - the session id.
 * @returns {string|null} the log path, or null.
 */
export function logFileOf(root, sessionId) {
  if (typeof sessionId !== 'string' || !/^session-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sessionId)) return null
  for (const logFile of discoverRoots(root).flatMap((entry) => listLogs(entry))) {
    if (path.basename(path.dirname(logFile)) === sessionId) return logFile
  }
  return null
}

/**
 * The command that opens a directory in the system file manager.
 *
 * A pure function so it can be tested; the same three-way split `dsh-preset-
 * workbench` uses for its 【打开目录】.
 *
 * @param {string} platform - process.platform.
 * @param {string} dir - absolute directory.
 * @returns {{ command: string, args: string[] }} plan.
 */
export function folderOpenPlan(platform, dir) {
  const target = String(dir || '')
  if (target === '') throw new Error('目录为空')
  if (platform === 'win32') return { command: 'explorer.exe', args: [target] }
  if (platform === 'darwin') return { command: 'open', args: [target] }
  return { command: 'xdg-open', args: [target] }
}

/**
 * Open one directory in the platform's file manager.
 *
 * Goes straight to `node:child_process` rather than the host's subprocess
 * service: that service adds `windowsHide`, and `explorer.exe` is a GUI process -
 * the window opens hidden and the user sees "nothing happened". One-shot,
 * detached, no stdio: `explorer` is long-lived, so waiting on it never returns.
 *
 * @param {string} dir - absolute directory.
 * @returns {{ opened: boolean, dir: string }} what was launched.
 */
export function openDirectory(dir) {
  const plan = folderOpenPlan(process.platform, dir)
  const child = spawnChild(plan.command, plan.args, { detached: true, stdio: 'ignore' })
  if (child && typeof child.on === 'function') child.on('error', () => {})
  if (child && typeof child.unref === 'function') child.unref()
  return { opened: true, dir }
}

/**
 * Every `.precompact-*` backup under a sessions root, newest first.
 *
 * @param {string} root - sessions root.
 * @param {number} [limit] - how many to return.
 * @returns {{ backups: object[], total: number, bytes: number }} the list and its totals.
 */
/**
 * The `.precompact-` backups that sit beside one log, newest first.
 *
 * @param {string} logFile - the session's log.
 * @returns {string[]} absolute backup paths.
 */
export function backupsOf(logFile) {
  const dir = path.dirname(logFile)
  const prefix = path.basename(logFile) + '.precompact-'
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.startsWith(prefix))
      .map((name) => path.join(dir, name))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
  } catch {
    return []
  }
}

/**
 * Put a backup back, keeping the current file as a backup of its own.
 *
 * Order matters: the current log is copied aside FIRST, so a crash leaves two
 * complete files instead of none. The restored file is then verified with the
 * host's own checks (including a real `Session` construction); if that fails the
 * copy is undone and the original stays exactly where it was.
 *
 * @param {string} logFile - the session's live log.
 * @param {string} backupPath - a `.precompact-` sibling.
 * @param {object} config - the resolved config (for backup retention).
 * @returns {Promise<{ok: boolean, safety?: string, error?: string}>} the outcome.
 */
export async function restoreFromBackup(logFile, backupPath, config) {
  const dir = path.dirname(logFile)
  if (path.dirname(backupPath) !== dir || !path.basename(backupPath).startsWith(path.basename(logFile) + '.precompact-')) {
    return { ok: false, error: '这个备份不属于该会话' }
  }
  if (!fs.existsSync(backupPath)) return { ok: false, error: '备份文件已经不在' }
  const { verifyLog } = await import('./dsh-log-trim.vendor.verify-session-log.mjs')
  const backupCheck = await verifyLog(backupPath)
  if (!backupCheck.ok) {
    const failed = (backupCheck.checks || []).filter((check) => !check.ok).slice(0, 2)
    return { ok: false, error: '这份备份自己就不合格：' + failed.map((check) => check.name + '：' + check.detail).join('；') }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safety = logFile + '.precompact-' + stamp
  fs.copyFileSync(logFile, safety)
  fs.copyFileSync(backupPath, logFile)
  const restored = await verifyLog(logFile)
  if (!restored.ok) {
    fs.copyFileSync(safety, logFile)
    return { ok: false, error: '还原后的日志没通过校验，已回滚' }
  }
  pruneBackups(logFile, config.backupKeep)
  return { ok: true, safety: path.basename(safety) }
}

/**
 * Repair one log at boot if the host would refuse to load it.
 *
 * The checks run the loader itself (a real `Session` construction), so "the
 * verifier said yes" and "the host can open it" are the same answer. The newest
 * backup that verifies is restored; nothing else is touched.
 *
 * @param {string} logFile - the session's log.
 * @param {object} config - the resolved config.
 * @returns {Promise<object|null>} a repaired record, or null when nothing was wrong.
 */
export async function repairIfCorrupt(logFile, config) {
  const { verifyLog } = await import('./dsh-log-trim.vendor.verify-session-log.mjs')
  let failed
  try {
    failed = await verifyLog(logFile)
  } catch (error) {
    failed = { ok: false, checks: [{ name: '校验器', ok: false, detail: error instanceof Error ? error.message : String(error) }] }
  }
  if (failed.ok) return null
  const detail = (failed.checks || []).filter((check) => !check.ok).map((check) => check.name + '：' + check.detail).slice(0, 2).join('；')
  for (const backup of backupsOf(logFile)) {
    const result = await restoreFromBackup(logFile, backup, config)
    if (result.ok) {
      return {
        sessionId: path.basename(path.dirname(logFile)),
        reason: detail,
        backup: path.basename(backup),
        safety: result.safety,
      }
    }
  }
  return { sessionId: path.basename(path.dirname(logFile)), reason: detail, failed: true }
}

export function listBackups(root, limit = 40) {
  const found = []
  let total = 0
  let bytes = 0
  for (const logFile of discoverRoots(root).flatMap((entry) => listLogs(entry))) {
    const dir = path.dirname(logFile)
    const prefix = `${path.basename(logFile)}.precompact-`
    let names = []
    try {
      names = fs.readdirSync(dir).filter((name) => name.startsWith(prefix))
    } catch {
      continue
    }
    for (const name of names) {
      const full = path.join(dir, name)
      let stat
      try {
        stat = fs.statSync(full)
      } catch {
        continue
      }
      total += 1
      bytes += stat.size
      found.push({
        sessionId: path.basename(dir),
        name,
        path: full,
        dir,
        bytes: stat.size,
        mtime: stat.mtimeMs,
      })
    }
  }
  found.sort((a, b) => b.mtime - a.mtime)
  return { backups: found.slice(0, limit), total, bytes }
}

/**
 * Ask the host to let go of a session it has open.
 *
 * The log is single-writer: the write handle is held until the DSH process exits,
 * so a session the user has open can never be trimmed. The seam is
 * `sessions.store.get(id).detach()` — the same one `dsh-session-relocate` and
 * `dsh-delete-session` use in production. It dispatches `session/disposed`, the
 * persistence layer closes the handle, and the lock goes away **asynchronously**,
 * so the release is confirmed with a write-ownership probe instead of guessed.
 *
 * Only ever called for a session the user explicitly asked to trim: detaching a
 * session that is mid-answer would interrupt the answer.
 *
 * @param {object} ctx - plugin context.
 * @param {string} sessionId - the session to release.
 * @param {{ retries?: number, delayMs?: number }} [options] - probe budget.
 * @returns {Promise<{ released: boolean, detail: string, attempts: number }>} what happened.
 */
export async function releaseSession(ctx, sessionId, options = {}) {
  const retries = Number.isSafeInteger(options.retries) ? options.retries : 12
  const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 150
  const sessions = ctx.get('sessions')
  if (sessions === undefined || sessions === null || typeof sessions.get !== 'function') {
    return { released: true, detail: '没有 sessions 服务，视为无需释放', attempts: 0 }
  }
  const live = sessions.get(sessionId)
  if (live === undefined || live === null) return { released: true, detail: '本来就不在内存里', attempts: 0 }
  if (typeof sessions.flush === 'function') {
    try {
      await sessions.flush(live)
    } catch {
      // 释放前 flush 失败不该拦住释放
    }
  }
  const store = sessions.store
  const entered = store !== undefined && typeof store.get === 'function' ? store.get(sessionId) : undefined
  if (entered === undefined || typeof entered.detach !== 'function') {
    return { released: false, detail: '拿不到可释放的记录（DSH 版本可能变了）', attempts: 0 }
  }
  entered.detach()

  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || persistence === null || typeof persistence.open !== 'function') {
    return { released: true, detail: '已从内存摘除（没有持久层可探测）', attempts: 0 }
  }
  const quick = [0, 10, 25, 50, 100]
  let last = 'unknown'
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const handle = await persistence.open(sessionId, 'write')
      try {
        await handle.close()
      } catch {
        // 探针句柄关不掉不影响结论
      }
      return { released: true, detail: `写租约已释放（第 ${attempt + 1} 次探测成功）`, attempts: attempt + 1 }
    } catch (error) {
      last = String(error && error.message !== undefined ? error.message : error)
      const wait = attempt < quick.length ? quick[attempt] : delayMs
      if (wait > 0 && attempt < retries) await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
  return { released: false, detail: `写所有权仍被占用（试了 ${retries + 1} 次）：${last}`, attempts: retries + 1 }
}

/** 默认配置。 */
export const DEFAULTS = {
  enabled: true,
  scanOnBoot: true,
  repairOnBoot: true,
  keepWindows: 2,
  minDroppableEvents: 500,
  minBytes: 1048576,
  minRatio: 0.2,
  requireModelUnchanged: true,
  dryRun: false,
  backupKeep: 2,
  // 旧回合的流式回放记录（与 data.message 逐块重复）只留最近几轮，其余删掉。
  // 启动时为所有空闲日志清一次旧回合的流式回放（与是否裁窗口无关）。
  streamOnBoot: true,
  // 每次扫描先把 edit/rerun/delete 的载体折叠掉（重启即自动执行）。
  flattenOnBoot: false,
  // 每次改写过日志就记一笔统计（账本文件，别的插件可读）；关掉就不记。
  recordLedger: true,
  // 启动时是否裁剪窗口（关掉就只剩折叠/清理）。
  trimOnBoot: true,
  // 只在开启时清理“已被 replace 盖住、界面早就不显示”的事件（要重编号，默认关）。
  losslessOnBoot: false,
  // 只扫 sessionsRoot，不追加默认根目录（测试/隔离用）。
  isolateRoots: false,
  mode: 'window',
  // 没有无损切点时是否自动改用 rebuild（按可见表面整份重写）。
  //
  // 默认关。rebuild 是唯一"凭空造行"的路径，宿主对日志行的隐式契约（time、
  // assistant 的 stream、表面第一个节点必须是受保护的 system/message……）都得
  // 靠它一一照抄，漏一个就是整份日志打不开——实测已经毁过三个会话，而且症状是
  // 事后才出现（能跑一阵子，等 App 重发系统提示词那一刻才炸）。省下的那点字节
  // 不值得。`mode: 'rebuild'` 仍然可用，那是显式选择。
  rebuildFallback: false,
  sessionsRoot: '',
}

/**
 * 合并用户配置。
 *
 * @param {object} raw - 用户配置。
 * @returns {object} 生效配置。
 */

/**
 * 这台机器上有没有装 ai-studio 系（聚合包或那三个会写载体的插件）。
 *
 * 只看 profile 的 `package.json`：聚合包与三个组件都出现在
 * `dsh.profile.bundles` 或 `dependencies` 里，读文件即可，不需要联网也不需要
 * 宿主提供插件清单接口。
 *
 * @param {string} [home] - 家目录（测试用）。
 * @returns {boolean} 装了就是 true；任何异常都当作没装。
 */
export function hasAggregatedWriters(home = os.homedir()) {
  const markers = ['dsh-as-aistudio', 'dsh-edit-turn', 'dsh-rerun-turn', 'dsh-delete-turn']
  const profiles = path.join(home, '.dsh', 'profiles')
  let names = []
  try {
    names = fs.readdirSync(profiles)
  } catch {
    return false
  }
  for (const name of names) {
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(profiles, name, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    const bundles = manifest?.dsh?.profile?.bundles
    const deps = manifest?.dependencies ?? {}
    const all = [...(Array.isArray(bundles) ? bundles : []), ...Object.keys(deps)]
    if (markers.some((marker) => all.includes(marker))) return true
  }
  return false
}

export function resolveConfig(raw = {}) {
  const merged = { ...DEFAULTS }
  // 装了 ai-studio 系（edit/rerun/delete）就意味着日志里会持续出现载体：
  // 没有显式设置过 flattenOnBoot 时，默认打开“启动时折叠”，否则痕迹会一直堆着。
  if (raw.flattenOnBoot === undefined || raw.flattenOnBoot === null) {
    merged.flattenOnBoot = hasAggregatedWriters()
  }
  for (const key of Object.keys(DEFAULTS)) {
    const value = raw[key]
    if (value === undefined || value === null) continue
    if (key === 'minBytes') {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) merged[key] = value
      continue
    }
    if (key === 'streamOnBoot') {
      if (typeof value === 'boolean') merged.streamOnBoot = value
      continue
    }
    if (key === 'recordLedger') {
      if (typeof value === 'boolean') merged.recordLedger = value
      continue
    }
    if (key === 'losslessOnBoot') {
      if (typeof value === 'boolean') merged.losslessOnBoot = value
      continue
    }
    if (key === 'trimOnBoot') {
      if (typeof value === 'boolean') merged.trimOnBoot = value
      continue
    }
    if (key === 'isolateRoots') {
      if (typeof value === 'boolean') merged.isolateRoots = value
      continue
    }
    if (key === 'flattenOnBoot') {
      if (typeof value === 'boolean') merged.flattenOnBoot = value
      continue
    }
    if (key === 'mode') {
      if (value === 'lossless' || value === 'window' || value === 'rebuild' || value === 'flatten') merged.mode = value
      continue
    }
    if (key === 'keepWindows') {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 1) merged.keepWindows = Math.floor(value)
      continue
    }
    if (key === 'sessionsRoot') {
      if (typeof value === 'string') merged.sessionsRoot = value
      continue
    }
    if (typeof value === 'boolean') merged[key] = value
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) merged[key] = value
  }
  if (merged.sessionsRoot === '') merged.sessionsRoot = path.join(os.homedir(), '.dsh', 'sessions')
  return merged
}

/**
 * 判断一个会话该不该裁（纯函数，便于测试）。
 *
 * @param {{ events: number, windows: number, droppable: number, modelBefore: number, modelAfter: number }} report - 试算结果。
 * @param {object} config - 生效配置。
 * @returns {{ should: boolean, reason: string }} 结论与理由。
 */
export function planTrim(report, config) {
  if (report.windows <= config.keepWindows) return { should: false, reason: `只有 ${report.windows} 个窗口，不需要裁` }
  if (report.droppable < config.minDroppableEvents) {
    return { should: false, reason: `可丢弃 ${report.droppable} 条，少于阈值 ${config.minDroppableEvents}` }
  }
  const ratio = report.events === 0 ? 0 : report.droppable / report.events
  if (ratio < config.minRatio) {
    return { should: false, reason: `可丢弃占比 ${(ratio * 100).toFixed(1)}%，低于阈值 ${(config.minRatio * 100).toFixed(1)}%` }
  }
  if (config.requireModelUnchanged && report.modelBefore !== report.modelAfter) {
    return { should: false, reason: `模型视图会变（${report.modelBefore} → ${report.modelAfter}），保守跳过` }
  }
  return { should: true, reason: `窗口 ${report.windows} → ${config.keepWindows}，可丢弃 ${report.droppable} 条（${(ratio * 100).toFixed(1)}%）` }
}

/**
 * 列出候选日志文件。
 *
 * @param {string} root - 会话根目录。
 * @returns {string[]} 日志文件路径。
 */
/**
 * Read the remembered verdicts.
 *
 * @returns {Record<string, { size: number, mtimeMs: number, verdict: string, reason: string }>} the memory.
 */
/**
 * Cache stamp for remembered verdicts.
 *
 * A verdict is remembered against the file's size and mtime, and that is the
 * right key for the FILE - but not for the ANSWER: the scan's answer also
 * depends on this plugin's own cutting logic. Bumping this string invalidates
 * every remembered verdict once, so a changed algorithm is never masked by a
 * cache that says "skip, the model view would change" from the previous one.
 */
export const MEMORY_STAMP = 'trim-window-v2-tail-cut'

export function readMemory() {
  try {
    let file = path.join(os.homedir(), '.dsh', MEMORY_FILE)
    if (!fs.existsSync(file)) file = path.join(os.homedir(), '.dsh', LEGACY_MEMORY_FILE)
    if (!fs.existsSync(file)) return {}
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Write the remembered verdicts back.
 *
 * @param {object} memory - the memory to store.
 */
export function writeMemory(memory) {
  try {
    const file = path.join(os.homedir(), '.dsh', MEMORY_FILE)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(memory))
  } catch {
    // A scan that cannot remember is still a correct scan.
  }
}


/**
 * 日志里有多少条插件载体（edit / rerun / delete 的“注释行”）。
 *
 * @param {string} logFile - 日志路径。
 * @returns {number} 载体条数；读不出来时抛错，由调用方当作 0。
 */
export function carriersIn(logFile) {
  const log = readLog(logFile)
  let count = 0
  for (const event of log.events) {
    const source = event?.data?.source
    if (source === null || source === undefined) continue
    const kind = source.kind
    if (typeof kind === 'string' && (kind.startsWith('plugin:') || typeof source.editedBy === 'string')) count += 1
  }
  return count
}

export function listLogs(root) {
  if (!fs.existsSync(root)) return []
  const out = []
  for (const workspace of fs.readdirSync(root)) {
    const workspaceDir = path.join(root, workspace)
    let entries
    try {
      if (!fs.statSync(workspaceDir).isDirectory()) continue
      entries = fs.readdirSync(workspaceDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const sessionDir = path.join(workspaceDir, entry)
      let files
      try {
        if (!fs.statSync(sessionDir).isDirectory()) continue
        files = fs.readdirSync(sessionDir)
      } catch {
        continue
      }
      for (const file of files) {
        if (!isCurrentLog(file)) continue
        out.push(path.join(sessionDir, file))
      }
    }
  }
  return out
}

/**
 * 试算一个日志：裁到 keepWindows 会丢多少、模型视图变不变。
 *
 * @param {string} logFile - 日志文件。
 * @param {number} keepWindows - 保留最后几窗。
 * @returns {object} 试算结果。
 */
export function estimate(logFile, keepWindows) {
  const log = readLog(logFile)
  // Read the live surface BEFORE planning: keepLastWindows re-anchors replace
  // ranges on the events it keeps, so the caller's view of `log.events` is only
  // the original one until the planner has run.
  const beforeVisible = foldSurface(log.events).visible
  const trimmed = keepLastWindows(log.events, keepWindows)
  const before = beforeVisible.length
  // Measure what would actually be WRITTEN, not the planner's intermediate: the
  // renumbering pass repairs dangling replace ranges, and a plan that looks one
  // node short before it settles into the file exactly where it started. Judging
  // the intermediate made the "model view must not change" gate reject trims
  // that the host then accepted verbatim.
  const after =
    trimmed.cutSeq === null ? before : foldSurface(renumber(trimmed.events).events).visible.length
  return {
    title: titleOf(log.events),
    events: log.events.length,
    bytes: log.compressedBytes,
    windows: trimmed.windows,
    cutSeq: trimmed.cutSeq,
    droppable: trimmed.dropped,
    modelBefore: before,
    modelAfter: after,
    sessionId: log.header?.id ?? path.basename(path.dirname(logFile)),
  }
}

/**
 * A session's own title, from the log's last `session/title` event.
 *
 * The card asks "which conversation is this backup from", and a bare session id
 * does not answer that. The title is already in the log the scan reads anyway, so
 * it is remembered with the verdict instead of costing a second read.
 *
 * @param {object[]} events - the session's events.
 * @returns {string} the title, or '' when the session has none.
 */
export function titleOf(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event && event.type === 'session/title' && event.data && typeof event.data.title === 'string') {
      return event.data.title
    }
  }
  return ''
}

/**
 * 清理旧备份，只留最新的 keep 份（只动本插件自己命名的那批）。
 *
 * @param {string} logFile - 日志文件。
 * @param {number} keep - 保留最新几份；`0` 表示**一份都不留**（连这次刚生成的那份也删掉）。
 * @returns {string[]} 被删掉的备份。
 */
export function pruneBackups(logFile, keep) {
  const dir = path.dirname(logFile)
  const prefix = `${path.basename(logFile)}.precompact-`
  let names
  try {
    names = fs.readdirSync(dir).filter((n) => n.startsWith(prefix))
  } catch {
    return []
  }
  names.sort()
  const doomed = names.slice(0, Math.max(0, names.length - keep))
  for (const name of doomed) {
    try {
      fs.rmSync(path.join(dir, name), { force: true })
    } catch {
      // 删不掉就算了：备份多留一份不是问题。
    }
  }
  return doomed
}

/**
 * 扫一遍并（按配置）裁剪。
 *
 * @param {object} config - 生效配置。
 * @param {{ info?: Function, warn?: Function }} [logger] - 日志器。
 * @returns {Promise<object>} 本次摘要。
 */
export async function runScan(config, logger = {}) {
  const started = Date.now()
  const summary = { startedAt: new Date().toISOString(), scanned: 0, trimmed: [], skipped: [], failed: [], repaired: [], savedBytes: 0, dryRun: config.dryRun }
  const memory = readMemory()
  const remember = {}
  const roots = discoverRoots(config.sessionsRoot, { only: config.isolateRoots === true })
  summary.roots = roots
  const legacy = roots.flatMap((root) => listLegacy(root))
  summary.legacy = { files: legacy.length, bytes: legacy.reduce((sum, item) => sum + item.bytes, 0) }
  const allLogs = roots.flatMap((root) => listLogs(root))
  for (const logFile of allLogs) {
    summary.scanned += 1
    const sessionId = path.basename(path.dirname(logFile))
    if (isSessionLocked(logFile)) {
      summary.skipped.push({ sessionId, reason: '正被宿主打开（session.lock）' })
      continue
    }
    // A log the host cannot load is worse than a big log: the session vanishes
    // from the list. Check it against the loader itself and put the newest good
    // backup back before ordinary trimming has a chance to touch it.
    if (config.repairOnBoot !== false && !config.dryRun) {
      const repaired = await repairIfCorrupt(logFile, config)
      if (repaired !== null) {
        if (repaired.failed === true) summary.failed.push({ sessionId, reason: `日志装不上，也没有可用备份：${repaired.reason}` })
        else summary.repaired.push(repaired)
        continue
      }
    }
    // A log smaller than `minBytes` cannot hold four windows, and reading it out
    // is the expensive half of a scan: 94 sessions took 68 s when every one was
    // decoded, and almost all of them are tiny.
    let bytes = 0
    try {
      bytes = fs.statSync(logFile).size
    } catch {
      summary.skipped.push({ sessionId, reason: '读不到文件大小' })
      continue
    }
    if (bytes < config.minBytes) {
      summary.skipped.push({ sessionId, reason: `只有 ${Math.round(bytes / 1024)} KB，不可能有 4 个窗口` })
      continue
    }
    let mtimeMs = 0
    try {
      mtimeMs = fs.statSync(logFile).mtimeMs
    } catch {
      mtimeMs = 0
    }
    const known = memory[logFile]
    if (
      !config.dryRun &&
      known !== undefined &&
      known.stamp === MEMORY_STAMP &&
      known.size === bytes &&
      known.mtimeMs === mtimeMs
    ) {
      // Same bytes, same mtime: the answer cannot have changed.
      remember[logFile] = known
      if (known.verdict === 'skip') {
        summary.skipped.push({ sessionId, reason: known.reason })
      } else if (known.verdict === 'fail') {
        summary.failed.push({ sessionId, reason: known.reason })
      }
      continue
    }
    // 先折叠：edit/rerun/delete 的载体是“注释行”，落成正文后日志才是“本来如此”。
    // 折叠完继续往下走，于是同一份日志还能顺带被裁窗口（两步都各自验过才写）。
    if (config.flattenOnBoot !== false) {
      let carriers = 0
      try {
        carriers = carriersIn(logFile)
      } catch {
        carriers = 0
      }
      if (carriers > 0) {
        try {
          const flattened = await applyFlatten(logFile, config)
          summary.trimmed.push({
            sessionId,
            reason: `折叠 edit/rerun/delete 痕迹（${flattened.before.events} → ${flattened.after.events} 条）`,
            before: flattened.before.bytes,
            after: flattened.after.bytes,
            events: [flattened.before.events, flattened.after.events],
            backup: flattened.backup,
            prunedBackups: pruneBackups(logFile, config.backupKeep),
          })
          const stat = fs.statSync(logFile)
          bytes = stat.size
          mtimeMs = stat.mtimeMs
        } catch (error) {
          summary.failed.push({ sessionId, reason: `折叠失败：${error instanceof Error ? error.message : String(error)}` })
          continue
        }
      }
    }
    // 清流式回放是独立一步：它不依赖裁窗口，也不改行数/轮次/表面。
    if (config.streamOnBoot === true) {
      try {
        const cleaned = await applyStreamOnly(logFile, 0)
        if (cleaned !== null) {
          summary.trimmed.push({
            sessionId,
            reason: `清空 ${cleaned.events} 条旧回合的流式回放`,
            before: cleaned.before,
            after: cleaned.after,
            backup: cleaned.backup,
            prunedBackups: pruneBackups(logFile, config.backupKeep),
          })
          const stat = fs.statSync(logFile)
          bytes = stat.size
          mtimeMs = stat.mtimeMs
        }
      } catch (error) {
        summary.failed.push({ sessionId, reason: `清理失败：${error instanceof Error ? error.message : String(error)}` })
        continue
      }
    }
    // 先做“清理已被遮蔽的事件”（要重编号，默认关）：它只删界面早就不显示的行，
    // 不改轮次也不碰载体；叠在裁剪/折叠之前跑，后面的步骤看到的就是干净日志。
    //
    // 但折叠会重建整份日志（遮蔽行本来就不会写回），两者最终结果一致——
    // 实测同一份日志：只清理 711 ms、只折叠 268 ms、先清理再折叠 839 ms，
    // 最后都是 1,673 条 / 598 KB。所以折叠要跑的时候，这一步纯属浪费。
    const flattenWillRun = config.flattenOnBoot === true && carriers > 0
    if (config.losslessOnBoot === true && !flattenWillRun) {
      try {
        const plan = planLossless(logFile, config)
        if (plan.should) {
          const applied = await applyLossless(logFile, config, plan)
          summary.trimmed.push({
            sessionId,
            reason: `清理 ${applied.before.events - applied.after.events} 条已被遮蔽的事件`,
            before: applied.before.bytes,
            after: applied.after.bytes,
            backup: applied.backup,
            prunedBackups: pruneBackups(logFile, config.backupKeep),
          })
          const stat = fs.statSync(logFile)
          bytes = stat.size
          mtimeMs = stat.mtimeMs
        }
      } catch (error) {
        summary.failed.push({ sessionId, reason: `清理失败：${error instanceof Error ? error.message : String(error)}` })
        continue
      }
    }
    // 裁窗口关掉时，仍然可以只做“清理流式回放”这一件事（不裁、不改轮次）。
    if (config.trimOnBoot === false) {
      try {
        const cleaned = await applyStreamOnly(logFile, 0)
        if (cleaned !== null) {
          summary.trimmed.push({
            sessionId,
            reason: `清空 ${cleaned.events} 条旧回合的流式回放`,
            before: cleaned.before,
            after: cleaned.after,
            backup: cleaned.backup,
            prunedBackups: pruneBackups(logFile, config.backupKeep),
          })
        } else {
          summary.skipped.push({ sessionId, reason: '没有可清的流式回放' })
        }
      } catch (error) {
        summary.failed.push({ sessionId, reason: `清理失败：${error instanceof Error ? error.message : String(error)}` })
      }
      continue
    }
    let report
    let lossless = null
    try {
      if (config.mode === 'window') {
        report = estimate(logFile, config.keepWindows)
      } else {
        lossless = planLossless(logFile, config)
        report = lossless.report
      }
    } catch (error) {
      summary.failed.push({ sessionId, reason: `读不出来：${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    const plan = config.mode === 'window' ? planTrim(report, config) : lossless
    if (!plan.should && config.mode === 'window' && report.cutSeq === null && report.windows > config.keepWindows) {
      // No lossless window cut exists (a replace's target lives in the window
      // that would go). Rebuilding the log from the surface erases those records
      // and lands the session at the same number of windows without touching
      // what the model reads - but it is also the only path that invents rows,
      // and every implicit contract it has to restate (row time, the assistant
      // stream, the protected system head) is one more way to produce a log the
      // host refuses. It destroyed three sessions that way, so it is opt-in.
      if (config.rebuildFallback !== true) {
        // 不造行：退回“只删已遮蔽事件”，把日志收敛成模型看到的那一份表面。
        // 这条路径一行都不新增，宿主的隐式契约不需要重述。
        let plan = null
        try {
          plan = planLossless(logFile, config)
        } catch {
          plan = null
        }
        if (plan !== null && plan.should) {
          try {
            const applied = await applyLossless(logFile, config, plan)
            summary.savedBytes += Math.max(0, applied.before.bytes - applied.after.bytes)
            summary.trimmed.push({
              sessionId,
              reason: `没有无损切点，只删已遮蔽事件（${applied.before.events} → ${applied.after.events} 条）`,
              before: applied.before.bytes,
              after: applied.after.bytes,
              events: [applied.before.events, applied.after.events],
              windows: report.windows,
              backup: applied.backup,
              prunedBackups: pruneBackups(logFile, config.backupKeep),
            })
            continue
          } catch (error) {
            summary.failed.push({ sessionId, reason: error instanceof Error ? error.message : String(error) })
          }
        }
        const reason = '没有无损切点；只删已遮蔽事件也没到阈值'
        remember[logFile] = { stamp: MEMORY_STAMP, size: bytes, mtimeMs, verdict: 'skip', reason, title: report.title }
        summary.skipped.push({ sessionId, reason })
        continue
      }
      try {
        const rebuilt = await applyRebuild(logFile, config)
        summary.savedBytes += Math.max(0, rebuilt.before.bytes - rebuilt.after.bytes)
        summary.trimmed.push({
          sessionId,
          reason: `没有无损切点，改写日志（${rebuilt.before.events} → ${rebuilt.after.events} 条）`,
          before: rebuilt.before.bytes,
          after: rebuilt.after.bytes,
          events: [rebuilt.before.events, rebuilt.after.events],
          windows: report.windows,
          backup: rebuilt.backup,
          prunedBackups: pruneBackups(logFile, config.backupKeep),
        })
      } catch (error) {
        summary.failed.push({ sessionId, reason: error instanceof Error ? error.message : String(error) })
      }
      continue
    }
    if (!plan.should) {
      remember[logFile] = { stamp: MEMORY_STAMP, size: bytes, mtimeMs, verdict: 'skip', reason: plan.reason, title: report.title }
      summary.skipped.push({ sessionId, reason: plan.reason })
      continue
    }
    if (config.dryRun) {
      summary.trimmed.push({ sessionId, dryRun: true, reason: plan.reason, before: report.bytes, after: report.bytes, events: [report.events, report.events - report.droppable] })
      continue
    }
    try {
      const result = config.mode === 'window' ? await applyTrim(logFile, config.keepWindows) : await applyLossless(logFile, config, lossless)
      if (config.mode === 'window') noteWindowTrim(logFile, result, config.recordLedger)
      const pruned = pruneBackups(logFile, config.backupKeep)
      summary.savedBytes += Math.max(0, result.before.bytes - result.after.bytes)
      summary.trimmed.push({
        sessionId,
        reason: plan.reason,
        before: result.before.bytes,
        after: result.after.bytes,
        events: [result.before.events, result.after.events],
        windows: result.before.windows,
        backup: path.basename(result.backup),
        prunedBackups: pruned,
      })
    } catch (error) {
      summary.failed.push({ sessionId, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  if (!config.dryRun) writeMemory(remember)
  summary.ms = Date.now() - started
  const line = `扫 ${summary.scanned} 个会话：裁 ${summary.trimmed.length}，跳过 ${summary.skipped.length}，失败 ${summary.failed.length}，省 ${(summary.savedBytes / 1048576).toFixed(1)} MB（${summary.ms} ms）`
  if (typeof logger.info === 'function') logger.info(`[dsh-log-trim] ${line}`)
  return summary
}

/**
 * 只允许本机访问（路由不该对外暴露）。
 *
 * @param {import('node:http').IncomingMessage} req - 请求。
 * @returns {boolean} 允许返回 true。
 */
function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/**
 * Cordis 插件入口。
 *
 * @param {object} ctx - 插件上下文。
 * @param {object} [config] - 用户配置。
 */

/**
 * 本机是否同时装了独立的本插件与内嵌了它的聚合包（`dsh-as-aistudio`）。
 *
 * 两份会各跑一次启动扫描：都能看见对方的 `.precompact-` 备份，也能同时改写同一份日志。
 * 这不是错误，是需要提醒的配置。
 *
 * @param {string} [home] - 家目录（测试用）。
 * @returns {boolean} 同时装了就是 true。
 */
export function duplicateStudioInstall(home = os.homedir()) {
  const profiles = path.join(home, '.dsh', 'profiles')
  let names = []
  try {
    names = fs.readdirSync(profiles)
  } catch {
    return false
  }
  for (const name of names) {
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(profiles, name, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    const bundles = Array.isArray(manifest?.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : []
    if (bundles.includes('dsh-log-trim') && bundles.includes('dsh-as-aistudio')) return true
  }
  return false
}

export function apply(ctx, config = {}) {
  // The card can change these while the host runs, so the resolved values live in
  // a box the routes can replace instead of a frozen const.
  let resolved = resolveConfig({ ...config, ...readSavedConfig() })
  const state = { last: null, running: false }
  // 双份安装：聚合包里已经内嵌了一份裁剪器，再单装一份会各跑一遍启动扫描。
  const duplicate = duplicateStudioInstall()
  if (duplicate && typeof ctx.logger?.warn === 'function') {
    ctx.logger.warn('[dsh-log-trim] 检测到同时安装了 dsh-as-aistudio（内置本插件）：两份会各跑一次启动扫描，建议只留一份')
  }

  // A session the GUI has open cannot be rewritten (the host holds its lock).
  // The moment one closes it becomes writable, so the deferred work happens
  // there instead of waiting for the next boot.
  ctx.on?.('session/disposed', (session) => {
    const sessionId = session?.id ?? session?.sessionId
    if (typeof sessionId !== 'string' || sessionId === '') return
    void (async () => {
      await new Promise((resolve) => setTimeout(resolve, 750))
      try {
        const live = resolved
        if (!live.enabled) return
        const logFile = logFileOf(live.sessionsRoot, sessionId)
        if (logFile === null || isSessionLocked(logFile)) return
        const report = estimate(logFile, live.keepWindows)
        if (report.windows <= live.keepWindows) return
        if (live.mode === 'rebuild') {
          await applyRebuild(logFile, live)
          return
        }
        if (live.mode === 'window') {
          const plan = planTrim(report, live)
          if (plan.should) {
            const done = await applyTrim(logFile, live.keepWindows, { streamKeepTurns: 0 })
            noteWindowTrim(logFile, done, live.recordLedger)
          }
          else await applyRebuild(logFile, live)
          return
        }
        const plan = planLossless(logFile, live)
        if (plan.should) await applyLossless(logFile, live, plan)
      } catch {
        // Best effort: a failed rewrite leaves the log exactly as it was.
      }
    })()
  })

  /** Replace the live config (a save from the card) and report what took effect. */
  const reload = (patch) => {
    resolved = resolveConfig({ ...resolved, ...patch })
    return resolved
  }

  const run = async () => {
    if (state.running) return state.last
    state.running = true
    try {
      state.last = await runScan(resolved, ctx.logger ?? {})
      return state.last
    } finally {
      state.running = false
    }
  }

  if (resolved.enabled && resolved.scanOnBoot) {
    // 启动就扫：这是"会话还没被打开"的那个窗口。
    ctx.effect(() => {
      let cancelled = false
      void (async () => {
        try {
          await run()
        } catch (error) {
          if (!cancelled && typeof ctx.logger?.warn === 'function') {
            ctx.logger.warn(`[dsh-log-trim] 扫描失败：${error instanceof Error ? error.message : String(error)}`)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    })
  }

  /** Read a JSON body, bounded: this route is a settings form, not an upload. */
  const readJsonBody = (req, limit = 64 * 1024) =>
    new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > limit) {
          reject(new Error('请求体太大'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8').trim()
          resolve(text === '' ? {} : JSON.parse(text))
        } catch (error) {
          reject(error)
        }
      })
      req.on('error', reject)
    })

  const sendJson = (res, status, body) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }

  const registerRoutes = (webServer, fiber) => {
    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/status`,
        handler: (req, res) => {
          if (!isLoopback(req)) {
            res.statusCode = 403
            res.end('loopback only')
            return
          }
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true, version: PLUGIN_VERSION, config: resolved, running: state.running, last: state.last, duplicateStudio: duplicate }, null, 2))
        },
      }),
    )
    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/run`,
        handler: async (req, res) => {
          if (!isLoopback(req)) {
            res.statusCode = 403
            res.end('loopback only')
            return
          }
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('POST only')
            return
          }
          const result = await run()
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true, result }, null, 2))
        },
      }),
    )
    // The settings card's own bridge: read the live values, write them back. Kept
    // separate from `/status` so a save never has to look like a scan.
    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/config`,
        handler: async (req, res) => {
          if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' })
          if (req.method === 'GET') {
            return sendJson(res, 200, { ok: true, config: resolved, defaults: DEFAULTS, version: PLUGIN_VERSION })
          }
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET or POST' })
          try {
            const body = await readJsonBody(req)
            const next = reload(body !== null && typeof body === 'object' ? body : {})
            const saved = writeSavedConfig(next)
            sendJson(res, 200, { ok: true, config: next, saved })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    )

    // Trim ONE session, now. This is the "choose a conversation and compress it"
    // entry the card and the tooling use: it refuses a held session, verifies the
    // result before writing, and keeps the original as a backup.
    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/restore`,
        handler: async (req, res) => {
          if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' })
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' })
          try {
            const body = await readJsonBody(req)
            const sessionId = String((body && body.sessionId) || '').trim()
            const backup = String((body && body.backup) || '').trim()
            if (sessionId === '' || backup === '') return sendJson(res, 400, { ok: false, error: 'sessionId 和 backup 都要有' })
            const logFile = logFileOf(resolved.sessionsRoot, sessionId)
            if (logFile === null) return sendJson(res, 404, { ok: false, error: '找不到这个会话的日志' })
            let release = null
            if (isSessionLocked(logFile)) {
              release = await releaseSession(ctx, sessionId)
              if (release.released !== true) return sendJson(res, 409, { ok: false, error: `会话正被宿主打开着，而且没能释放（${release.detail}）` })
              for (let attempt = 0; attempt < 20 && isSessionLocked(logFile); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 150))
            }
            const result = await restoreFromBackup(logFile, backup, resolved)
            if (result.ok !== true) return sendJson(res, 409, { ok: false, error: result.error })
            sendJson(res, 200, { ok: true, ...result, release })
          } catch (error) {
            sendJson(res, 409, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    )

    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/trim`,
        handler: async (req, res) => {
          if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' })
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' })
          try {
            const body = await readJsonBody(req)
            const sessionId = String((body && body.sessionId) || '').trim()
            if (sessionId === '') return sendJson(res, 400, { ok: false, error: 'sessionId required' })
            const logFile = logFileOf(resolved.sessionsRoot, sessionId)
            if (logFile === null) return sendJson(res, 404, { ok: false, error: '找不到这个会话的日志' })
            const keep = Number.isSafeInteger(body && body.keep) && body.keep > 0 ? Math.min(body.keep, 50) : resolved.keepWindows
            // A session the user has open is held by the host, and the log is
            // single-writer. The card's "压缩" is an explicit request, so the host
            // is asked to let go first (the same seam relocate and delete-session
            // use); if it will not let go, the request fails with the reason.
            let release = null
            if (isSessionLocked(logFile)) {
              release = await releaseSession(ctx, sessionId)
              if (release.released !== true) {
                return sendJson(res, 409, {
                  ok: false,
                  error: `这个会话正被宿主打开着，而且没能释放（${release.detail}）。退出 DSH 后用命令行裁，或关掉它再试`,
                  release,
                })
              }
            }
            // `detach` returns before the host has closed the lock, and the
            // single-writer check reads the lock: give it a moment instead of
            // failing a request the host already agreed to.
            if (release !== null && release.released === true) {
              for (let attempt = 0; attempt < 20 && isSessionLocked(logFile); attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 150))
              }
            }
            const mode = body && (body.mode === 'window' || body.mode === 'lossless' || body.mode === 'rebuild' || body.mode === 'flatten') ? body.mode : resolved.mode
            const result = await trimOne(logFile, { ...resolved, mode, keepWindows: keep })
            if (typeof ctx.logger?.info === 'function') {
              ctx.logger.info(`[dsh-log-trim] 手动压缩 ${sessionId}：${result.before.events} → ${result.after.events} 事件`)
            }
            sendJson(res, 200, { ok: true, ...result, ...(release === null ? {} : { release }) })
          } catch (error) {
            sendJson(res, 409, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    )

    // The superseded logs are dead weight: the host reads the current format
    // only, so a `session.v3` file next to it is never touched again. Deleting
    // them is the only way to reclaim that space, so it takes an explicit
    // confirm rather than happening on a scan.
    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/legacy`,
        handler: async (req, res) => {
          if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' })
          try {
            const roots = discoverRoots(resolved.sessionsRoot)
            const legacy = roots.flatMap((root) => listLegacy(root))
            const total = legacy.reduce((sum, item) => sum + item.bytes, 0)
            if (req.method === 'GET') {
              return sendJson(res, 200, { ok: true, files: legacy.length, bytes: total, list: legacy.slice(0, 40).map((item) => ({ ...item, path: item.path })) })
            }
            if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET or POST' })
            const body = await readJsonBody(req)
            if (body === null || body.confirm !== true) {
              return sendJson(res, 400, { ok: false, error: '删除旧格式日志要显式确认：{\"confirm\":true}', files: legacy.length, bytes: total })
            }
            const removed = []
            for (const item of legacy) {
              try {
                fs.rmSync(item.path, { force: true })
                removed.push(item.path)
              } catch (error) {
                // 删不掉就跳过：报告里能看出来
              }
            }
            const freed = legacy.filter((item) => removed.includes(item.path)).reduce((sum, item) => sum + item.bytes, 0)
            if (typeof ctx.logger?.info === 'function') {
              ctx.logger.info(`[dsh-log-trim] 清理旧格式日志 ${removed.length} 个：${(freed / 1048576).toFixed(1)} MB`)
            }
            return sendJson(res, 200, { ok: true, removed: removed.length, bytes: freed })
          } catch (error) {
            return sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    )

    // Where the backups are, and a way to open the folder holding them. The card
    // shows the paths; the button hands them to the system file manager.
    // 裁剪统计账本：别的插件（如 dsh-session-pages）直接读这个接口，
    // 不必依赖本包；不带 sessionId 时返回全量，带时只返回那一个会话。
    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/ledger`,
        handler: (req, res) => {
          if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' })
          if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' })
          let sessionId = null
          try {
            sessionId = new URL(req.url, 'http://127.0.0.1').searchParams.get('sessionId')
          } catch {
            sessionId = null
          }
          const ledger = readLedger()
          if (sessionId === null || sessionId === '') return sendJson(res, 200, { ok: true, ...ledger })
          const entry = ledger.sessions[sessionId] ?? null
          return sendJson(res, 200, { ok: true, sessionId, trim: entry })
        },
      }),
    )

    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/backups`,
        handler: (req, res) => {
          if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' })
          if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' })
          try {
            const listed = listBackups(resolved.sessionsRoot)
            // 标题来自扫描记忆（每个日志读过一次就记下了），不为了显示它再读一遍日志。
            const memory = readMemory()
            const titles = new Map()
            for (const [file, entry] of Object.entries(memory)) {
              if (entry && typeof entry.title === 'string' && entry.title !== '') {
                titles.set(path.basename(path.dirname(file)), entry.title)
              }
            }
            listed.backups = listed.backups.map((item) => ({ ...item, title: titles.get(item.sessionId) || '' }))
            sendJson(res, 200, { ok: true, sessionsRoot: resolved.sessionsRoot, ...listed })
          } catch (error) {
            sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    )

    fiber.effect(() =>
      webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/reveal`,
        handler: async (req, res) => {
          if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' })
          if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' })
          try {
            const body = await readJsonBody(req)
            const wanted = String((body && body.path) || '').trim()
            if (wanted === '') return sendJson(res, 400, { ok: false, error: 'path required' })
            // Only inside this plugin's own root: the route opens a folder with the
            // user's file manager, so it must not be a way to open arbitrary ones.
            const rootReal = fs.realpathSync(resolved.sessionsRoot)
            const targetDir = fs.existsSync(wanted) && fs.statSync(wanted).isDirectory() ? wanted : path.dirname(wanted)
            const targetReal = fs.realpathSync(targetDir)
            if (targetReal !== rootReal && !targetReal.startsWith(`${rootReal}${path.sep}`)) {
              return sendJson(res, 403, { ok: false, error: '这个路径不在会话目录里' })
            }
            sendJson(res, 200, { ok: true, ...openDirectory(targetReal) })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    )
  }

  const webServer = ctx.get('webServer')
  if (webServer !== undefined && webServer !== null) registerRoutes(webServer, ctx)
  else ctx.inject(['webServer'], (sub) => registerRoutes(sub.webServer, sub))
}
