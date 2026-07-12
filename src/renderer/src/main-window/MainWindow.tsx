import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { HomePage } from './pages/HomePage'
import { DictionaryPage } from './pages/DictionaryPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { DataPage } from './pages/DataPage'
import { Onboarding } from './Onboarding'
import { BookIcon, DatabaseIcon, GearIcon, HomeIcon, MicIcon, PenIcon } from './Icons'
import { CURRENT_VERSION } from '@shared/changelog'
import { applyUiTheme } from './ui'
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
  { id: 'dictionary', label: 'Dictionary', icon: PenIcon },
  // The book represents your history logs.
  { id: 'history', label: 'History', icon: BookIcon },
  { id: 'data', label: 'Your data', icon: DatabaseIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon }
]

export function MainWindow(): React.JSX.Element {
  const [page, setPage] = useState<Page>('home')
  const [settings, setSettings] = useState<Settings | null>(null)
  useRecorderBridge()

  useEffect(() => {
    void window.scribe.getSettings().then((s) => {
      setSettings(s)
      applyUiTheme(s.uiTheme)
    })
  }, [])

  return (
    <div className="dark flex h-screen overflow-hidden bg-base text-ink">
      {settings !== null && !settings.onboarded && (
        <Onboarding
          settings={settings}
          onDone={() => setSettings((s) => (s !== null ? { ...s, onboarded: true } : s))}
        />
      )}
      <nav
        className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-line bg-surface px-3 py-5"
        aria-label="Main navigation"
      >
        <div className="mb-6 flex items-center gap-2.5 px-2">
          {/* The signature blue→purple gradient mark. */}
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-lg shadow-sky-500/20">
            <MicIcon className="h-4 w-4" />
          </span>
          <span className="font-serif text-xl leading-none text-ink">Scribe</span>
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-faint ${
              page === item.id
                ? 'bg-surface-2 text-ink'
                : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink'
            }`}
          >
            <item.icon className={`h-4 w-4 ${page === item.id ? 'text-ink' : 'text-ink-faint'}`} />
            {item.label}
          </button>
        ))}
        <div className="mt-auto px-2 pt-4">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            100% local. No subscription, no word limits, no cloud.
          </p>
          <p className="mt-2.5 text-[11px] text-ink-faint">Scribe v{CURRENT_VERSION}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
            Unfinished project — no further updates.
          </p>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto px-10 py-10">
        {/* key={page} remounts the wrapper so each view slides in fluidly. */}
        <div key={page} className="animate-slide-in">
          {page === 'home' && <HomePage />}
          {page === 'dictionary' && <DictionaryPage />}
          {page === 'history' && <HistoryPage />}
          {page === 'data' && <DataPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}
