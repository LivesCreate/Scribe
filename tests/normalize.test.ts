import { describe, expect, it } from 'vitest'
import { applyStyleRules, normalizeListMarkers } from '../src/main/cleanup'

describe('normalizeListMarkers', () => {
  it('converts spelled-number markers to digit markers', () => {
    expect(normalizeListMarkers('One: cancel the internet\nTwo: transfer the electric')).toBe(
      '1. Cancel the internet\n2. Transfer the electric'
    )
  })

  it('converts ordinal-word markers', () => {
    expect(normalizeListMarkers('First: email the landlord')).toBe('1. Email the landlord')
  })

  it('leaves prose that merely contains a number word untouched', () => {
    const prose = 'One thing I know: this stays as-is.'
    expect(normalizeListMarkers(prose)).toBe(prose)
  })

  it('leaves correct digit lists untouched', () => {
    const list = '1. Milk\n2. Eggs'
    expect(normalizeListMarkers(list)).toBe(list)
  })
})

describe('applyStyleRules', () => {
  it('drops the trailing period in messaging style', () => {
    expect(applyStyleRules('hey, still on for lunch tomorrow? ramen place.', 'messaging')).toBe(
      'hey, still on for lunch tomorrow? ramen place'
    )
  })

  it('keeps trailing question marks in messaging style', () => {
    expect(applyStyleRules('are we still on?', 'messaging')).toBe('are we still on?')
  })

  it('does not touch professional style', () => {
    expect(applyStyleRules('Done by Friday.', 'professional')).toBe('Done by Friday.')
  })
})
