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
 * Max gap between the two taps of a double-tap. Measured between combo
 * completions, so a two-key combo (Ctrl + Win) eats real time just being
 * pressed — 650ms lands reliably for humans without inviting stray doubles.
 */
const DOUBLE_TAP_MS = 650

/**
 * Owns all global-hotkey behavior. There are exactly two user-facing modes,
 * both built on the same captured combo (e.g. Ctrl + Win):
 *  - hold mode: hold the combo to talk, release to stop.
 *  - doubletap mode: double-tap the combo to start; double-tap again to stop.
 * Both are driven by the low-level uiohook keyboard hook. If that hook cannot
 * start, we fall back to a single Electron globalShortcut accelerator that
 * toggles on one press (degraded, but better than a dead shortcut), and say so.
 */
export class HotkeyManager {
  mode: 'hold' | 'doubletap' = 'hold'
  private uio: Uiohook | null = null
  private hookStarted = false
  private hookError: string | null = null
  private holdLabel = ''
  private toggleAccel = ''
  private usingHook = false
  private lastComboStart = 0
  private listening = false
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
    this.mode = settings.hotkeyMode
    this.lastComboStart = 0

    // Both modes run on the keyboard hook, keyed off the same captured combo.
    if (this.ensureHook()) {
      this.usingHook = true
      this.tracker.setTarget(settings.holdKeycodes)
      return
    }

    // Hook unavailable: degrade to a single-press accelerator toggle.
    this.usingHook = false
    this.tracker.setTarget([])
    const ok = globalShortcut.register(settings.toggleAccelerator, this.events.onToggle)
    if (ok) this.registeredAccelerator = settings.toggleAccelerator
    else console.error(`[hotkey] failed to register accelerator ${settings.toggleAccelerator}`)
  }

  /** Truthful diagnostics for the Settings page — never guess, report what is armed. */
  getStatus(): Omit<HotkeyStatus, 'lastEventType' | 'lastEventAt'> {
    if (this.usingHook && this.hookStarted) {
      return this.mode === 'hold'
        ? { mode: 'hold', active: true, detail: `Armed — hold ${this.holdLabel} to dictate.` }
        : {
            mode: 'doubletap',
            active: true,
            detail: `Armed — double-tap ${this.holdLabel} to start, double-tap again to stop.`
          }
    }
    if (this.registeredAccelerator !== null) {
      return {
        mode: this.mode,
        active: true,
        detail: `Keyboard hook unavailable${this.hookError !== null ? ` (${this.hookError})` : ''} — fell back to a single shortcut: press ${this.registeredAccelerator} to start/stop.`
      }
    }
    return {
      mode: this.mode,
      active: false,
      detail: `The keyboard hook could not start${this.hookError !== null ? ` (${this.hookError})` : ''} and Windows refused the fallback shortcut ${this.toggleAccel}.`
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
    if (this.tracker.keyDown(code) !== 'start') return
    if (this.mode === 'hold') {
      this.events.onPressStart()
      return
    }
    // doubletap: it takes a double-tap to START (so a stray press never begins
    // a dictation), but only a SINGLE tap to STOP once you're already recording
    // — tap once and Scribe finalizes and cleans up. (Wispr-style.)
    if (this.listening) {
      this.lastComboStart = 0
      this.events.onToggle()
      return
    }
    const now = Date.now()
    if (now - this.lastComboStart <= DOUBLE_TAP_MS) {
      this.lastComboStart = 0
      this.events.onToggle()
    } else {
      this.lastComboStart = now
    }
  }

  /** Main tells us when a dictation is live, so doubletap can stop on one tap. */
  setListening(active: boolean): void {
    this.listening = active
    if (!active) this.lastComboStart = 0
  }

  private onKeyUp(code: number): void {
    if (this.capture) {
      clearTimeout(this.capture.timer)
      const { collected, resolve } = this.capture
      this.capture = null
      resolve(collected.length > 0 ? this.toCombo(collected) : null)
      return
    }
    // keyUp always feeds the tracker so the combo can re-activate on the next
    // press (needed for both the hold release and the second double-tap).
    if (this.tracker.keyUp(code) === 'end' && this.mode === 'hold') {
      this.events.onPressEnd()
    }
  }
}
