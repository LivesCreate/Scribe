import { useEffect, useState } from 'react'
import type { Settings, SystemStatusInfo } from '@shared/types'
import { MicIcon } from './Icons'
import { Button, Kbd } from './ui'

interface MicOption {
  deviceId: string
  label: string
}

const STEP_LABELS = ['Welcome', 'Microphone', 'Shortcut', 'Ready'] as const

/**
 * First-run setup — a full-screen, installer-style flow (not a popup) shown
 * once, gated by settings.onboarded. It walks a new user through the two things
 * Scribe needs from them (a microphone and a shortcut) and then confirms the
 * local pipeline is ready before handing off. Every choice persists immediately;
 * "Skip" still marks onboarding done so it never nags.
 */
export function Onboarding({
  settings,
  onDone
}: {
  settings: Settings
  onDone: () => void
}): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [local, setLocal] = useState<Settings>(settings)
  const [mics, setMics] = useState<MicOption[]>([])
  const [micGranted, setMicGranted] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const save = (patch: Partial<Settings>): void => {
    setLocal((s) => ({ ...s, ...patch }))
    void window.scribe.setSettings(patch)
  }

  const requestMic = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicGranted(true)
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(
        devices
          .filter(
            (d) =>
              d.kind === 'audioinput' &&
              d.deviceId !== '' &&
              d.deviceId !== 'default' &&
              d.deviceId !== 'communications'
          )
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
      )
    } catch {
      setMicGranted(false)
    }
  }

  const captureCombo = async (): Promise<void> => {
    setCapturing(true)
    const combo = await window.scribe.captureHoldKeys()
    setCapturing(false)
    if (combo !== null && combo.keycodes.length > 0) {
      save({ holdKeycodes: combo.keycodes, holdKeyLabel: combo.label })
    }
  }

  const finish = (): void => {
    save({ onboarded: true })
    onDone()
  }

  const stepContent = [
    // 0 — Welcome
    <div key="welcome">
      <StepKicker>Welcome</StepKicker>
      <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight text-ink">
        Speak freely.
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted">
        Scribe types clean, professional text wherever your cursor is — the moment you speak. It runs
        entirely on this device: no account, no word limits, nothing uploaded. Two quick steps and
        you&apos;re dictating.
      </p>
    </div>,
    // 1 — Microphone
    <div key="mic">
      <StepKicker>Step 1 · Microphone</StepKicker>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-ink">
        Let Scribe hear you
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
        Scribe needs your microphone to work. Audio is transcribed right here on your PC — it never
        leaves the device.
      </p>
      {!micGranted ? (
        <Button variant="primary" onClick={() => void requestMic()} className="mt-6">
          Allow microphone
        </Button>
      ) : (
        <div className="mt-6 max-w-sm">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
            <CheckMark /> Microphone allowed
          </p>
          <label className="mb-1.5 block text-xs text-ink-muted">Which microphone?</label>
          <select
            value={local.micDeviceId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null
              const label = mics.find((m) => m.deviceId === id)?.label ?? null
              save({ micDeviceId: id, micLabel: label })
            }}
            className="w-full rounded-lg border border-line bg-surface-2 p-2 text-sm text-ink focus:border-zinc-500 focus:outline-none"
          >
            <option value="">System default</option>
            {mics.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>,
    // 2 — Shortcut
    <div key="shortcut">
      <StepKicker>Step 2 · Shortcut</StepKicker>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-ink">
        Choose your shortcut
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
        Your keys are <Kbd>{local.holdKeyLabel}</Kbd>. Pick how they trigger dictation:
      </p>
      <div className="mt-5 grid max-w-md gap-2.5">
        <ModeChoice
          active={local.hotkeyMode === 'hold'}
          title="Hold to talk"
          desc="Hold the keys, speak, release. Best for quick bursts."
          onClick={() => save({ hotkeyMode: 'hold' })}
        />
        <ModeChoice
          active={local.hotkeyMode === 'doubletap'}
          title="Double-tap to start / stop"
          desc="Double-tap to start, tap once to stop. No holding — best for longer dictations."
          onClick={() => save({ hotkeyMode: 'doubletap' })}
        />
      </div>
      <Button onClick={() => void captureCombo()} disabled={capturing} className="mt-4">
        {capturing ? 'Press your keys now…' : 'Change keys'}
      </Button>
    </div>,
    // 3 — Ready + system check
    <ReadyStep key="ready" hotkeyMode={local.hotkeyMode} holdKeyLabel={local.holdKeyLabel} />
  ]

  const isLast = step === stepContent.length - 1

  return (
    <div className="fixed inset-0 z-50 flex bg-base text-ink">
      {/* Left rail — brand + step progress, like an installer. */}
      <aside className="hidden w-72 shrink-0 flex-col justify-between border-r border-line bg-surface p-8 sm:flex">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink">
              <MicIcon className="h-4 w-4" />
            </span>
            <span className="font-serif text-xl text-ink">Scribe</span>
          </div>
          <p className="mt-3 text-sm text-ink-muted">Let&apos;s get you set up — about a minute.</p>
          <ol className="mt-10 space-y-1">
            {STEP_LABELS.map((label, i) => (
              <li key={label}>
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    i === step ? 'bg-surface-2 text-ink' : 'text-ink-muted'
                  } ${i < step ? 'hover:bg-surface-2/60' : ''}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      i < step
                        ? 'bg-accent text-white'
                        : i === step
                          ? 'border border-ink text-ink'
                          : 'border border-line text-ink-faint'
                    }`}
                  >
                    {i < step ? '✓' : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          100% local. Nothing you say leaves this device.
        </p>
      </aside>

      {/* Main — current step + footer nav. */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 items-center overflow-y-auto px-10 py-12 sm:px-16">
          <div className="w-full max-w-xl">{stepContent[step]}</div>
        </div>
        <footer className="flex items-center gap-2 border-t border-line px-10 py-5 sm:px-16">
          <div className="flex gap-1.5 sm:hidden" aria-hidden="true">
            {stepContent.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? 'bg-accent' : 'bg-line'}`} />
            ))}
          </div>
          <span className="flex-1" />
          {!isLast && (
            <button onClick={finish} className="px-3 py-1.5 text-sm text-ink-faint hover:text-ink">
              Skip setup
            </button>
          )}
          {step > 0 && (
            <Button onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          <Button variant="primary" onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
            {isLast ? 'Start dictating' : 'Continue'}
          </Button>
        </footer>
      </main>
    </div>
  )
}

/** Final step: confirms the local pipeline is ready before handing off. */
function ReadyStep({
  hotkeyMode,
  holdKeyLabel
}: {
  hotkeyMode: Settings['hotkeyMode']
  holdKeyLabel: string
}): React.JSX.Element {
  const [status, setStatus] = useState<SystemStatusInfo | null>(null)
  const [micOk, setMicOk] = useState(false)
  const [downloadPct, setDownloadPct] = useState<number | null>(null)

  const refresh = (): void => {
    void window.scribe.getSystemStatus().then(setStatus)
  }

  useEffect(() => {
    refresh()
    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((p) => setMicOk(p.state === 'granted'))
      .catch(() => setMicOk(false))
    return window.scribe.onModelDownloadProgress(({ pct }) => setDownloadPct(pct))
  }, [])

  const downloadModel = (): void => {
    setDownloadPct(0)
    void window.scribe
      .getSettings()
      .then((s) => window.scribe.downloadSttModel(s.sttModel))
      .then(() => {
        setDownloadPct(null)
        refresh()
      })
  }

  return (
    <div>
      <StepKicker>You&apos;re ready</StepKicker>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-ink">
        Everything&apos;s in place
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
        {hotkeyMode === 'hold' ? (
          <>
            Hold <Kbd>{holdKeyLabel}</Kbd>, say a sentence, and release — Scribe types it wherever your
            cursor is.
          </>
        ) : (
          <>
            Double-tap <Kbd>{holdKeyLabel}</Kbd> to start, speak, then tap once to stop — Scribe types
            it wherever your cursor is.
          </>
        )}{' '}
        The Home tab has a box to try it in.
      </p>

      <div className="mt-6 max-w-md divide-y divide-line rounded-2xl border border-line bg-surface px-5">
        <ReadyRow ok={micOk} label="Microphone access" />
        <ReadyRow
          ok={status?.whisperEngine ?? false}
          label={`Speech engine${status?.whisperVariant != null ? ` (${status.whisperVariant.toUpperCase()})` : ''}`}
          hint={status !== null && !status.whisperEngine ? 'Reinstall the app — the engine ships with it.' : undefined}
        />
        <ReadyRow
          ok={status?.sttModel ?? false}
          label="Speech model"
          action={
            status !== null && !status.sttModel ? (
              downloadPct !== null && downloadPct < 100 ? (
                <span className="text-xs text-ink-muted" aria-live="polite">
                  Downloading… {downloadPct}%
                </span>
              ) : (
                <button onClick={downloadModel} className="text-xs font-medium text-ink hover:underline">
                  Download
                </button>
              )
            ) : undefined
          }
        />
        <ReadyRow
          ok={status?.ollamaRunning ?? false}
          label="Cleanup engine (Ollama)"
          hint={status !== null && !status.ollamaRunning ? 'Optional — install from ollama.com for polished text.' : undefined}
        />
        <ReadyRow ok={status?.cleanupModelReady ?? false} label="Cleanup model" />
      </div>
      <button onClick={refresh} className="mt-3 text-sm font-medium text-ink-muted hover:text-ink">
        Re-check
      </button>
    </div>
  )
}

function ReadyRow({
  ok,
  label,
  hint,
  action
}: {
  ok: boolean
  label: string
  hint?: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-3.5 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
          ok ? 'bg-emerald-500/15 text-emerald-400' : 'border border-line text-ink-faint'
        }`}
      >
        {ok ? '✓' : ''}
      </span>
      <div className="min-w-0">
        <span className={ok ? 'text-ink-muted' : 'font-medium text-ink'}>{label}</span>
        {hint !== undefined && <p className="text-xs text-ink-faint">{hint}</p>}
      </div>
      {action !== undefined && <span className="ml-auto shrink-0">{action}</span>}
    </div>
  )
}

function StepKicker({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{children}</span>
  )
}

function CheckMark(): React.JSX.Element {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-400">
      ✓
    </span>
  )
}

function ModeChoice({
  active,
  title,
  desc,
  onClick
}: {
  active: boolean
  title: string
  desc: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-faint ${
        active ? 'border-ink/50 bg-surface-2' : 'border-line hover:border-zinc-600'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
            active ? 'border-ink bg-ink' : 'border-ink-faint'
          }`}
        >
          {active && <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />}
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <p className="mt-1.5 pl-6.5 text-xs leading-relaxed text-ink-muted">{desc}</p>
    </button>
  )
}
