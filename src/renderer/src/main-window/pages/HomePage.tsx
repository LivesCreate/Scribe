import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { SetupChecklist } from '../SetupChecklist'
import { KeyboardIcon, MicIcon } from '../Icons'

export function HomePage(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [lastTranscript, setLastTranscript] = useState<{ raw: string; clean: string } | null>(null)

  useEffect(() => {
    void window.scribe.getSettings().then(setSettings)
    return window.scribe.onTranscriptReady(setLastTranscript)
  }, [])

  return (
    <div className="max-w-2xl">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-sky-950/60 p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-sky-500/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-violet-500/10 blur-2xl" aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-tight">Speak freely.</h1>
        <p className="mt-2 max-w-md text-zinc-400">
          Get text you&apos;d have been proud to type — private, local, yours.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-zinc-300">
            <KeyboardIcon className="h-3.5 w-3.5 text-sky-400" />
            {settings?.hotkeyMode === 'toggle' ? (
              <>Press <Kbd>{settings.toggleAccelerator}</Kbd></>
            ) : (
              <>Hold <Kbd>{settings?.holdKeyLabel ?? '…'}</Kbd></>
            )}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-zinc-300">
            <MicIcon className="h-3.5 w-3.5 text-emerald-400" />
            {settings?.micLabel ?? 'Default microphone'}
          </span>
        </div>
      </div>

      <SetupChecklist />

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-lg font-medium">Try it here</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Click into the box below, then use your hotkey. Your latest dictation also appears here.
        </p>
        <textarea
          aria-label="Dictation practice box"
          className="mt-3 h-28 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
          placeholder="Your dictated text will appear here…"
        />
        {lastTranscript && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-zinc-400">What Scribe heard vs. what it wrote</summary>
            <div className="mt-2 grid gap-2">
              <div className="rounded-lg bg-zinc-800 p-3 text-zinc-300">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Heard</span>
                {lastTranscript.raw}
              </div>
              <div className="rounded-lg bg-emerald-950/50 p-3 text-emerald-100">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-emerald-500">Wrote</span>
                <pre className="whitespace-pre-wrap font-sans">{lastTranscript.clean}</pre>
              </div>
            </div>
          </details>
        )}
      </section>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
      {children}
    </kbd>
  )
}
