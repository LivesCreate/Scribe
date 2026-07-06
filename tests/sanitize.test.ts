import { describe, expect, it } from 'vitest'
import { sanitizeModelOutput } from '../src/main/cleanupPrompt'

describe('sanitizeModelOutput', () => {
  it('strips think tags', () => {
    expect(sanitizeModelOutput('<think>reasoning here</think>\nClean text.')).toBe('Clean text.')
  })

  it('strips orphaned reasoning that ends with a closing think tag', () => {
    expect(sanitizeModelOutput('I should add a period.\n</think>\nClean text.')).toBe('Clean text.')
  })

  it('rescues a boxed final answer from narration', () => {
    expect(
      sanitizeModelOutput('The disfluency is removed.\n\n\\boxed{Hey, are we still on for lunch?}')
    ).toBe('Hey, are we still on for lunch?')
  })

  it('strips code fences', () => {
    expect(sanitizeModelOutput('```\nClean text.\n```')).toBe('Clean text.')
  })

  it('strips whole-output quotes', () => {
    expect(sanitizeModelOutput('"Clean text."')).toBe('Clean text.')
  })

  it('keeps interior quotes', () => {
    expect(sanitizeModelOutput('She said "hello" to me.')).toBe('She said "hello" to me.')
  })

  it('passes through normal multi-paragraph output', () => {
    const text = 'Para one.\n\nPara two.'
    expect(sanitizeModelOutput(text)).toBe(text)
  })
})
