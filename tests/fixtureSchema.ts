/** Shared fixture types used by both the schema test and the live suite. */
export interface FixtureCriteria {
  mustContain?: string[]
  mustContain2?: string[]
  mustNotContain?: string[]
  mustMatch?: string[]
  mustNotMatch?: string[]
  startsCapitalized?: boolean
  endsWithTerminalPunctuation?: boolean
  noTrailingPeriod?: boolean
  listMustTerminate?: boolean
  minParagraphs?: number
  maxLength?: number
}

export interface CleanupFixture {
  id: string
  category: string
  description: string
  style: 'professional' | 'casual' | 'messaging'
  dictionary: { term: string; hint: string }[] | []
  input: string
  match: 'exact' | 'criteria'
  expected?: string
  criteria?: FixtureCriteria
}

export interface FixtureFile {
  version: number
  notes: string
  fixtures: CleanupFixture[]
}

/** Asserts a cleaned output against a fixture. Returns failure reasons. */
export function checkFixture(fixture: CleanupFixture, output: string): string[] {
  const failures: string[] = []
  const out = output.trim()

  if (fixture.match === 'exact') {
    if (out !== fixture.expected?.trim()) {
      failures.push(`exact mismatch:\n--- expected ---\n${fixture.expected}\n--- got ---\n${out}`)
    }
    return failures
  }

  const c = fixture.criteria
  if (!c) return ['criteria fixture missing criteria']

  for (const s of [...(c.mustContain ?? []), ...(c.mustContain2 ?? [])]) {
    if (!out.includes(s)) failures.push(`missing required substring: "${s}"`)
  }
  for (const s of c.mustNotContain ?? []) {
    if (out.includes(s)) failures.push(`contains banned substring: "${s}"`)
  }
  for (const p of c.mustMatch ?? []) {
    if (!new RegExp(p, 'm').test(out)) failures.push(`does not match required pattern: /${p}/m`)
  }
  for (const p of c.mustNotMatch ?? []) {
    if (new RegExp(p, 'm').test(out)) failures.push(`matches banned pattern: /${p}/m`)
  }
  if (c.startsCapitalized && !/^[A-Z"']/.test(out)) failures.push('does not start capitalized')
  if (c.endsWithTerminalPunctuation && !/[.!?]$/.test(out)) failures.push('does not end with terminal punctuation')
  if (c.noTrailingPeriod && /\.$/.test(out)) failures.push('ends with a trailing period (messaging style)')
  if (c.minParagraphs !== undefined) {
    const paragraphs = out.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
    if (paragraphs.length < c.minParagraphs)
      failures.push(`expected >= ${c.minParagraphs} paragraphs, got ${paragraphs.length}`)
  }
  if (c.maxLength !== undefined && out.length > c.maxLength) {
    failures.push(`output too long: ${out.length} > ${c.maxLength}`)
  }
  if (c.listMustTerminate) {
    // The last non-empty line must be prose, not a list item.
    const lines = out.split('\n').filter((l) => l.trim().length > 0)
    const last = lines[lines.length - 1] ?? ''
    if (/^(\d+\.|[-•])\s/.test(last.trim())) failures.push('list does not terminate back into prose')
  }
  return failures
}
