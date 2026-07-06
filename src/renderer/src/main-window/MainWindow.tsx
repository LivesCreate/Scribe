import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage'
import { DictionaryPage } from './pages/DictionaryPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { DataPage } from './pages/DataPage'
import { BookIcon, ClockIcon, DatabaseIcon, GearIcon, HomeIcon, MicIcon } from './Icons'
import { Recorder } from '../audio/recorder'

/**
 * Drives microphone capture for the whole app. Lives in the main window
 * because the frameless/transparent/non-focusable overlay cannot start an
 * audio source (Chromium AbortError). Runs even while the window is hidden
 * in the tray. Levels are streamed to the overlay over IPC.
 */
function useRecorderBridge(): void {
  useEffect(() => {
    let rec: Recorder | null = null
    let starting: Promise<void> | null = null
    const offStart = window.scribe.onStartRecording(() => {
      const r = new Recorder((lvl) => window.scribe.sendMicLevel(lvl))
      rec = r
      starting = window.scribe
        .getSettings()
        .then((s) => r.start(s.micDeviceId))
        .catch((err: unknown) => {
          rec = null
          const name = err instanceof Error ? err.name : 'Error'
          const msg = err instanceof Error ? err.message : String(err)
          window.scribe.sendMicError(
            name === 'NotAllowedError'
              ? 'Microphone blocked — allow it in Windows Settings > Privacy.'
              : `Could not open the microphone (${name}: ${msg}).`
          )
        })
    })
    const offStop = window.scribe.onStopRecording(() => {
      const r = rec
      rec = null
      if (!r) return
      void (starting ?? Promise.resolve()).then(() => r.stop().then((wav) => window.scribe.sendAudio(wav)))
    })
    return () => {
      offStart()
      offStop()
    }
  }, [])
}

type Page = 'home' | 'dictionary' | 'history' | 'data' | 'settings'

const NAV: { id: Page; label: string; icon: (p: { className?: string }) => React.JSX.Element }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'dictionary', label: 'Dictionary', icon: BookIcon },
  { id: 'history', label: 'History', icon: ClockIcon },
  { id: 'data', label: 'Your data', icon: DatabaseIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon }
]

export function MainWindow(): React.JSX.Element {
  const [page, setPage] = useState<Page>('home')
  useRecorderBridge()

  return (
    <div className="dark flex min-h-screen bg-zinc-950 text-zinc-100">
      <nav
        className="flex w-52 shrink-0 flex-col gap-1 border-r border-zinc-800 bg-zinc-900/80 p-4"
        aria-label="Main navigation"
      >
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-lg shadow-sky-500/20">
            <MicIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <span className="block text-base font-semibold leading-tight tracking-tight">Scribe</span>
            <span className="block text-[11px] text-zinc-500">Private dictation</span>
          </div>
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
              page === item.id
                ? 'bg-zinc-800 text-zinc-50'
                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
            }`}
          >
            <item.icon className={`h-4 w-4 ${page === item.id ? 'text-sky-400' : 'text-zinc-500'}`} />
            {item.label}
          </button>
        ))}
        <div className="mt-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            100% local. No subscription, no word limits, no cloud.
          </p>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto px-10 py-10">
        {page === 'home' && <HomePage />}
        {page === 'dictionary' && <DictionaryPage />}
        {page === 'history' && <HistoryPage />}
        {page === 'data' && <DataPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
