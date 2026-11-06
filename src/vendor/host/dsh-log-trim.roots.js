// dsh-log-trim host half (dsh-log-trim.roots.js), VENDORED by tools/vendor.mjs - DO NOT EDIT.
//
// Source: ../dsh-log-trim/lib/roots.js  (v0.7.6, sha256 028d9c12a395aaab)
// Regenerate with `npm run vendor`; test/sync.test.js fails when this is stale.
//
// src/shell.js imports the copy named after the component, which is why the
// studio installs with no runtime dependency on the component package.
/**
 * Where session logs live on this machine, and which of them the host still reads.
 *
 * Two things this plugin kept getting wrong by assuming the obvious:
 *
 *   1. **A machine can have more than one DSH home.** `~/.dsh/sessions` is the
 *      default, but a second home is a normal thing (measured: `~/fish2/.dsh`
 *      with its own four logs, including one of the largest sessions). Roots are
 *      therefore FOUND rather than configured, so no machine path is baked in.
 *   2. **A session directory can hold a superseded log.** `session.v3.jsonl.zstd`
 *      from before an upgrade sits next to the `session.v4` the host reads, and it
 *      is never read again - measured 9.8 MB in one directory. Window trimming
 *      cannot touch it, because it is not the live log.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** The format version this plugin treats as current. */
export const CURRENT_FORMAT = 4

/**
 * Whether a file name is the session log the host actually reads.
 *
 * @param {string} name - bare file name.
 * @returns {boolean} true for the current-format log.
 */
export function isCurrentLog(name) {
  const match = /^session\.v(\d+)\.jsonl\.zstd$/.exec(name)
  return match !== null && Number(match[1]) >= CURRENT_FORMAT
}

/**
 * Every sessions root this machine has.
 *
 * @param {string} [extra] - an explicitly configured root, included first.
 * @param {{ only?: boolean }} [options] - `only: true` 时**只**返回 `extra`，
 *   不追加默认根目录。测试/隔离场景必须用它：`os.homedir()` 在 macOS 上不读
 *   `$HOME`，靠改环境变量“隔离”是无效的（这里踩过：把测试跑到了真实日志上）。
 * @returns {string[]} existing roots, de-duplicated.
 */
export function discoverRoots(extra, options = {}) {
  const roots = []
  const add = (candidate) => {
    if (typeof candidate !== 'string' || candidate === '') return
    let resolved
    try {
      resolved = path.resolve(candidate)
    } catch {
      return
    }
    if (!roots.includes(resolved) && fs.existsSync(resolved)) roots.push(resolved)
  }
  add(extra)
  if (options.only === true) return roots
  add(process.env.DSH_HOME === undefined ? '' : path.join(process.env.DSH_HOME, 'sessions'))
  add(path.join(os.homedir(), '.dsh', 'sessions'))
  let entries = []
  try {
    entries = fs.readdirSync(os.homedir())
  } catch {
    entries = []
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    add(path.join(os.homedir(), entry, '.dsh', 'sessions'))
  }
  return roots
}

/**
 * The session logs of one root, in the current format only.
 *
 * @param {string} root - sessions root.
 * @returns {string[]} log paths.
 */
export function listCurrentLogs(root) {
  if (!fs.existsSync(root)) return []
  const out = []
  let workspaces = []
  try {
    workspaces = fs.readdirSync(root)
  } catch {
    return out
  }
  for (const workspace of workspaces) {
    const workspaceDir = path.join(root, workspace)
    let sessions = []
    try {
      if (!fs.statSync(workspaceDir).isDirectory()) continue
      sessions = fs.readdirSync(workspaceDir)
    } catch {
      continue
    }
    for (const sessionId of sessions) {
      const dir = path.join(workspaceDir, sessionId)
      let names = []
      try {
        if (!fs.statSync(dir).isDirectory()) continue
        names = fs.readdirSync(dir)
      } catch {
        continue
      }
      for (const name of names) {
        if (isCurrentLog(name)) out.push(path.join(dir, name))
      }
    }
  }
  return out
}

/**
 * The superseded logs under one root: real files, never read again.
 *
 * @param {string} root - sessions root.
 * @returns {{ path: string, sessionId: string, bytes: number, version: number }[]} leftovers, largest first.
 */
export function listLegacy(root) {
  const out = []
  let workspaces = []
  try {
    workspaces = fs.readdirSync(root)
  } catch {
    return out
  }
  for (const workspace of workspaces) {
    const workspaceDir = path.join(root, workspace)
    let sessions = []
    try {
      if (!fs.statSync(workspaceDir).isDirectory()) continue
      sessions = fs.readdirSync(workspaceDir)
    } catch {
      continue
    }
    for (const sessionId of sessions) {
      const dir = path.join(workspaceDir, sessionId)
      let names = []
      try {
        if (!fs.statSync(dir).isDirectory()) continue
        names = fs.readdirSync(dir)
      } catch {
        continue
      }
      for (const name of names) {
        const match = /^session\.v(\d+)\.jsonl\.zstd$/.exec(name)
        if (match === null || Number(match[1]) >= CURRENT_FORMAT) continue
        const full = path.join(dir, name)
        let stat
        try {
          stat = fs.statSync(full)
        } catch {
          continue
        }
        out.push({ path: full, sessionId, bytes: stat.size, version: Number(match[1]) })
      }
    }
  }
  out.sort((a, b) => b.bytes - a.bytes)
  return out
}
