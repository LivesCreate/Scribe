import { useEffect, useMemo, useState } from 'react'
import type { HistoryEntry, ScribeState, Settings, StateChange } from '@shared/types'
import { SetupChecklist } from '../SetupChecklist'
import { LevelBars } from '../../overlay/LevelBars'
import { KeyboardIcon, MicIcon } from '../Icons'
import { Card, Kbd } from '../ui'

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

export function HomePage(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [lastTranscript, setLastTranscript] = useState<{ raw: string; clean: string } | null>(null)
  const [state, setState] = useState<ScribeState>('idle')
  const [level, setLevel] = useState(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    void window.scribe.getSettings().then(setSettings)
    void window.scribe.getHistory(500).then(setHistory)
    const offTranscript = window.scribe.onTranscriptReady((t) => {
      setLastTranscript(t)
      void window.scribe.getHistory(500).then(setHistory)
    })
    const offState = window.scribe.onStateChanged((c: StateChange) => {
      setState(c.state)
      if (c.state !== 'listening') setLevel(0)
    })
    const offLevel = window.scribe.onMicLevel(setLevel)
    return () => {
      offTranscript()
      offState()
      offLevel()
    }
  }, [])

  const stats = useMemo(() => {
    if (history.length === 0) return null
    const words = history.reduce((a, h) => a + wordCount(h.cleanText), 0)
    const seconds = history.reduce((a, h) => a + h.durationMs / 1000, 0)
    return {
      count: history.length,
      words,
      wpm: seconds > 0 ? Math.round(words / (seconds / 60)) : 0
    }
  }, [history])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-2xl border border-line bg-surface px-8 py-10">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-ink">Speak freely.</h1>
        <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-ink-muted">
          Get text you&apos;d have been proud to type — private, local, yours.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-ink-muted">
            <KeyboardIcon className="h-3.5 w-3.5 text-ink-faint" />
            {settings?.hotkeyMode === 'doubletap' ? (
              <>Double-tap <Kbd>{settings?.holdKeyLabel ?? '…'}</Kbd></>
            ) : (
              <>Hold <Kbd>{settings?.holdKeyLabel ?? '…'}</Kbd></>
            )}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-ink-muted">
            <MicIcon className="h-3.5 w-3.5 text-ink-faint" />
            {settings?.micLabel ?? 'Default microphone'}
          </span>
        </div>
      </section>

      {stats !== null && (
        <div className="grid grid-cols-3 gap-4">
          <Stat value={stats.count.toLocaleString()} label={stats.count === 1 ? 'dictation' : 'dictations'} />
          <Stat value={formatCount(stats.words)} label="words written" />
          <Stat value={`${stats.wpm}`} label="words / minute" />
        </div>
      )}

      <SetupChecklist />

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-ink">Try it here</h2>
          <ListeningIndicator state={state} level={level} />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Click into the box below, then use your hotkey. Your latest dictation also appears here.
        </p>
        <textarea
          aria-label="Dictation practice box"
          className="mt-3 h-28 w-full resize-none rounded-lg border border-line bg-base p-3 text-sm text-ink placeholder:text-ink-faint focus:border-zinc-500 focus:outline-none"
          placeholder="Your dictated text will appear here…"
        />
        {lastTranscript && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-muted hover:text-ink">What Scribe heard vs. what it wrote</summary>
            <div className="mt-2 grid gap-2">
              <div className="rounded-lg bg-surface-2 p-3 text-ink-muted">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">Heard</span>
                {lastTranscript.raw}
              </div>
              <div className="rounded-lg border border-line bg-base p-3 text-ink">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">Wrote</span>
                <pre className="whitespace-pre-wrap font-sans">{lastTranscript.clean}</pre>
              </div>
            </div>
          </details>
        )}
      </Card>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <div className="font-serif text-3xl leading-none text-ink">{value}</div>
      <div className="mt-2 text-xs text-ink-muted">{label}</div>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
  return n.toLocaleString()
}

/**
 * The live status pill next to "Try it here": shows the animated voice bars
 * while listening, and a short label as the pipeline transcribes and inserts,
 * so you can see Scribe hearing you without watching the floating overlay.
 */
function ListeningIndicator({ state, level }: { state: ScribeState; level: number }): React.JSX.Element | null {
  if (state === 'idle' || state === 'done') return null
  if (state === 'listening') {
    return (
      <span className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink">
        <span className="h-2 w-2 animate-pulse rounded-full bg-ink" />
        Listening
        <LevelBars level={level} />
      </span>
    )
  }
  const label = state === 'thinking' ? 'Cleaning up…' : state === 'inserting' ? 'Inserting…' : 'Problem'
  const tone = state === 'error' ? 'text-red-300' : 'text-ink'
  return (
    <span className={`flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${state === 'error' ? 'bg-red-400' : 'animate-pulse bg-ink'}`} />
      {label}
    </span>
  )
}
