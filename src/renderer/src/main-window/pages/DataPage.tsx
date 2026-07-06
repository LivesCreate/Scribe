import { useEffect, useState } from 'react'
import type { DataSnapshot } from '@shared/types'
import { CodeIcon, EyeIcon, SparklesIcon } from '../Icons'

type Mode = 'readable' | 'code'

export function DataPage(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('readable')
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null)
  const [aboutYou, setAboutYou] = useState('')
  const [aboutSaved, setAboutSaved] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [organizing, setOrganizing] = useState(false)

  const refresh = (): void => {
    void window.scribe.getDataSnapshot().then((s) => {
      setSnapshot(s)
      setAboutYou(s.aboutYou)
    })
  }
  useEffect(refresh, [])

  const saveAbout = (): void => {
    void window.scribe.setSettings({ userProfile: aboutYou }).then(() => {
      setAboutSaved(true)
      setTimeout(() => setAboutSaved(false), 1500)
      refresh()
    })
  }

  const organize = (): void => {
    setOrganizing(true)
    void window.scribe.organizeData().then((r) => {
      setReport(r)
      setOrganizing(false)
    })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Your data</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Everything Scribe knows about you lives on this PC — here it is, nothing hidden.
      </p>

      <div className="mt-5 inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1" role="tablist" aria-label="Data view mode">
        <TabButton active={mode === 'readable'} onClick={() => setMode('readable')} icon={<EyeIcon className="h-3.5 w-3.5" />}>
          Readable
        </TabButton>
        <TabButton active={mode === 'code'} onClick={() => setMode('code')} icon={<CodeIcon className="h-3.5 w-3.5" />}>
          Code
        </TabButton>
      </div>

      {mode === 'readable' ? (
        <div className="mt-5 space-y-5">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-base font-medium">About you</h2>
            <p className="mt-1 text-xs text-zinc-400">
              The one place you can change how Scribe sees you. Written in your own words; used only on this device.
            </p>
            <textarea
              value={aboutYou}
              onChange={(e) => setAboutYou(e.target.value)}
              placeholder="e.g. I'm a game developer. I write casual messages to friends and professional emails for work."
              className="mt-3 h-24 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={saveAbout}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
              >
                Save
              </button>
              {aboutSaved && <span className="text-xs text-emerald-400">Saved.</span>}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">Organized view</h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Your local AI ({snapshot?.settings.cleanupModel ?? 'local model'}) reads the data below and sorts it
                  into sections — on this device, nothing sent anywhere.
                </p>
              </div>
              <button
                onClick={organize}
                disabled={organizing}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                {organizing ? 'Organizing…' : report === null ? 'Organize' : 'Refresh'}
              </button>
            </div>
            {report !== null && (
              <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 font-sans text-sm leading-relaxed text-zinc-200">
                {report}
              </pre>
            )}
          </section>

          {snapshot && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h2 className="text-base font-medium">At a glance</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Dictionary words" value={String(snapshot.dictionary.length)} />
                <Stat label="Saved dictations" value={String(snapshot.history.length)} />
                <Stat label="Storage" value={snapshot.storageBackend === 'sqlite' ? 'SQLite' : 'JSON'} />
                <Stat label="Leaves this PC" value="Nothing" />
              </dl>
            </section>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-zinc-800 bg-zinc-900 px-4 py-2">
            <CodeIcon className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400">
              Raw data, exactly as stored — read-only. To change anything, use the Readable view or the other pages.
            </span>
          </div>
          <pre className="max-h-[32rem] overflow-auto rounded-b-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300">
            {snapshot === null ? 'Loading…' : JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-zinc-950 p-3">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-100">{value}</dd>
    </div>
  )
}
