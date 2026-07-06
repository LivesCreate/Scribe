/**
 * Pure push-to-talk combo tracking: the combo activates when every target
 * key is held simultaneously and deactivates when any of them is released.
 * Kept free of uiohook/Electron imports so it is unit-testable.
 */
export class ComboTracker {
  private pressed = new Set<number>()
  private active = false

  constructor(private target: number[]) {}

  setTarget(codes: number[]): void {
    this.target = codes
    this.pressed.clear()
    this.active = false
  }

  /** Returns 'start' when this keydown completes the combo. */
  keyDown(code: number): 'start' | null {
    this.pressed.add(code)
    if (!this.active && this.target.length > 0 && this.target.every((k) => this.pressed.has(k))) {
      this.active = true
      return 'start'
    }
    return null
  }

  /** Returns 'end' when a combo key is released while the combo is active. */
  keyUp(code: number): 'end' | null {
    this.pressed.delete(code)
    if (this.active && this.target.includes(code)) {
      this.active = false
      return 'end'
    }
    return null
  }
}
