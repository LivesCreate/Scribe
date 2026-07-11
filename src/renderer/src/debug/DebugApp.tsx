import { useEffect, useState } from 'react'
import type { DebugInfo } from '@shared/types'

/**
 * The debug console — a companion window (opened from Settings) that shows the
 * live diagnostics of the running app in two forms: a readable summary, and the
 * raw JSON behind it. It polls the main process so values stay current while a
 * dictation runs. Nothing here is persisted; it is a window onto memory.
 */
export function DebugApp(): React.JSX.Element {
  const [info, setInfo] = useState<DebugInfo | null>(null)
  const [raw, setRaw] = useState(false)

  useEffect(() => {
    const refresh = (): void => void window.scribe.getDebugInfo().then(setInfo)
    refresh()
    const t = setInterval(refresh, 1500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="dark min-h-screen bg-zinc-950 px-6 py-6 text-zinc-100">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Debug console</h1>
        {info !== null && <span className="text-xs text-zinc-500">v{info.version}</span>}
        <span className="flex-1" />
        <div className="flex rounded-lg border border-zinc-800 p-0.5 text-xs">
          <button
            onClick={() => setRaw(false)}
            className={`rounded-md px-3 py-1 font-medium ${!raw ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'}`}
          >
            Readable
          </button>
          <button
            onClick={() => setRaw(true)}
            className={`rounded-md px-3 py-1 font-medium ${raw ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'}`}
          >
            Raw JSON
          </button>
        </div>
      </div>

      {info === null ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : raw ? (
        <pre className="overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-300">
          {JSON.stringify(info, null, 2)}
        </pre>
      ) : (
        <Readable info={info} />
      )}
    </div>
  )
}

function Readable({ info }: { info: DebugInfo }): React.JSX.Element {
  const ok = (v: boolean): string => (v ? 'text-emerald-400' : 'text-red-400')
  return (
    <div className="space-y-4 text-sm">
      <Card title="Environment">
        <Line k="Platform" v={info.platform} />
        <Line k="Storage" v={info.storageBackend} />
      </Card>

      <Card title="Pipeline health">
        <Line k="Speech engine" v={info.system.whisperEngine ? `ready (${info.system.whisperVariant ?? '?'})` : 'missing'} cls={ok(info.system.whisperEngine)} />
        <Line k="Speech model" v={info.system.sttModel ? 'ready' : 'missing'} cls={ok(info.system.sttModel)} />
        <Line k="Ollama" v={info.system.ollamaRunning ? 'running' : 'not running'} cls={ok(info.system.ollamaRunning)} />
        <Line k="Cleanup model" v={info.system.cleanupModelReady ? 'ready' : 'missing'} cls={ok(info.system.cleanupModelReady)} />
      </Card>

      <Card title="Shortcut">
        <Line k="Mode" v={info.hotkey.mode} />
        <Line k="Armed" v={info.hotkey.active ? 'yes' : 'no'} cls={ok(info.hotkey.active)} />
        <Line k="Detail" v={info.hotkey.detail} />
        <Line
          k="Last press"
          v={
            info.hotkey.lastEventAt !== null
              ? `${new Date(info.hotkey.lastEventAt).toLocaleTimeString()} (${info.hotkey.lastEventType ?? '?'})`
              : 'none yet'
          }
        />
      </Card>

      <Card title="Displays">
        {info.displays.map((d) => (
          <Line key={d.id} k={`#${d.id}`} v={`${d.label}${d.primary ? ' · primary' : ''}`} />
        ))}
      </Card>

      <Card title={`Recent events (${info.log.length})`}>
        {info.log.length === 0 ? (
          <p className="text-zinc-500">Nothing yet — start a dictation.</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-auto font-mono text-xs">
            {info.log.map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-zinc-600">{new Date(e.at).toLocaleTimeString()}</span>
                <span className="text-zinc-300">{e.line}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function Line({ k, v, cls }: { k: string; v: string; cls?: string }): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-zinc-500">{k}</span>
      <span className={`min-w-0 break-words ${cls ?? 'text-zinc-200'}`}>{v}</span>
    </div>
  )
}
