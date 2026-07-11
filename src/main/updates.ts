import { app, dialog, shell } from 'electron'
import type { UpdateStatus } from '@shared/types'
import type { ScribeStore } from './db'

/**
 * Launch-time update logic (privacy-respecting: one anonymous GET to the
 * public GitHub releases API, no telemetry, nothing sent):
 *  1. checkForUpdates() — compares the running version to the newest GitHub
 *     release tag and caches an UpdateStatus the UI can show.
 *  2. guardAgainstDowngrade() — remembers the highest version ever run and
 *     warns when an older installer has overwritten a newer app.
 */

const RELEASES_API = 'https://api.github.com/repos/LivesCreate/Scribe/releases/latest'
const RELEASES_PAGE = 'https://github.com/LivesCreate/Scribe/releases'

let cached: UpdateStatus = {
  state: 'checking',
  currentVersion: app.getVersion(),
  latestVersion: null,
  url: null,
  checkedAt: null
}

export function getUpdateStatus(): UpdateStatus {
  return cached
}

/** a < b for MAJOR.MINOR.PATCH strings. */
export function versionLessThan(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const current = app.getVersion()
  cached = { ...cached, state: 'checking', currentVersion: current }
  try {
    const res = await fetch(RELEASES_API, {
      headers: { accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000)
    })
    if (res.status === 404) {
      // Repo has no releases yet — normal for a project published without tags.
      cached = { state: 'no-releases', currentVersion: current, latestVersion: null, url: null, checkedAt: Date.now() }
      return cached
    }
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = (data.tag_name ?? '').replace(/^v/i, '')
    if (latest.length === 0) throw new Error('release has no tag')
    cached = {
      state: versionLessThan(current, latest) ? 'available' : 'current',
      currentVersion: current,
      latestVersion: latest,
      url: data.html_url ?? RELEASES_PAGE,
      checkedAt: Date.now()
    }
  } catch {
    cached = { state: 'offline', currentVersion: current, latestVersion: null, url: null, checkedAt: Date.now() }
  }
  return cached
}

/**
 * Detects an accidental downgrade: if the version now running is LOWER than
 * the highest version this profile has ever run (someone launched an old
 * "Scribe Setup x.y.z.exe"), say so plainly and point at the newest release.
 */
export function guardAgainstDowngrade(store: ScribeStore): void {
  const current = app.getVersion()
  const highest = store.getSettings().highestVersionRun
  if (versionLessThan(current, highest)) {
    void dialog
      .showMessageBox({
        type: 'warning',
        title: 'Scribe was downgraded',
        message: `This is Scribe ${current}, but ${highest} was installed before.`,
        detail:
          'An older installer was probably run by mistake. Your data is untouched, but you are missing newer fixes. Get the latest version from the releases page.',
        buttons: ['Open releases page', 'Keep using this version'],
        defaultId: 0,
        cancelId: 1
      })
      .then((r) => {
        if (r.response === 0) void shell.openExternal(RELEASES_PAGE)
      })
  } else if (versionLessThan(highest, current)) {
    store.setSettings({ highestVersionRun: current })
  }
}
