// dsh-log-trim host half (dsh-log-trim.archive.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/archive.js  (v0.8.0, sha256 36448b5b6cc2a6c3)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * 完美备份（perfect backup）：把会话的全部历史累积到一份档案里。
 *
 * 裁剪只该影响「会话里现在有多少窗」，不该影响「这份对话曾经发生过什么」。
 * 普通的 `.precompact-*` 是**裁剪前快照**，只留最近 `backupKeep` 份；档案是
 * 另一件事：从会话第一条开始，每次裁剪前把「档案里还没有的事件」追加进去。
 *
 * 为什么不重写整个档案：zstd 文件本来就是帧序列（每帧以魔数 28 b5 2f fd 开头），
 * 多帧首尾拼接是合法格式，读取端逐帧解即可（`readLogAsync` 就是这么读的）。
 * 所以追加只是「压一个新帧 append 到文件末尾」，代价是 O(新增)，不是 O(全量)。
 *
 * 档案放在会话目录的 `.archive/` 子目录里：宿主只加载 `session.v4.jsonl.zstd`，
 * 不会把档案当成一个会话（探针事故的教训）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import zlib from 'node:zlib'

/** 档案文件名：与会话日志同名，但在 `.archive/` 子目录里。 */
const ARCHIVE_NAME = 'session.v4.jsonl.zstd'

/**
 * 档案路径。
 *
 * @param {string} logFile - 会话日志的绝对路径。
 * @returns {string} 档案文件的绝对路径。
 */
export function archivePathOf(logFile) {
  return path.join(path.dirname(logFile), '.archive', ARCHIVE_NAME)
}

/** 一条事件的身份：同一轮裁剪前后 seq 会变，但这条判据不变。 */
function eventKey(event) {
  if (event === null || typeof event !== 'object') return null
  const messageId = event.data?.message?.id ?? event.data?.messageId
  if (typeof messageId === 'string' && messageId !== '') return `${event.type}|id:${messageId}`
  // 没有消息 id 的事件（turn/start、step/start…）按「类型 + 时间」认：裁剪会把
  // turn/step 重新编号，`data` 因此会变，用它判重会把同一批事件重复记一遍。
  if (typeof event.time === 'number') return `${event.type}|t:${event.time}`
  let payload
  try {
    payload = JSON.stringify(event.data ?? null)
  } catch {
    return null
  }
  return `${event.type}|${createHash('sha1').update(payload).digest('hex').slice(0, 20)}`
}

/** 按 zstd 魔数切帧。 */
function frameOffsets(buf) {
  const starts = []
  for (let i = 0; i + 4 <= buf.length; i += 1) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) starts.push(i)
  }
  return starts
}

/**
 * 读档案里的全部事件（跨帧，逐帧解）。
 *
 * @param {string} logFile - 会话日志路径。
 * @returns {object[]} 事件数组；没有档案时为空。
 */
export function readArchive(logFile) {
  const file = archivePathOf(logFile)
  let buf
  try {
    buf = fs.readFileSync(file)
  } catch {
    return []
  }
  const starts = frameOffsets(buf)
  const events = []
  for (let index = 0; index < starts.length; index += 1) {
    const end = index + 1 < starts.length ? starts[index + 1] : buf.length
    let text
    try {
      text = zlib.zstdDecompressSync(buf.subarray(starts[index], end)).toString('utf8')
    } catch {
      continue
    }
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      // 档案里只存事件；万一混进了会话头，跳过它。
      if (event.type === 'session') continue
      events.push(event)
    }
  }
  return events
}

/**
 * 把当前日志里「档案还没有的事件」追加成一帧。
 *
 * @param {string} logFile - 会话日志路径。
 * @param {object[]} liveEvents - 当前日志的事件（调用方已读好）。
 * @returns {{added: number, total: number, bytes: number}} 追加结果。
 */
export function appendArchive(logFile, liveEvents) {
  const file = archivePathOf(logFile)
  const archived = readArchive(logFile)
  const seen = new Set()
  for (const event of archived) {
    const key = eventKey(event)
    if (key !== null) seen.add(key)
  }
  const added = []
  for (const event of liveEvents) {
    const key = eventKey(event)
    if (key === null) continue
    if (seen.has(key)) continue
    seen.add(key)
    added.push(event)
  }
  if (added.length === 0) {
    return { added: 0, total: archived.length, bytes: 0 }
  }
  const text = added.map((event) => JSON.stringify(event)).join('\n') + '\n'
  const frame = zlib.zstdCompressSync(Buffer.from(text, 'utf8'), {
    params: { [zlib.constants.ZSTD_c_checksumFlag]: 1 },
  })
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, frame)
  return { added: added.length, total: archived.length + added.length, bytes: frame.length }
}

/**
 * 档案的现状（大小、事件数、时间跨度），给卡片看。
 *
 * @param {string} logFile - 会话日志路径。
 * @returns {object|null} 统计；没有档案时为 null。
 */
export function archiveInfo(logFile) {
  const file = archivePathOf(logFile)
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return null
  }
  const events = readArchive(logFile)
  const times = events.map((event) => event.time).filter((time) => typeof time === 'number')
  return {
    path: file,
    bytes: stat.size,
    events: events.length,
    from: times.length > 0 ? Math.min(...times) : null,
    to: times.length > 0 ? Math.max(...times) : null,
  }
}
