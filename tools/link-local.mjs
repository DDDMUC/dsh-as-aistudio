#!/usr/bin/env node
// 把当前仓库软链进某个 DSH profile，让那台机器**一直用本地最新的 studio**，
// 不必先发 npm。
//
// 做的事：
//   1. `tools/vendor.mjs`：把 ../dsh-* 的宿主/浏览器半部抄进 src/vendor；
//   2. `tools/build.mjs`：把浏览器半部打成一个 src/client.js；
//   3. 把 <profile>/node_modules/dsh-as-aistudio 换成指向本仓库的软链。
//
// 之后每次改了组件或 studio 本身：再跑一次本脚本，然后重启 DSH（客户端要硬刷新）。
//
// 用法：
//   node tools/link-local.mjs                 # 默认 desktop
//   node tools/link-local.mjs --profile web   # 指定 profile
//   node tools/link-local.mjs --no-build      # 只换软链，不重新构建
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const args = process.argv.slice(2)
const profileArg = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : 'desktop'
const build = !args.includes('--no-build')

if (build) {
  for (const tool of ['vendor.mjs', 'build.mjs']) {
    console.log(`[link-local] ${tool}`)
    execFileSync(process.execPath, [path.join(here, tool)], { cwd: root, stdio: 'inherit' })
  }
}

const profileRoot = path.join(os.homedir(), '.dsh', 'profiles', profileArg)
if (!fs.existsSync(profileRoot)) {
  console.error(`[link-local] profile 不存在：${profileRoot}`)
  process.exit(1)
}
const modules = path.join(profileRoot, 'node_modules')
fs.mkdirSync(modules, { recursive: true })
const target = path.join(modules, 'dsh-as-aistudio')
const backup = path.join(modules, 'dsh-as-aistudio.npm-bak')

let current = null
try {
  current = fs.lstatSync(target)
} catch {
  current = null
}

if (current !== null && current.isSymbolicLink()) {
  const resolved = fs.realpathSync(target)
  if (resolved === root) {
    console.log(`[link-local] 已经是软链：${target} → ${root}`)
    process.exit(0)
  }
  fs.rmSync(target, { force: true })
} else if (current !== null && current.isDirectory()) {
  // 只备份一次：反复运行时不要覆盖更早的那份 npm 安装。
  if (!fs.existsSync(backup)) {
    fs.renameSync(target, backup)
    console.log(`[link-local] 原 npm 安装已备份到 ${backup}`)
  } else {
    fs.rmSync(target, { recursive: true, force: true })
  }
}

fs.symlinkSync(root, target, 'dir')
console.log(`[link-local] 已软链：${target} → ${root}`)
console.log('[link-local] 重启 DSH 并在浏览器里硬刷新即可生效；改完代码后再跑一次本脚本。')
