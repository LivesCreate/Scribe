import { describe, expect, it } from 'vitest'
import { ComboTracker } from '../src/main/comboTracker'

const CTRL = 29
const WIN = 3675
const A = 30

describe('ComboTracker', () => {
  it('fires start/end for a single-key binding', () => {
    const t = new ComboTracker([CTRL])
    expect(t.keyDown(CTRL)).toBe('start')
    expect(t.keyUp(CTRL)).toBe('end')
  })

  it('fires start only when every combo key is held', () => {
    const t = new ComboTracker([CTRL, WIN])
    expect(t.keyDown(CTRL)).toBeNull()
    expect(t.keyDown(WIN)).toBe('start')
  })

  it('fires end when any combo key is released', () => {
    const t = new ComboTracker([CTRL, WIN])
    t.keyDown(CTRL)
    t.keyDown(WIN)
    expect(t.keyUp(CTRL)).toBe('end')
    expect(t.keyUp(WIN)).toBeNull() // already ended
  })

  it('ignores unrelated keys entirely', () => {
    const t = new ComboTracker([CTRL])
    expect(t.keyDown(A)).toBeNull()
    expect(t.keyUp(A)).toBeNull()
    expect(t.keyDown(CTRL)).toBe('start')
    expect(t.keyUp(A)).toBeNull()
    expect(t.keyUp(CTRL)).toBe('end')
  })

  it('does not re-fire start while held', () => {
    const t = new ComboTracker([CTRL])
    expect(t.keyDown(CTRL)).toBe('start')
    expect(t.keyDown(CTRL)).toBeNull()
  })

  it('setTarget resets state', () => {
    const t = new ComboTracker([CTRL])
    t.keyDown(CTRL)
    t.setTarget([WIN])
    expect(t.keyUp(CTRL)).toBeNull()
    expect(t.keyDown(WIN)).toBe('start')
  })

  it('never fires with an empty target', () => {
    const t = new ComboTracker([])
    expect(t.keyDown(CTRL)).toBeNull()
    expect(t.keyUp(CTRL)).toBeNull()
  })
})
