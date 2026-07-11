import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, session, Tray } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { DebugInfo, DisplayInfo, Settings } from '@shared/types'
import { IPC } from '@shared/types'
import { ScribeStateMachine } from '@shared/stateMachine'
import { createStore, type ScribeStore } from './db'
import { extractCorrections } from './corrections'
import { downloadSttModel, getSystemStatus } from './status'
import { checkForUpdates, getUpdateStatus, guardAgainstDowngrade } from './updates'
import { runFirstRunBenchmark } from './benchmark'
import { bridgeUrl, startBridge, stopBridge } from './bridge'
import { firewallBlocked, fixFirewall } from './firewall'
import { listOllamaModels, warmUpCleanupModel } from './cleanup'
import { buildDataSnapshot, organizeSnapshot } from './dataView'
import { createDebugWindow, createMainWindow, createOverlayWindow, positionOverlay } from './windows'
import { HotkeyManager } from './hotkey'
import { runPipeline } from './pipeline'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

// Launching Scribe while it's already running must surface the window,
// not silently exit the second instance.
app.on('second-instance', () => {
  if (mainWin !== null && !mainWin.isDestroyed()) {
    mainWin.show()
    mainWin.focus()
  }
})

const machine = new ScribeStateMachine()
let overlay: BrowserWindow | null = null
let mainWin: BrowserWindow | null = null
let debugWin: BrowserWindow | null = null
let hotkeys: HotkeyManager | null = null
let tray: Tray | null = null
let currentStore: ScribeStore | null = null
let quitting = false
let recordingStartedAt = 0
let lastHotkeyEvent: { type: 'start' | 'end' | 'toggle'; at: number } | null = null

/** Recent events for the debug console — capped, in-memory, never persisted. */
const debugLog: { at: number; line: string }[] = []
function logDebug(line: string): void {
  debugLog.push({ at: Date.now(), line })
  if (debugLog.length > 200) debugLog.shift()
}

function noteHotkeyEvent(type: 'start' | 'end' | 'toggle'): void {
  lastHotkeyEvent = { type, at: Date.now() }
  logDebug(`hotkey ${type}`)
  broadcast(IPC.hotkeyEvent, lastHotkeyEvent)
}

function findIcon(size: 16 | 32 | 256): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', `icon-${size}.png`),
    join(app.getAppPath(), 'resources', `icon-${size}.png`),
    join(app.getAppPath(), '..', '..', 'resources', `icon-${size}.png`)
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

// Safety net for toggle mode: nobody dictates for this long in one breath —
// auto-stop instead of recording (and buffering) forever if the user forgot.
const MAX_RECORDING_MS = 10 * 60 * 1000
let recordingCapTimer: NodeJS.Timeout | null = null

function startListening(): void {
  if (machine.state !== 'idle' && machine.state !== 'done' && machine.state !== 'error') return
  if (machine.state !== 'idle') machine.reset()
  recordingStartedAt = Date.now()
  machine.transition('listening')
  if (overlay !== null && !overlay.isDestroyed()) {
    positionOverlay(overlay, currentStore?.getSettings().overlayDisplayId ?? null)
    overlay.showInactive()
  }
  // Capture runs in the MAIN window: the frameless, non-focusable, transparent
  // overlay cannot start an audio source (Chromium AbortError). The main
  // window is a normal renderer and captures reliably, even when hidden.
  mainWin?.webContents.send(IPC.startRecording)
  if (recordingCapTimer !== null) clearTimeout(recordingCapTimer)
  recordingCapTimer = setTimeout(stopListening, MAX_RECORDING_MS)
}

function stopListening(): void {
  if (recordingCapTimer !== null) {
    clearTimeout(recordingCapTimer)
    recordingCapTimer = null
  }
  if (machine.state !== 'listening') return
  mainWin?.webContents.send(IPC.stopRecording)
  // renderer replies with IPC.audioCaptured carrying the WAV buffer
}

function toggleListening(): void {
  if (machine.state === 'listening') stopListening()
  else startListening()
}

app.whenReady().then(() => {
  const store = createStore()
  currentStore = store
  console.log(`[scribe] store backend: ${store.backend}`)

  // Update hygiene: warn if an older installer overwrote a newer app, then
  // quietly ask GitHub for the newest release (result surfaces in Settings).
  guardAgainstDowngrade(store)
  void checkForUpdates().then((u) => logDebug(`update check: ${u.state}${u.latestVersion ? ` (latest ${u.latestVersion})` : ''}`))

  // Grant microphone to our own renderers. Everything is local and offline;
  // without this, getUserMedia in the frameless overlay can be denied.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media'
  })

  overlay = createOverlayWindow()
  mainWin = createMainWindow()
  // Closing the main window hides it; Scribe keeps listening from the tray.
  mainWin.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWin?.hide()
    }
  })

  const trayIconPath = findIcon(16) ?? findIcon(32)
  if (trayIconPath !== null) {
    tray = new Tray(nativeImage.createFromPath(trayIconPath))
    tray.setToolTip('Scribe — private dictation')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Scribe', click: () => mainWin?.show() },
        { label: 'Start/stop dictation', click: () => toggleListening() },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            quitting = true
            app.quit()
          }
        }
      ])
    )
    tray.on('double-click', () => mainWin?.show())
  }

  machine.onChange((state, detail) => {
    broadcast(IPC.stateChanged, { state, detail })
    logDebug(`state: ${state}${detail !== undefined ? ` — ${detail}` : ''}`)
    // Let doubletap mode know a dictation is live: start needs a double-tap,
    // but stopping takes just one tap while listening.
    hotkeys?.setListening(state === 'listening')
    if (state === 'idle') overlay?.hide()
    if (state === 'done') {
      setTimeout(() => {
        if (machine.state === 'done') machine.transition('idle')
      }, 900)
    }
    if (state === 'error') {
      setTimeout(() => {
        if (machine.state === 'error') machine.reset()
      }, 3500)
    }
  })

  // Dev hook: force the first-run benchmark to run again.
  if (process.env['SCRIBE_REBENCH'] === '1') store.setSettings({ benchmarked: false })
  void runFirstRunBenchmark(store)
  startBridge(store)
  if (store.getSettings().cleanupEnabled) warmUpCleanupModel(store.getSettings().cleanupModel)

  const settings = store.getSettings()
  hotkeys = new HotkeyManager(settings, {
    onPressStart: () => {
      noteHotkeyEvent('start')
      startListening()
    },
    onPressEnd: () => {
      noteHotkeyEvent('end')
      stopListening()
    },
    onToggle: () => {
      noteHotkeyEvent('toggle')
      toggleListening()
    }
  })
  console.log(`[scribe] hotkey mode: ${hotkeys.mode}`)
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, path: process.execPath })

  // --- IPC ---
  ipcMain.handle(IPC.getSettings, () => store.getSettings())
  ipcMain.handle(IPC.setSettings, (_e, patch: Partial<Settings>) => {
    const next = store.setSettings(patch)
    if ('bridgeEnabled' in patch || 'bridgePort' in patch) {
      if (next.bridgeEnabled) startBridge(store)
      else stopBridge()
    }
    if ('hotkeyMode' in patch || 'holdKeycodes' in patch || 'toggleAccelerator' in patch) {
      hotkeys?.apply(next)
    }
    if ('launchAtLogin' in patch) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, path: process.execPath })
    }
    if ('overlayDisplayId' in patch && overlay !== null && !overlay.isDestroyed()) {
      // Reposition immediately, and briefly preview the overlay so the user sees
      // where it will now appear.
      positionOverlay(overlay, next.overlayDisplayId)
      if (machine.state === 'idle') {
        overlay.showInactive()
        overlay.webContents.send(IPC.overlayPreview)
        setTimeout(() => {
          if (machine.state === 'idle') overlay?.hide()
        }, 1400)
      }
    }
    return next
  })
  ipcMain.handle(IPC.getDisplays, (): DisplayInfo[] => {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      primary: d.id === primaryId,
      label: `Monitor ${i + 1} — ${d.size.width}×${d.size.height}`
    }))
  })
  ipcMain.handle(IPC.getDebugInfo, async (): Promise<DebugInfo> => {
    const s = store.getSettings()
    const primaryId = screen.getPrimaryDisplay().id
    return {
      version: app.getVersion(),
      platform: `${process.platform} · Electron ${process.versions.electron} · Node ${process.versions.node}`,
      system: await getSystemStatus(s.sttModel, s.cleanupModel),
      hotkey: {
        ...(hotkeys?.getStatus() ?? { mode: 'hold' as const, active: false, detail: 'Hotkeys not initialized.' }),
        lastEventType: lastHotkeyEvent?.type ?? null,
        lastEventAt: lastHotkeyEvent?.at ?? null
      },
      settings: { ...s, cloudApiKey: s.cloudApiKey ? '(set)' : '(none)', bridgeToken: s.bridgeToken ? '(set)' : '(none)' },
      storageBackend: store.backend,
      displays: screen.getAllDisplays().map((d, i) => ({
        id: d.id,
        primary: d.id === primaryId,
        label: `Monitor ${i + 1} — ${d.size.width}×${d.size.height}`
      })),
      log: [...debugLog].reverse()
    }
  })
  ipcMain.handle(IPC.getUpdateStatus, () => getUpdateStatus())
  ipcMain.handle(IPC.checkForUpdates, () => checkForUpdates())
  ipcMain.handle(IPC.openDebugWindow, () => {
    if (debugWin !== null && !debugWin.isDestroyed()) {
      debugWin.show()
      debugWin.focus()
      return
    }
    debugWin = createDebugWindow()
    debugWin.on('closed', () => {
      debugWin = null
    })
  })
  ipcMain.handle(IPC.captureHoldKeys, () => hotkeys?.captureCombo() ?? null)
  ipcMain.handle(IPC.getHotkeyStatus, () => ({
    ...(hotkeys?.getStatus() ?? { mode: 'hold' as const, active: false, detail: 'Hotkeys not initialized.' }),
    lastEventType: lastHotkeyEvent?.type ?? null,
    lastEventAt: lastHotkeyEvent?.at ?? null
  }))
  ipcMain.handle(IPC.getBridgeUrl, () => bridgeUrl(store))
  ipcMain.handle(IPC.getBridgeStatus, async () => ({
    url: bridgeUrl(store),
    firewallBlocked: store.getSettings().bridgeEnabled ? await firewallBlocked() : false
  }))
  ipcMain.handle(IPC.fixFirewall, () => fixFirewall())
  ipcMain.handle(IPC.listOllamaModels, () => listOllamaModels())
  ipcMain.handle(IPC.getDataSnapshot, () => buildDataSnapshot(store))
  ipcMain.handle(IPC.organizeData, () => organizeSnapshot(store))
  ipcMain.handle(IPC.getHistory, (_e, limit: number) => store.getHistory(limit ?? 50))
  ipcMain.handle(IPC.getDictionary, () => store.getDictionary())
  ipcMain.handle(IPC.addDictionaryTerm, (_e, term: string, hint: string | null) =>
    store.addDictionaryTerm(term, hint, 'manual')
  )
  ipcMain.handle(IPC.updateDictionaryTerm, (_e, id: number, term: string, hint: string | null) =>
    store.updateDictionaryTerm(id, term, hint)
  )
  ipcMain.handle(IPC.removeDictionaryTerm, (_e, id: number) => store.removeDictionaryTerm(id))
  ipcMain.handle(IPC.deleteAllData, () => store.deleteAllData())
  ipcMain.handle(IPC.getSystemStatus, async () => {
    const s = store.getSettings()
    return getSystemStatus(s.sttModel, s.cleanupModel)
  })
  ipcMain.handle(IPC.downloadSttModel, async (_e, name: string) => {
    return downloadSttModel(name, (pct) => broadcast(IPC.modelDownloadProgress, { name, pct }))
  })
  ipcMain.handle(IPC.updateHistoryEntry, (_e, id: number, newCleanText: string) => {
    const entry = store.getHistoryEntry(id)
    if (!entry) return { learned: [] }
    const corrections = extractCorrections(entry.cleanText, newCleanText)
    store.updateHistoryCleanText(id, newCleanText)
    const learned: string[] = []
    for (const c of corrections) {
      store.addDictionaryTerm(c.term, `corrected from "${c.replaced}"`, 'auto-correction')
      learned.push(c.term)
    }
    return { learned }
  })

  ipcMain.on(IPC.micLevel, (_e, level: number) => {
    overlay?.webContents.send(IPC.micLevel, level)
  })

  // The overlay could not open the microphone: tell the user instead of
  // sitting silently in the listening state.
  ipcMain.on(IPC.micError, (_e, message: string) => {
    logDebug(`mic error: ${message}`)
    try {
      require('node:fs').appendFileSync(
        join(app.getPath('userData'), 'mic-error.log'),
        `${new Date().toISOString()} ${message}\n`
      )
    } catch {
      /* logging is best-effort */
    }
    if (machine.state === 'listening') {
      machine.transition('error', message)
    }
  })

  // Dev/test hook: feed a WAV file straight into the pipeline, bypassing
  // the mic. Used by the automated insertion test; harmless in production.
  const testWav = process.env['SCRIBE_TEST_WAV']
  if (testWav !== undefined && testWav.length > 0) {
    setTimeout(() => {
      void import('node:fs/promises').then(async (fs) => {
        const wav = await fs.readFile(testWav)
        recordingStartedAt = Date.now()
        machine.transition('listening')
        await runPipeline({
          wav,
          store,
          machine,
          startedAt: recordingStartedAt,
          onTranscript: (raw, clean) => broadcast(IPC.transcriptReady, { raw, clean })
        })
        console.log('[scribe] test pipeline complete')
      })
    }, 2500)
  }

  ipcMain.on(IPC.audioCaptured, (_e, wav: ArrayBuffer) => {
    void runPipeline({
      wav: Buffer.from(wav),
      store,
      machine,
      startedAt: recordingStartedAt,
      onTranscript: (raw, clean) => broadcast(IPC.transcriptReady, { raw, clean })
    })
  })
})

app.on('will-quit', () => {
  hotkeys?.dispose()
  stopBridge()
})

app.on('before-quit', () => {
  quitting = true
})

app.on('window-all-closed', () => {
  // Tray-style utility: keep running for the hotkey even with windows closed.
  // (Overlay is hidden, not closed, so this fires only if main window closes
  // and overlay is destroyed — quit then.)
  if (overlay === null || overlay.isDestroyed()) app.quit()
})
