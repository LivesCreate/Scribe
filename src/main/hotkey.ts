import { globalShortcut } from 'electron'
import type { HotkeyStatus, Settings } from '@shared/types'
import { ComboTracker } from './comboTracker'

export interface HotkeyEvents {
  onPressStart: () => void
  onPressEnd: () => void
  /** Toggle mode: one event flips listening on/off. */
  onToggle: () => void
}

export interface CapturedCombo {
  keycodes: number[]
  label: string
}

type Uiohook = typeof import('uiohook-napi').uIOhook

/** Friendly names for uiohook keycodes, derived from the UiohookKey map. */
function buildKeyNames(): Map<number, string> {
  const names = new Map<number, string>()
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { UiohookKey } = require('uiohook-napi') as typeof import('uiohook-napi')
    const pretty: Record<string, string> = {
      Ctrl: 'Ctrl',
      CtrlRight: 'Right Ctrl',
      Shift: 'Shift',
      ShiftRight: 'Right Shift',
      Alt: 'Alt',
      AltRight: 'Right Alt',
      Meta: 'Win',
      MetaRight: 'Right Win',
      Space: 'Space',
      Escape: 'Esc',
      CapsLock: 'Caps Lock'
    }
    for (const [name, code] of Object.entries(UiohookKey)) {
      if (typeof code === 'number' && !names.has(code)) {
        names.set(code, pretty[name] ?? name)
      }
    }
  } catch {
    // uiohook unavailable: labels fall back to raw keycodes
  }
  return names
}

/**
 * Owns all global-hotkey behavior:
 *  - hold mode: low-level uiohook hook, multi-key combos (e.g. Ctrl + Win)
 *  - toggle mode: Electron globalShortcut accelerator
 *  - live re-apply when settings change (no app restart)
 *  - capture mode: record the next combo the user presses, for rebinding
 */
export class HotkeyManager {
  mode: 'hold' | 'toggle' = 'toggle'
  private uio: Uiohook | null = null
  private hookStarted = false
  private hookError: string | null = null
  private holdLabel = ''
  private toggleAccel = ''
  private requestedMode: 'hold' | 'toggle' = 'toggle'
  private tracker = new ComboTracker([])
  private events: HotkeyEvents
  private registeredAccelerator: string | null = null
  private keyNames = buildKeyNames()
  private capture: {
    collected: number[]
    resolve: (combo: CapturedCombo | null) => void
    timer: NodeJS.Timeout
  } | null = null

  constructor(settings: Settings, events: HotkeyEvents) {
    this.events = events
    this.apply(settings)
  }

  /** Applies (or re-applies) hotkey settings immediately. */
  apply(settings: Settings): void {
    if (this.registeredAccelerator !== null) {
      globalShortcut.unregister(this.registeredAccelerator)
      this.registeredAccelerator = null
    }
    this.holdLabel = settings.holdKeyLabel
    this.toggleAccel = settings.toggleAccelerator
    this.requestedMode = settings.hotkeyMode

    if (settings.hotkeyMode === 'hold' && this.ensureHook()) {
      this.mode = 'hold'
      this.tracker.setTarget(settings.holdKeycodes)
      return
    }

    this.mode = 'toggle'
    this.tracker.setTarget([])
    const ok = globalShortcut.register(settings.toggleAccelerator, this.events.onToggle)
    if (ok) this.registeredAccelerator = settings.toggleAccelerator
    else console.error(`[hotkey] failed to register accelerator ${settings.toggleAccelerator}`)
  }

  /** Truthful diagnostics for the Settings page — never guess, report what is armed. */
  getStatus(): Omit<HotkeyStatus, 'lastEventType' | 'lastEventAt'> {
    if (this.mode === 'hold') {
      if (this.hookStarted) {
        return { mode: 'hold', active: true, detail: `Armed — hold ${this.holdLabel} to dictate.` }
      }
      return {
        mode: 'hold',
        active: false,
        detail: `Keyboard hook failed to start${this.hookError !== null ? ` (${this.hookError})` : ''} — hold mode cannot work.`
      }
    }
    if (this.registeredAccelerator !== null) {
      const fellBack = this.requestedMode === 'hold'
      return {
        mode: 'toggle',
        active: true,
        detail: fellBack
          ? `Hold mode unavailable (keyboard hook failed${this.hookError !== null ? `: ${this.hookError}` : ''}) — fell back to toggle: press ${this.registeredAccelerator}.`
          : `Armed — press ${this.registeredAccelerator} to start/stop.`
      }
    }
    return {
      mode: 'toggle',
      active: false,
      detail: `Windows refused the shortcut ${this.toggleAccel} — another app may already own it. Pick a different combo.`
    }
  }

  /**
   * Records the next key combo: collects every key that goes down until the
   * first key is released, then resolves. Null on timeout.
   */
  captureCombo(timeoutMs = 6000): Promise<CapturedCombo | null> {
    if (!this.ensureHook()) return Promise.resolve(null)
    if (this.capture) {
      clearTimeout(this.capture.timer)
      this.capture.resolve(null)
      this.capture = null
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.capture) {
          const { collected } = this.capture
          this.capture = null
          resolve(collected.length > 0 ? this.toCombo(collected) : null)
        }
      }, timeoutMs)
      this.capture = { collected: [], resolve, timer }
    })
  }

  labelFor(keycodes: number[]): string {
    return keycodes.map((c) => this.keyNames.get(c) ?? `Key ${c}`).join(' + ')
  }

  dispose(): void {
    if (this.registeredAccelerator !== null) globalShortcut.unregister(this.registeredAccelerator)
    if (this.uio && this.hookStarted) {
      this.uio.removeAllListeners()
      this.uio.stop()
      this.hookStarted = false
    }
  }

  private toCombo(collected: number[]): CapturedCombo {
    return { keycodes: collected, label: this.labelFor(collected) }
  }

  private ensureHook(): boolean {
    if (this.hookStarted) return true
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { uIOhook } = require('uiohook-napi') as typeof import('uiohook-napi')
      this.uio = uIOhook
      uIOhook.on('keydown', (e) => this.onKeyDown(e.keycode))
      uIOhook.on('keyup', (e) => this.onKeyUp(e.keycode))
      uIOhook.start()
      this.hookStarted = true
      return true
    } catch (err) {
      this.hookError = err instanceof Error ? err.message : String(err)
      console.error('[hotkey] uiohook-napi unavailable, falling back to toggle mode:', err)
      return false
    }
  }

  private onKeyDown(code: number): void {
    if (this.capture) {
      if (!this.capture.collected.includes(code)) this.capture.collected.push(code)
      return
    }
    if (this.mode === 'hold' && this.tracker.keyDown(code) === 'start') {
      this.events.onPressStart()
    }
  }

  private onKeyUp(code: number): void {
    if (this.capture) {
      clearTimeout(this.capture.timer)
      const { collected, resolve } = this.capture
      this.capture = null
      resolve(collected.length > 0 ? this.toCombo(collected) : null)
      return
    }
    if (this.mode === 'hold' && this.tracker.keyUp(code) === 'end') {
      this.events.onPressEnd()
    }
  }
}
