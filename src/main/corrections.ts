/**
 * Auto-learn from corrections: when the user edits a past dictation's clean
 * text (in History), words they changed are candidate dictionary entries.
 * Honest limits (docs/DECISIONS.md): we cannot see edits made inside other
 * apps, so learning happens from edits made within Scribe.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'for',
  'with', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that',
  'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our'
])

export interface CorrectionCandidate {
  term: string
  replaced: string
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).map((t) => t.replace(/^[^\w'-]+|[^\w'-]+$/g, '')).filter((t) => t.length > 0)
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0] as number
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j] as number
      dp[j] = Math.min(
        (dp[j] as number) + 1,
        (dp[j - 1] as number) + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      prev = tmp
    }
  }
  return dp[n] as number
}

/**
 * Diffs the original clean text against the user's edited version and
 * returns words that look like deliberate spelling/casing corrections:
 * aligned token replacements that are similar (small edit distance) —
 * i.e. "Glimwik" -> "Glimwick" — not wholesale rewrites.
 */
export function extractCorrections(original: string, edited: string): CorrectionCandidate[] {
  const a = tokenize(original)
  const b = tokenize(edited)
  const candidates: CorrectionCandidate[] = []

  // Walk both token streams with a simple anchor-based alignment: equal
  // tokens (case-insensitive match not required) advance both sides;
  // a 1:1 mismatch flanked by matches is a replacement.
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const ta = a[i] as string
    const tb = b[j] as string
    if (ta === tb) {
      i++
      j++
      continue
    }
    const nextMatches = a[i + 1] !== undefined && a[i + 1] === b[j + 1]
    const endAligned = i === a.length - 1 && j === b.length - 1
    if (nextMatches || endAligned) {
      const distance = levenshtein(ta.toLowerCase(), tb.toLowerCase())
      const caseOnly = ta.toLowerCase() === tb.toLowerCase() && ta !== tb
      const similar = distance > 0 && distance <= Math.max(2, Math.floor(tb.length / 3))
      const wordLike = /[a-zA-Z]{3,}/.test(tb) && !STOPWORDS.has(tb.toLowerCase())
      if (wordLike && (caseOnly || similar)) {
        candidates.push({ term: tb, replaced: ta })
      }
      i++
      j++
      continue
    }
    // Streams diverged beyond a simple replacement; re-anchor on the next
    // token of the longer remainder.
    if (a.length - i > b.length - j) i++
    else j++
  }
  return candidates
}
