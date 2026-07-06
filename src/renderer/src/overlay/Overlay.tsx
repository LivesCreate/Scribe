import { useEffect, useState } from 'react'
import type { ScribeState, StateChange } from '@shared/types'
import { LevelBars } from './LevelBars'

const STATE_LABEL: Record<ScribeState, string> = {
  idle: '',
  listening: 'Listening…',
  thinking: 'Thinking…',
  inserting: 'Inserting…',
  done: 'Done',
  error: 'Something went wrong'
}

/**
 * The overlay is purely visual. Mic capture happens in the main window
 * (a normal renderer that can start an audio source); the overlay receives
 * state changes and live mic levels over IPC and just paints them.
 */
export function Overlay(): React.JSX.Element {
  const [state, setState] = useState<ScribeState>('idle')
  const [detail, setDetail] = useState<string | undefined>()
  const [level, setLevel] = useState(0)

  useEffect(() => {
    const offState = window.scribe.onStateChanged((c: StateChange) => {
      setState(c.state)
      setDetail(c.detail)
      if (c.state !== 'listening') setLevel(0)
    })
    const offLevel = window.scribe.onMicLevel((lvl: number) => setLevel(lvl))
    return () => {
      offState()
      offLevel()
    }
  }, [])

  if (state === 'idle') return <></>

  return (
    <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-xl transition-colors duration-200 ${
          state === 'error'
            ? 'border-red-400/40 bg-red-950/80 text-red-100'
            : 'border-white/15 bg-zinc-900/85 text-zinc-100'
        }`}
      >
        <StateDot state={state} />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{STATE_LABEL[state]}</span>
          {detail !== undefined && state === 'error' && (
            <span className="max-w-72 truncate text-xs text-red-300/90">{detail}</span>
          )}
          {detail !== undefined && state === 'thinking' && (
            <span className="max-w-72 truncate text-xs text-amber-300/90">{detail}</span>
          )}
        </div>
        {state === 'listening' && <LevelBars level={level} />}
        {state === 'thinking' && <Shimmer />}
      </div>
    </div>
  )
}

function StateDot({ state }: { state: ScribeState }): React.JSX.Element {
  const color =
    state === 'listening'
      ? 'bg-emerald-400'
      : state === 'thinking'
        ? 'bg-sky-400'
        : state === 'inserting'
          ? 'bg-violet-400'
          : state === 'done'
            ? 'bg-emerald-500'
            : 'bg-red-500'
  const pulse = state === 'listening' || state === 'thinking' ? 'animate-pulse' : ''
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color} ${pulse}`} aria-hidden="true" />
}

function Shimmer(): React.JSX.Element {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-300/80"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  )
}
