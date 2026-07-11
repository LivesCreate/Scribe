import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'

// Sized with generous slack around the pill so its ambient glow and the
// levitation shadow beneath it never clip against the transparent window edge.
const OVERLAY_WIDTH = 440
const OVERLAY_HEIGHT = 150
const OVERLAY_MARGIN_BOTTOM = 90

function loadRenderer(win: BrowserWindow, hash: string): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

/**
 * Positions the overlay pill along the bottom-center of a chosen monitor.
 * Falls back to the primary display when the id is null or no longer present
 * (e.g. a monitor was unplugged).
 */
export function positionOverlay(win: BrowserWindow, displayId: number | null): void {
  const target =
    (displayId !== null ? screen.getAllDisplays().find((d) => d.id === displayId) : undefined) ??
    screen.getPrimaryDisplay()
  const { workArea } = target
  win.setBounds({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: workArea.x + Math.round((workArea.width - OVERLAY_WIDTH) / 2),
    y: workArea.y + workArea.height - OVERLAY_HEIGHT - OVERLAY_MARGIN_BOTTOM
  })
}

/**
 * The dictation overlay: small, frameless, transparent, always-on-top,
 * never steals focus (so the target app keeps the caret).
 */
export function createOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: workArea.x + Math.round((workArea.width - OVERLAY_WIDTH) / 2),
    y: workArea.y + workArea.height - OVERLAY_HEIGHT - OVERLAY_MARGIN_BOTTOM,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Display-only: the window is an invisible rectangle around the pill, and
  // without this it swallows every scroll/click over that area while shown.
  win.setIgnoreMouseEvents(true)
  loadRenderer(win, 'overlay')
  return win
}

/** The main app window: settings, dictionary, history, onboarding. */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  loadRenderer(win, 'main')
  return win
}

/** The debug console: a companion window showing live diagnostics. */
export function createDebugWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 720,
    height: 640,
    minWidth: 420,
    minHeight: 360,
    show: false,
    title: 'Scribe Debug',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.on('ready-to-show', () => win.show())
  // Keep the title distinct from the main window — the renderer's <title>
  // ("Scribe") must not overwrite it.
  win.on('page-title-updated', (e) => e.preventDefault())
  loadRenderer(win, 'debug')
  return win
}
