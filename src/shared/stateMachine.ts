import type { ScribeState } from './types'

/** Legal transitions for the dictation pipeline. */
const TRANSITIONS: Record<ScribeState, readonly ScribeState[]> = {
  idle: ['listening', 'error'],
  listening: ['thinking', 'idle', 'error'],
  thinking: ['inserting', 'error'],
  inserting: ['done', 'error'],
  done: ['idle', 'listening'],
  error: ['idle', 'listening']
}

export function canTransition(from: ScribeState, to: ScribeState): boolean {
  return TRANSITIONS[from].includes(to)
}

/**
 * Minimal observable state machine shared by main (authoritative) and
 * renderer (mirror). Throws on illegal transitions so pipeline bugs
 * surface immediately instead of leaving the overlay in a stuck state.
 */
export class ScribeStateMachine {
  private current: ScribeState = 'idle'
  private listeners = new Set<(s: ScribeState, detail?: string) => void>()

  get state(): ScribeState {
    return this.current
  }

  transition(to: ScribeState, detail?: string): void {
    if (to === this.current) {
      // Same-state detail update (e.g. progress notes while thinking).
      if (detail !== undefined) for (const fn of this.listeners) fn(to, detail)
      return
    }
    if (!canTransition(this.current, to)) {
      throw new Error(`Illegal state transition: ${this.current} -> ${to}`)
    }
    this.current = to
    for (const fn of this.listeners) fn(to, detail)
  }

  /** Force-reset to idle from any state (e.g. after an error was shown). */
  reset(): void {
    this.current = 'idle'
    for (const fn of this.listeners) fn('idle')
  }

  onChange(fn: (s: ScribeState, detail?: string) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
