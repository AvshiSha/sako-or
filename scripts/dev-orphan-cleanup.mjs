#!/usr/bin/env node
/**
 * Reaps orphaned Next dev workers belonging to THIS checkout, then gets out of
 * the way. Wired to `predev`, so it runs once per `npm run dev` and cleans up
 * after the *previous* session rather than policing the current one.
 *
 * ## Why this exists
 *
 * `next dev` farms work out to child processes - the static-path generation pool
 * for `/[lng]` is a `jest-worker` pool, which is why a failure in it surfaces as
 * "Jest worker encountered N child process exceptions". A pool is sized off the
 * CPU count (19 on this 20-core machine), and it is torn down by an `exit`
 * handler in the parent.
 *
 * Two things conspire to leak the whole pool:
 *
 *   1. A V8 heap OOM does not exit, it calls `abort()`. No `exit` handler runs,
 *      so the shutdown message is never sent and the children keep blocking on
 *      an IPC channel whose other end is gone.
 *   2. Windows has no process groups. A dead parent does not take its children
 *      with it, and there is no init to reap them, so they simply persist.
 *
 * Measured on 25 Nov 2026: 190 such workers, the oldest from 18 Nov, holding
 * 12,812 MB of committed memory between them. That left ~1 GB of commit headroom
 * on a 15.6 GB machine, which is why the *next* `next dev` died of heap OOM -
 * a ratchet, where each crash makes the following start more likely to crash.
 *
 * ## What counts as a target
 *
 * Both conditions, never one:
 *
 *   - **This project.** The worker's command line contains this checkout's
 *     absolute root and a `<dist>/dev/build/<hash>.js <port>` entry point. A
 *     second checkout, a git worktree or an unrelated Next app has a different
 *     root and is invisible to this script.
 *   - **Confirmed orphaned.** Its parent pid is absent from the live process
 *     table. A worker belonging to a running session always has a live parent,
 *     so an active session - including a second terminal, or a colleague's
 *     `next dev` in another checkout - is never touched.
 *
 * Age is deliberately NOT a criterion. A long-running dev session is normal, and
 * a worker spawned one second ago by a parent that just aborted is already
 * garbage. Time tells you nothing about either.
 *
 * The one failure mode of the parent-liveness test is pid reuse: if the OS has
 * recycled the dead parent's pid, the orphan reads as live and we skip it. That
 * is the safe direction - it leaks, it never kills something in use - and the
 * next run will catch it.
 *
 * `start-server.js` is explicitly out of scope even when orphaned: it holds the
 * port and `.next/dev/lock`, so a parentless one is still a usable dev server
 * (`next dev &` or a closed wrapper shell leaves exactly that). Killing it would
 * break an active session. Next's own guard already reports that case with a
 * precise `taskkill` command, which is the right place for it.
 *
 * ## Contract
 *
 * Never fails the build. Every path exits 0, the process enumeration is given a
 * hard timeout so it cannot hang `npm run dev`, and it prints nothing at all
 * unless it found something or was asked to be verbose.
 *
 * Plain `.mjs` with no imports beyond node builtins on purpose: this runs on
 * every single dev start, so a `tsx` boot would be pure latency.
 *
 *   node scripts/dev-orphan-cleanup.mjs              # reap, one line if it acted
 *   node scripts/dev-orphan-cleanup.mjs --dry-run    # report, change nothing
 *   node scripts/dev-orphan-cleanup.mjs --verbose    # say so even when clean
 *   node scripts/dev-orphan-cleanup.mjs --json       # machine-readable
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const argv = new Set(process.argv.slice(2))
const DRY_RUN = argv.has('--dry-run') || argv.has('-n')
const VERBOSE = argv.has('--verbose') || argv.has('-v')
const AS_JSON = argv.has('--json')

/** Hard ceiling on the process query. Dev startup must not wait on this. */
const ENUMERATE_TIMEOUT_MS = 15_000

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The worker entry point Next generates, e.g. `.next\dev\build\56416d4ae4ce586f.js 58648`.
 * Matched on the `dev/build` directory rather than a literal `.next`, so a
 * custom `distDir` still resolves. The trailing port argument is what
 * distinguishes a worker from an ordinary script that merely lives in there.
 */
const WORKER_ENTRY = /[\\/]dev[\\/]build[\\/][^\\/\s"']+\.js["']?\s+\d+(\s|$)/i

/** Compare paths without caring about slash direction or drive-letter case. */
function normalize(p) {
  return p.replace(/\//g, '\\').toLowerCase()
}

const ROOT_KEY = normalize(PROJECT_ROOT)

/**
 * One shot at the process table: every pid (to test parent liveness) plus the
 * node processes with their command lines (to identify candidates). A single
 * query, because a per-process lookup over a few hundred processes takes
 * minutes on a machine that is already swapping - which is exactly when this
 * script matters most.
 */
function enumerateWindows() {
  // Joined with newlines, NOT "; ": a `;` inside the hashtable literal below is
  // a syntax error, and PowerShell reports it as a generic non-zero exit, which
  // this script then (correctly, but uselessly) treats as "cannot enumerate".
  const ps = [
    '$ErrorActionPreference = "Stop"',
    '$all = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,CommandLine)',
    '$out = [ordered]@{',
    '  pids  = @($all | ForEach-Object { [int]$_.ProcessId })',
    '  nodes = @($all | Where-Object { $_.Name -eq "node.exe" } | ForEach-Object {',
    '    [ordered]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; cmd = [string]$_.CommandLine }',
    '  })',
    '}',
    'ConvertTo-Json -InputObject $out -Depth 4 -Compress',
  ].join('\n')

  const raw = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    {
      encoding: 'utf8',
      timeout: ENUMERATE_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }
  )

  const parsed = JSON.parse(raw)
  // ConvertTo-Json collapses a single-element array into a bare object.
  const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
  return { pids: asArray(parsed.pids), procs: asArray(parsed.nodes) }
}

/** Best-effort POSIX equivalent, so the hook is harmless on mac/Linux/CI. */
function enumeratePosix() {
  const raw = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], {
    encoding: 'utf8',
    timeout: ENUMERATE_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  const pids = []
  const procs = []
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
    if (!m) continue
    const pid = Number(m[1])
    pids.push(pid)
    if (/(^|[\\/])node(\.exe)?(\s|$)/i.test(m[3])) {
      procs.push({ pid, ppid: Number(m[2]), cmd: m[3] })
    }
  }
  return { pids, procs }
}

/**
 * Every pid between us and the root of the tree. `npm run dev` is itself a node
 * process, so without this a malformed pattern could point the script at its
 * own ancestry.
 */
function ancestorsOf(pid, byPid) {
  const seen = new Set()
  let cur = pid
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    cur = byPid.get(cur)?.ppid
  }
  return seen
}

function main() {
  let table
  try {
    table = process.platform === 'win32' ? enumerateWindows() : enumeratePosix()
  } catch (err) {
    // A failed enumeration must never be the reason dev does not start.
    if (VERBOSE || AS_JSON) {
      const message = `could not enumerate processes: ${err?.message ?? err}`
      console.log(AS_JSON ? JSON.stringify({ ok: false, error: message }) : `[dev-orphans] ${message}`)
    }
    return
  }

  const livePids = new Set(table.pids)
  const byPid = new Map(table.procs.map((p) => [p.pid, p]))
  const selfAndAncestors = ancestorsOf(process.pid, byPid)

  const orphans = []
  const skippedLiveParent = []

  for (const proc of table.procs) {
    if (!proc.cmd) continue
    if (selfAndAncestors.has(proc.pid)) continue

    const cmd = normalize(proc.cmd)
    if (!cmd.includes(ROOT_KEY)) continue
    if (!WORKER_ENTRY.test(proc.cmd)) continue

    // The whole safety argument: a live parent means a live session.
    if (livePids.has(proc.ppid)) {
      skippedLiveParent.push(proc)
      continue
    }
    orphans.push(proc)
  }

  const killed = []
  const failed = []
  if (!DRY_RUN) {
    for (const proc of orphans) {
      try {
        process.kill(proc.pid, 'SIGKILL')
        killed.push(proc.pid)
      } catch (err) {
        // Already gone, or not ours to kill. Either way, not fatal.
        if (err?.code !== 'ESRCH') failed.push({ pid: proc.pid, error: err?.message ?? String(err) })
      }
    }
  }

  if (AS_JSON) {
    console.log(
      JSON.stringify({
        ok: true,
        projectRoot: PROJECT_ROOT,
        dryRun: DRY_RUN,
        orphans: orphans.map((p) => ({ pid: p.pid, ppid: p.ppid, cmd: p.cmd })),
        killed,
        failed,
        skippedLiveParent: skippedLiveParent.map((p) => ({ pid: p.pid, ppid: p.ppid })),
      })
    )
    return
  }

  if (orphans.length === 0) {
    // Silence is the point: a clean start should look like a clean start.
    if (VERBOSE) {
      const held = skippedLiveParent.length
      console.log(
        `[dev-orphans] none found${held ? ` (${held} worker(s) left alone - parent still running)` : ''}`
      )
    }
    return
  }

  const verb = DRY_RUN ? 'would reap' : 'reaped'
  console.log(`[dev-orphans] ${verb} ${orphans.length} orphaned dev worker(s) from a previous session`)
  if (VERBOSE || DRY_RUN) {
    // Capped: a leaked pool is 19 workers and a bad session leaks several, so an
    // uncapped list buries the one line that matters under 200 pids. The dead
    // parent pids are the useful part - one per leaked session.
    const LIST_LIMIT = 8
    for (const p of orphans.slice(0, LIST_LIMIT)) console.log(`  pid ${p.pid} (dead parent ${p.ppid})`)
    if (orphans.length > LIST_LIMIT) {
      const parents = [...new Set(orphans.map((p) => p.ppid))]
      console.log(
        `  ... and ${orphans.length - LIST_LIMIT} more, from ${parents.length} dead parent(s): ${parents.join(', ')}`
      )
    }
    if (skippedLiveParent.length) {
      console.log(`  left alone: ${skippedLiveParent.length} worker(s) whose parent is still running`)
    }
  }
  if (failed.length) {
    console.log(`[dev-orphans] ${failed.length} could not be terminated; left in place`)
  }
}

try {
  main()
} catch (err) {
  // Last line of defence. This hook is never worth a failed dev start.
  if (VERBOSE) console.log(`[dev-orphans] skipped: ${err?.message ?? err}`)
}

process.exit(0)
