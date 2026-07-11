import { useEffect, useState } from 'react'
import type { DataSnapshot } from '@shared/types'
import { CodeIcon, EyeIcon, SparklesIcon } from '../Icons'
import { Button } from '../ui'

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
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-[28px] font-medium tracking-tight text-ink">Your data</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Everything Scribe knows about you lives on this PC — here it is, nothing hidden. Nothing is
        ever uploaded; delete any of it whenever you like (Dictionary and History pages remove single
        items, Settings → Privacy wipes everything).
      </p>

      <div className="mt-5 inline-flex rounded-lg border border-line bg-surface p-1" role="tablist" aria-label="Data view mode">
        <TabButton active={mode === 'readable'} onClick={() => setMode('readable')} icon={<EyeIcon className="h-3.5 w-3.5" />}>
          Readable
        </TabButton>
        <TabButton active={mode === 'code'} onClick={() => setMode('code')} icon={<CodeIcon className="h-3.5 w-3.5" />}>
          Code
        </TabButton>
      </div>

      {mode === 'readable' ? (
        <div className="mt-5 space-y-5">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-serif text-lg text-ink">About you</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              Whatever you write here is added to the AI&apos;s instructions on every cleanup. It
              shapes the persona: your tone, your vocabulary, names it should recognize, and how
              formal each kind of writing should be. Written in your own words; used only on this
              device.
            </p>
            <textarea
              value={aboutYou}
              onChange={(e) => setAboutYou(e.target.value)}
              placeholder="e.g. I'm a game developer. I write casual messages to friends and professional emails for work."
              className="mt-3 h-24 w-full resize-none rounded-lg border border-line bg-base p-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <Button variant="primary" onClick={saveAbout}>
                Save
              </Button>
              {aboutSaved && <span className="text-xs text-emerald-400">Saved.</span>}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg text-ink">Organized view</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  Your local AI ({snapshot?.settings.cleanupModel ?? 'local model'}) reads the data below and sorts it
                  into sections — on this device, nothing sent anywhere.
                </p>
              </div>
              <Button onClick={organize} disabled={organizing} className="flex shrink-0 items-center gap-1.5">
                <SparklesIcon className="h-3.5 w-3.5" />
                {organizing ? 'Organizing…' : report === null ? 'Organize' : 'Refresh'}
              </Button>
            </div>
            {report !== null && (
              <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-base p-4 font-sans text-sm leading-relaxed text-ink">
                {report}
              </pre>
            )}
          </section>

          {snapshot && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="font-serif text-lg text-ink">At a glance</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Dictionary words" value={String(snapshot.dictionary.length)} />
                <Stat label="Saved dictations" value={String(snapshot.history.length)} />
                <Stat label="Storage" value={snapshot.storageBackend === 'sqlite' ? 'SQLite' : 'JSON'} />
                <Stat label="Leaves this PC" value="Nothing" />
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                &quot;Storage: SQLite&quot; means your history, dictionary, and settings live in a
                standard local database file on this PC — a portable format you can back up, move,
                or delete at any time. (&quot;JSON&quot; appears only if the database engine could
                not load; same data, plain text file.)
              </p>
            </section>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex items-center gap-2 rounded-t-2xl border border-b-0 border-line bg-surface px-4 py-2">
            <CodeIcon className="h-3.5 w-3.5 text-ink-muted" />
            <span className="text-xs font-medium text-ink-muted">
              Raw data, exactly as stored — read-only. To change anything, use the Readable view or the other pages.
            </span>
          </div>
          <pre className="max-h-[32rem] overflow-auto rounded-b-2xl border border-line bg-base p-4 text-xs leading-relaxed text-ink-muted">
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
        active ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-base p-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  )
}
