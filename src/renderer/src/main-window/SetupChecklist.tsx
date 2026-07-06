import { useEffect, useState } from 'react'
import type { SystemStatusInfo } from '@shared/types'

/**
 * First-run checklist shown on Home until every pipeline dependency is in
 * place: mic access, speech engine, STT model, Ollama, cleanup model.
 */
export function SetupChecklist(): React.JSX.Element | null {
  const [status, setStatus] = useState<SystemStatusInfo | null>(null)
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [downloadPct, setDownloadPct] = useState<number | null>(null)

  const refresh = (): void => {
    void window.scribe.getSystemStatus().then(setStatus)
  }

  useEffect(() => {
    refresh()
    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((p) => setMic(p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'unknown'))
      .catch(() => setMic('unknown'))
    return window.scribe.onModelDownloadProgress(({ pct }) => setDownloadPct(pct))
  }, [])

  if (!status) return null
  const allGood =
    status.whisperEngine && status.sttModel && status.ollamaRunning && status.cleanupModelReady && mic === 'granted'
  if (allGood) return null

  const requestMic = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMic('granted')
    } catch {
      setMic('denied')
    }
  }

  return (
    <section
      className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-700/50 dark:bg-amber-950/40"
      aria-label="Setup checklist"
    >
      <h2 className="text-lg font-medium">Finish setting up</h2>
      <ul className="mt-3 space-y-2 text-sm">
        <CheckItem
          ok={mic === 'granted'}
          label="Microphone access"
          action={
            mic !== 'granted' ? (
              <button onClick={() => void requestMic()} className="font-medium text-sky-600 hover:underline">
                {mic === 'denied' ? 'Enable in Windows Settings, then retry' : 'Allow microphone'}
              </button>
            ) : null
          }
        />
        <CheckItem
          ok={status.whisperEngine}
          label={`Speech engine${status.whisperVariant !== null ? ` (${status.whisperVariant.toUpperCase()})` : ''}`}
          action={
            !status.whisperEngine ? (
              <span className="text-zinc-500">Reinstall the app — the engine ships with it.</span>
            ) : null
          }
        />
        <CheckItem
          ok={status.sttModel}
          label="Speech model"
          action={
            !status.sttModel ? (
              downloadPct !== null && downloadPct < 100 ? (
                <span aria-live="polite">Downloading… {downloadPct}%</span>
              ) : (
                <button
                  onClick={() => {
                    setDownloadPct(0)
                    void window.scribe
                      .getSettings()
                      .then((s) => window.scribe.downloadSttModel(s.sttModel))
                      .then(() => {
                        setDownloadPct(null)
                        refresh()
                      })
                  }}
                  className="font-medium text-sky-600 hover:underline"
                >
                  Download now
                </button>
              )
            ) : null
          }
        />
        <CheckItem
          ok={status.ollamaRunning}
          label="Cleanup engine (Ollama)"
          action={
            !status.ollamaRunning ? (
              <span className="text-zinc-500">
                Install from ollama.com, or turn off &quot;Clean up my speech&quot; in Settings.
              </span>
            ) : null
          }
        />
        <CheckItem
          ok={status.cleanupModelReady}
          label="Cleanup model"
          action={
            status.ollamaRunning && !status.cleanupModelReady ? (
              <span className="text-zinc-500">
                Run{' '}
                <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">ollama pull qwen3:4b-instruct</code>{' '}
                in a terminal.
              </span>
            ) : null
          }
        />
      </ul>
      <button onClick={refresh} className="mt-4 text-sm font-medium text-sky-600 hover:underline">
        Re-check
      </button>
    </section>
  )
}

function CheckItem({
  ok,
  label,
  action
}: {
  ok: boolean
  label: string
  action: React.ReactNode
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={ok ? 'text-emerald-500' : 'text-zinc-400'}>
        {ok ? '✓' : '○'}
      </span>
      <span className={ok ? 'text-zinc-500 line-through decoration-zinc-300' : 'font-medium'}>{label}</span>
      <span className="ml-auto">{action}</span>
    </li>
  )
}
