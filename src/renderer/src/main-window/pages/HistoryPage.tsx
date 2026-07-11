import { useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryEntry } from '@shared/types'

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

interface LengthBucket {
  label: string
  range: string
  count: number
  avgSeconds: number
}

interface HistoryStats {
  count: number
  avgSeconds: number
  avgWords: number
  secondsPerWord: number
  buckets: LengthBucket[]
}

/**
 * Performance summary derived from stored dictations. The headline number
 * adapts to length: rather than a single "average time" (which is meaningless
 * when a 3-word note and a 200-word ramble are averaged together), it reports
 * time-per-word and breaks the average out by short / medium / long dictations.
 * All of this comes from the durationMs Scribe already saves with each entry.
 */
function computeStats(entries: HistoryEntry[]): HistoryStats | null {
  if (entries.length === 0) return null
  const rows = entries.map((h) => ({ seconds: h.durationMs / 1000, words: wordCount(h.cleanText) }))
  const count = rows.length
  const totalSeconds = rows.reduce((a, r) => a + r.seconds, 0)
  const totalWords = rows.reduce((a, r) => a + r.words, 0)
  const defs = [
    { label: 'Short', range: 'under 15 words', test: (w: number): boolean => w < 15 },
    { label: 'Medium', range: '15–50 words', test: (w: number): boolean => w >= 15 && w <= 50 },
    { label: 'Long', range: 'over 50 words', test: (w: number): boolean => w > 50 }
  ]
  const buckets = defs
    .map((d) => {
      const inBucket = rows.filter((r) => d.test(r.words))
      const avg = inBucket.length > 0 ? inBucket.reduce((a, r) => a + r.seconds, 0) / inBucket.length : 0
      return { label: d.label, range: d.range, count: inBucket.length, avgSeconds: avg }
    })
    .filter((b) => b.count > 0)
  return {
    count,
    avgSeconds: totalSeconds / count,
    avgWords: totalWords / count,
    secondsPerWord: totalWords > 0 ? totalSeconds / totalWords : 0,
    buckets
  }
}

function StatsCard({ stats }: { stats: HistoryStats }): React.JSX.Element {
  const typicalWords = Math.max(1, Math.round(stats.avgWords))
  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-serif text-lg text-ink">Model performance</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Across your last <b>{stats.count}</b> {stats.count === 1 ? 'dictation' : 'dictations'}, a
        typical <b>{typicalWords}-word</b> one takes about <b>{stats.avgSeconds.toFixed(1)} seconds</b>{' '}
        start to finish — about <b>{stats.secondsPerWord.toFixed(2)}s per word</b> once the models are
        warmed up.
      </p>

      <div className="mt-3">
        <p className="text-xs font-medium text-ink-muted">Average time by length</p>
        <div className="mt-1.5 space-y-1">
          {stats.buckets.map((b) => (
            <div key={b.label} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="w-44 shrink-0 text-ink">
                <b>{b.label}</b>{' '}
                <span className="text-ink-faint">({b.range})</span>
              </span>
              <span className="text-ink-muted">
                {b.avgSeconds.toFixed(1)}s on average, from {b.count}{' '}
                {b.count === 1 ? 'dictation' : 'dictations'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        Each dictation&apos;s time is measured and saved on this device. &quot;Average&quot; is the
        mean of those times, and the number after each length is how many of your dictations fell in
        that range — so these figures sharpen the more you use Scribe.
      </p>
    </div>
  )
}

export function HistoryPage(): React.JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [flashId, setFlashId] = useState<number | null>(null)
  const [showRawId, setShowRawId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copyEntry = (id: number, text: string): void => {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopiedId(null), 1600)
  }

  const refresh = (): void => {
    void window.scribe.getHistory(100).then(setEntries)
  }
  useEffect(refresh, [])

  // Live-refresh while this tab is open: the pipeline broadcasts every finished
  // dictation to all windows. Because pages unmount when you navigate away, this
  // listener only exists while History is the visible tab — so we reload here
  // and nowhere else. The newest row flashes briefly so you can watch it land.
  useEffect(() => {
    const off = window.scribe.onTranscriptReady(() => {
      void window.scribe.getHistory(100).then((rows) => {
        setEntries(rows)
        const newest = rows[0]
        if (newest === undefined) return
        setFlashId(newest.id)
        if (flashTimer.current !== null) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlashId(null), 2500)
      })
    })
    return () => {
      off()
      if (flashTimer.current !== null) clearTimeout(flashTimer.current)
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    }
  }, [])

  const stats = useMemo(() => computeStats(entries), [entries])

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-[28px] font-medium tracking-tight text-ink">History</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Your past dictations, stored only on this device. This list updates the moment a dictation
        finishes while you&apos;re here.
      </p>

      {stats !== null && <StatsCard stats={stats} />}

      <ul className="mt-6 space-y-3">
        {entries.length === 0 && <li className="text-sm text-ink-muted">Nothing yet.</li>}
        {entries.map((h) => (
          <li
            key={h.id}
            className={`rounded-2xl border bg-surface p-4 transition-colors duration-700 ${
              flashId === h.id ? 'border-accent ring-2 ring-accent/40' : 'border-line'
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <span>{new Date(h.createdAt + 'Z').toLocaleString()}</span>
              <span>·</span>
              <span>{h.style}</span>
              <span>·</span>
              <span
                title="Time from when you stopped speaking to inserted text (transcription + cleanup)"
                className="font-medium text-ink-muted"
              >
                {(h.durationMs / 1000).toFixed(1)}s
              </span>
              {flashId === h.id && (
                <span className="rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-accent">
                  new
                </span>
              )}
              <span className="flex-1" />
              <button
                onClick={() => setShowRawId(showRawId === h.id ? null : h.id)}
                aria-pressed={showRawId === h.id}
                className="rounded px-2 py-1 font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                {showRawId === h.id ? 'Hide original' : 'Show original'}
              </button>
              <button
                onClick={() => copyEntry(h.id, h.cleanText)}
                className={`rounded px-2 py-1 font-medium ${
                  copiedId === h.id
                    ? 'text-emerald-400'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {copiedId === h.id ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">{h.cleanText}</pre>
            {showRawId === h.id && (
              <div className="mt-3 rounded-lg border border-line bg-base p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  What Scribe heard (before cleanup)
                </p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-ink-muted">
                  {h.rawTranscript.length > 0 ? h.rawTranscript : '(empty)'}
                </pre>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
