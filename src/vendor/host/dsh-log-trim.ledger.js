// dsh-log-trim host half (dsh-log-trim.ledger.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/ledger.js  (v0.7.4, sha256 5ca2460b42a3a776)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * 裁剪统计账本：每改写过一次日志就记一条，按会话累计。
 *
 * 放在 `~/.dsh/dsh-log-trim/ledger.json`——**谁能读谁就能显示**：
 * `dsh-session-pages` 之类的插件直接读文件即可，不需要依赖本包；
 * 本插件另外用 `/api/dsh-log-trim/ledger` 把它暴露出来。
 *
 * 账本只增不减（除了用户显式清空）：裁剪本身会删日志内容，统计不能跟着丢。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { windowsOf } from './dsh-log-trim.vendor.compact-session.mjs'

/** 账本版本；结构变了就加一，读者据此决定要不要认。 */
export const LEDGER_VERSION = 1

/** 账本文件路径。 */
export function ledgerPath(home = os.homedir()) {
  return path.join(home, '.dsh', 'dsh-log-trim', 'ledger.json')
}

/**
 * 读账本；不存在或坏掉时返回一个空账本（读取永远不该让插件起不来）。
 *
 * @param {string} [home] - 家目录（测试用）。
 * @returns {{ version: number, sessions: Record<string, object> }} 账本。
 */
export function readLedger(home = os.homedir()) {
  const empty = { version: LEDGER_VERSION, sessions: {} }
  let raw
  try {
    raw = fs.readFileSync(ledgerPath(home), 'utf8')
  } catch {
    return empty
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return empty
    const sessions = parsed.sessions !== null && typeof parsed.sessions === 'object' ? parsed.sessions : {}
    return { version: LEDGER_VERSION, sessions }
  } catch {
    return empty
  }
}


/** 一条事件的 usage 四项之和（缺项按 0 算）。 */
const USAGE_KEYS = ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens']

/**
 * 汇总一组事件的 usage。
 *
 * @param {object[]} events - 事件数组。
 * @returns {{ inputTokens: number, outputTokens: number, totalTokens: number, cacheReadTokens: number }} 四项合计。
 */
export function sumUsage(events) {
  const out = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0 }
  for (const event of Array.isArray(events) ? events : []) {
    const usage = event?.data?.usage
    if (usage === null || typeof usage !== 'object') continue
    for (const key of USAGE_KEYS) {
      const value = usage[key]
      if (typeof value === 'number' && Number.isFinite(value)) out[key] += value
    }
  }
  return out
}

/** 两组事件 usage 之差：被删掉的那部分。 */
export function diffUsage(before, after) {
  const a = sumUsage(before)
  const b = sumUsage(after)
  const out = {}
  for (const key of USAGE_KEYS) out[key] = Math.max(0, a[key] - b[key])
  return out
}

/** 事件流里出现过几个不同的轮次。 */
export function turnsOf(events) {
  const turns = new Set()
  for (const event of Array.isArray(events) ? events : []) {
    const turn = event?.data?.turn
    if (Number.isSafeInteger(turn) && turn > 0) turns.add(turn)
  }
  return turns.size
}

/**
 * 把一次改写记进账本。
 *
 * @param {object} entry - 记录。
 * @param {string} entry.sessionId - 会话 id。
 * @param {'window'|'flatten'|'stream'|'lossless'|'restore'} entry.mode - 做了什么。
 * @param {object[]} entry.before - 改写前的事件。
 * @param {object[]} entry.after - 改写后的事件。
 * @param {number} [entry.bytesBefore] - 改写前字节数。
 * @param {number} [entry.bytesAfter] - 改写后字节数。
 * @param {string} [home] - 家目录（测试用）。
 * @returns {object|null} 该会话的新累计；写不进去时返回 null。
 */
export function recordTrim(entry, home = os.homedir()) {
  const ledger = readLedger(home)
  const before = Array.isArray(entry.before) ? entry.before : []
  const after = Array.isArray(entry.after) ? entry.after : []
  // 窗口模式不一定留得下事件数组（裁剪是整份重写），允许直接传数字。
  const windowsBefore = Number.isSafeInteger(entry.windowsBefore) ? entry.windowsBefore : windowsOf(before).length
  const windowsAfter = Number.isSafeInteger(entry.windowsAfter) ? entry.windowsAfter : windowsOf(after).length
  const record = {
    at: new Date().toISOString(),
    mode: entry.mode,
    windowsBefore,
    windowsAfter,
    windowsRemoved: Math.max(0, windowsBefore - windowsAfter),
    eventsBefore: Number.isSafeInteger(entry.eventsBefore) ? entry.eventsBefore : before.length,
    eventsAfter: Number.isSafeInteger(entry.eventsAfter) ? entry.eventsAfter : after.length,
    eventsRemoved: Math.max(0, (Number.isSafeInteger(entry.eventsBefore) ? entry.eventsBefore : before.length) - (Number.isSafeInteger(entry.eventsAfter) ? entry.eventsAfter : after.length)),
    bytesBefore: typeof entry.bytesBefore === 'number' ? entry.bytesBefore : null,
    bytesAfter: typeof entry.bytesAfter === 'number' ? entry.bytesAfter : null,
    // 被删掉那部分的用量：账本可加，读者用“现存 + 已裁”还原真实总量。
    usageBefore: before.length > 0 ? sumUsage(before) : null,
    usageAfter: after.length > 0 ? sumUsage(after) : null,
    dropped: {
      events: Math.max(0, (Number.isSafeInteger(entry.eventsBefore) ? entry.eventsBefore : before.length) - (Number.isSafeInteger(entry.eventsAfter) ? entry.eventsAfter : after.length)),
      turns: Math.max(0, (Number.isSafeInteger(entry.turnsBefore) ? entry.turnsBefore : turnsOf(before)) - (Number.isSafeInteger(entry.turnsAfter) ? entry.turnsAfter : turnsOf(after))),
      usage: diffUsage(before, after),
    },
  }
  const current = ledger.sessions[entry.sessionId] ?? { trims: [], totals: { trims: 0, windowsRemoved: 0, eventsRemoved: 0, bytesSaved: 0, lastAt: null } }
  const trims = [...(Array.isArray(current.trims) ? current.trims : []), record].slice(-200)
  const totals = {
    trims: (current.totals?.trims ?? 0) + 1,
    windowsRemoved: (current.totals?.windowsRemoved ?? 0) + record.windowsRemoved,
    eventsRemoved: (current.totals?.eventsRemoved ?? 0) + record.eventsRemoved,
    bytesSaved: (current.totals?.bytesSaved ?? 0) + Math.max(0, (record.bytesBefore ?? 0) - (record.bytesAfter ?? 0)),
    turnsRemoved: (current.totals?.turnsRemoved ?? 0) + record.dropped.turns,
    usage: {
      inputTokens: (current.totals?.usage?.inputTokens ?? 0) + record.dropped.usage.inputTokens,
      outputTokens: (current.totals?.usage?.outputTokens ?? 0) + record.dropped.usage.outputTokens,
      totalTokens: (current.totals?.usage?.totalTokens ?? 0) + record.dropped.usage.totalTokens,
      cacheReadTokens: (current.totals?.usage?.cacheReadTokens ?? 0) + record.dropped.usage.cacheReadTokens,
    },
    lastAt: record.at,
  }
  ledger.sessions[entry.sessionId] = { trims, totals }
  try {
    const file = ledgerPath(home)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(ledger))
  } catch {
    return null
  }
  return totals
}

/** 清空账本（用户显式要求时）。 */
export function clearLedger(home = os.homedir()) {
  try {
    fs.rmSync(ledgerPath(home), { force: true })
    return true
  } catch {
    return false
  }
}

/**
 * 按日志路径记一笔：sessionId 就是日志所在目录名。
 *
 * @param {string} logFile - 日志路径。
 * @param {string} mode - window / flatten / stream / lossless / rebuild。
 * @param {object[]} before - 改写前事件。
 * @param {object[]} after - 改写后事件。
 * @param {{ bytesBefore?: number, bytesAfter?: number, record?: boolean, home?: string }} [options] - 附加信息。
 * @returns {object|null} 新累计；没记或记不进去返回 null。
 */
export function recordFor(logFile, mode, before, after, options = {}) {
  if (options.record === false) return null
  const sessionId = path.basename(path.dirname(logFile))
  return recordTrim({ sessionId, mode, before, after, bytesBefore: options.bytesBefore, bytesAfter: options.bytesAfter }, options.home)
}
