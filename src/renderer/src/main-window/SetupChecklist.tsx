import { useCallback, useEffect, useState } from 'react'
import type { SystemStatusInfo } from '@shared/types'

/**
 * First-run checklist shown on Home until every pipeline dependency is in
 * place: mic access, speech engine, STT model, Ollama, cleanup model.
 */
export function SetupChecklist(): React.JSX.Element | null {
  const [status, setStatus] = useState<SystemStatusInfo | null>(null)
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [downloadPct, setDownloadPct] = useState<number | null>(null)

  const refresh = useCallback((): void => {
    void window.scribe.getSystemStatus().then(setStatus)
    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((p) => setMic(p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'unknown'))
      .catch(() => undefined)
  }, [])

  const allGood =
    status !== null &&
    status.whisperEngine &&
    status.sttModel &&
    status.ollamaRunning &&
    status.cleanupModelReady &&
    mic === 'granted'

  useEffect(() => {
    refresh()
    const offProgress = window.scribe.onModelDownloadProgress(({ pct }) => setDownloadPct(pct))
    const onFocus = (): void => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      offProgress()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  // Auto re-check every few seconds until everything is ready, then stop. This
  // is why the checklist clears itself after an update once Ollama finishes
  // starting — no manual "Re-check" needed.
  useEffect(() => {
    if (allGood) return
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [allGood, refresh])

  if (status === null) return null
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
      className="rounded-2xl border border-line bg-surface p-6"
      aria-label="Setup checklist"
    >
      <h2 className="font-serif text-lg text-ink">Finish setting up</h2>
      <ul className="mt-3 space-y-2 text-sm">
        <CheckItem
          ok={mic === 'granted'}
          label="Microphone access"
          action={
            mic !== 'granted' ? (
              <button onClick={() => void requestMic()} className="font-medium text-ink hover:underline">
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
              <span className="text-ink-faint">Reinstall the app — the engine ships with it.</span>
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
                  className="font-medium text-ink hover:underline"
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
              <span className="text-ink-faint">
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
              <span className="text-ink-faint">
                Run{' '}
                <code className="rounded bg-surface-2 px-1">ollama pull qwen3:4b-instruct</code>{' '}
                in a terminal.
              </span>
            ) : null
          }
        />
      </ul>
      <button onClick={refresh} className="mt-4 text-sm font-medium text-ink-muted hover:text-ink">
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
      <span aria-hidden="true" className={ok ? 'text-emerald-400' : 'text-ink-faint'}>
        {ok ? '✓' : '○'}
      </span>
      <span className={ok ? 'text-ink-faint line-through decoration-line' : 'font-medium text-ink'}>{label}</span>
      <span className="ml-auto">{action}</span>
    </li>
  )
}
