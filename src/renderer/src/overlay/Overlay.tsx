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
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const offState = window.scribe.onStateChanged((c: StateChange) => {
      setState(c.state)
      setDetail(c.detail)
      if (c.state !== 'listening') setLevel(0)
    })
    const offLevel = window.scribe.onMicLevel((lvl: number) => setLevel(lvl))
    let previewTimer: ReturnType<typeof setTimeout>
    const offPreview = window.scribe.onOverlayPreview(() => {
      setPreview(true)
      clearTimeout(previewTimer)
      previewTimer = setTimeout(() => setPreview(false), 1300)
    })
    return () => {
      offState()
      offLevel()
      offPreview()
      clearTimeout(previewTimer)
    }
  }, [])

  // Preview: shown briefly when the user changes which monitor the overlay
  // lives on, so they can see where it will appear even when idle.
  if (state === 'idle' && preview) {
    return (
      <Stage>
        <FloatPill>
          <span className="h-2 w-2 rounded-full bg-zinc-300" />
          <span className="text-[13px] font-medium text-zinc-100">Overlay appears here</span>
        </FloatPill>
      </Stage>
    )
  }

  if (state === 'idle') return <></>

  // Working states show the accurate stage text ("Cleaning up your words…"),
  // and errors show the pipeline's real reason ("Speech model … is not
  // downloaded yet") instead of a generic shrug.
  const working = state === 'thinking' || state === 'inserting'
  const label = ((working || state === 'error') && detail) || STATE_LABEL[state]

  return (
    <Stage>
      {state === 'listening' ? (
        // Wispr-style: a compact, solid pill with just the live waveform.
        <FloatPill>
          <LevelBars level={level} />
        </FloatPill>
      ) : (
        <FloatPill tone={state === 'error' ? 'error' : 'default'}>
          {state === 'error' ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
          ) : (
            <Spinner />
          )}
          <span className="max-w-72 truncate text-[13px] font-medium">{label}</span>
        </FloatPill>
      )}
    </Stage>
  )
}

/** Full-window flex container that centers the floating pill. */
function Stage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
      {children}
    </div>
  )
}

/**
 * A pill that appears to levitate: it drifts gently up and down (animate-float)
 * while a soft shadow pinned to the "ground" below shrinks and fades as it
 * rises. A quiet ambient glow and a glassy, top-lit surface complete the
 * floating-object illusion — like a magnetic display stand.
 */
function FloatPill({
  children,
  tone = 'default'
}: {
  children: React.ReactNode
  tone?: 'default' | 'error'
}): React.JSX.Element {
  const surface =
    tone === 'error'
      ? 'bg-red-950/85 text-red-100 ring-red-400/25'
      : 'bg-zinc-950/85 text-zinc-100 ring-white/12'
  return (
    <div className="relative">
      <div
        className={`animate-float flex items-center justify-center gap-2.5 rounded-full px-5 py-2.5 ring-1 backdrop-blur-xl shadow-[0_12px_34px_-6px_rgba(0,0,0,0.75),0_0_26px_rgba(255,255,255,0.07)] ${surface}`}
      >
        {children}
      </div>
      {/* Shadow on the ground — anchored (not floating), so the pill reads as
          hovering above it. Shrinks/fades in sync as the pill rises. */}
      <div
        className="animate-float-shadow pointer-events-none absolute -bottom-3.5 left-1/2 h-2 w-3/4 rounded-[50%] bg-black/70 blur-md"
        aria-hidden="true"
      />
    </div>
  )
}

/** A small rotating ring — the "working" affordance while Scribe processes. */
function Spinner(): React.JSX.Element {
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-zinc-700 border-t-zinc-200"
      aria-hidden="true"
    />
  )
}
