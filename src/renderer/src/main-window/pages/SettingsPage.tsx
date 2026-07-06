import { useCallback, useEffect, useRef, useState } from 'react'
import type { HotkeyStatus, Settings, WritingStyle } from '@shared/types'
import {
  ChipIcon,
  CloudIcon,
  KeyboardIcon,
  MicIcon,
  MonitorIcon,
  PenIcon,
  PhoneIcon,
  ShieldIcon,
  WarningIcon
} from '../Icons'

interface MicOption {
  deviceId: string
  label: string
}

export function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null)
  const [firewallBlocked, setFirewallBlocked] = useState(false)
  const [fixingFirewall, setFixingFirewall] = useState(false)
  const [capturing, setCapturing] = useState<'hold' | 'toggle' | null>(null)
  const [mics, setMics] = useState<MicOption[]>([])
  const [defaultMicName, setDefaultMicName] = useState<string | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[] | null>(null)
  const [hotkeyStatus, setHotkeyStatus] = useState<HotkeyStatus | null>(null)

  const refreshMics = useCallback(async (): Promise<void> => {
    try {
      // Labels are only revealed once mic permission is granted; a short
      // throwaway stream unlocks them.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      probe.getTracks().forEach((t) => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      const def = devices.find((d) => d.kind === 'audioinput' && d.deviceId === 'default')
      setDefaultMicName(def?.label.replace(/^Default\s*-\s*/i, '') ?? null)
      setMics(
        devices
          .filter((d) => d.kind === 'audioinput' && d.deviceId !== '' && d.deviceId !== 'default' && d.deviceId !== 'communications')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
      )
    } catch {
      setMics([])
    }
  }, [])

  const refreshHotkeyStatus = useCallback((): void => {
    void window.scribe.getHotkeyStatus().then(setHotkeyStatus)
  }, [])

  useEffect(() => {
    void window.scribe.getSettings().then(setSettings)
    void window.scribe.getBridgeUrl().then(setBridgeUrl)
    void window.scribe.listOllamaModels().then(setOllamaModels)
    void refreshMics()
    refreshHotkeyStatus()
    const offHotkey = window.scribe.onHotkeyEvent(() => refreshHotkeyStatus())
    const onDeviceChange = (): void => void refreshMics()
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)
    return () => {
      offHotkey()
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
    }
  }, [refreshMics, refreshHotkeyStatus])

  const update = (patch: Partial<Settings>): void => {
    void window.scribe.setSettings(patch).then((s) => {
      setSettings(s)
      refreshHotkeyStatus()
    })
  }

  const captureHold = async (): Promise<void> => {
    setCapturing('hold')
    const combo = await window.scribe.captureHoldKeys()
    setCapturing(null)
    if (combo !== null && combo.keycodes.length > 0) {
      update({ holdKeycodes: combo.keycodes, holdKeyLabel: combo.label, hotkeyMode: 'hold' })
    }
  }

  const setBridge = (on: boolean): void => {
    void window.scribe.setSettings({ bridgeEnabled: on }).then(async (s) => {
      setSettings(s)
      if (!on) {
        setBridgeUrl(null)
        setFirewallBlocked(false)
        return
      }
      const status = await window.scribe.getBridgeStatus()
      setBridgeUrl(status.url)
      if (status.firewallBlocked) {
        // The user cancelled the firewall prompt earlier: the bridge can
        // never receive a connection, so reflect reality and switch off.
        setFirewallBlocked(true)
        void window.scribe.setSettings({ bridgeEnabled: false }).then(setSettings)
      } else {
        setFirewallBlocked(false)
      }
    })
  }

  const fixFirewall = (): void => {
    setFixingFirewall(true)
    void window.scribe.fixFirewall().then((fixed) => {
      setFixingFirewall(false)
      if (fixed) {
        setFirewallBlocked(false)
        setBridge(true)
      }
    })
  }

  if (!settings) return <div className="text-sm text-zinc-500">Loading…</div>

  const currentMicKnown = settings.micDeviceId === null || mics.some((m) => m.deviceId === settings.micDeviceId)

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Everything applies instantly — no save button.</p>
      </div>

      <Section
        icon={<MicIcon className="h-4.5 w-4.5" />}
        title="Microphone"
        description="Which mic Scribe listens to. Plug in a new one and it appears here."
      >
        <Row label="Input device" sub={currentMicKnown ? undefined : 'Your saved mic is unplugged — using the system default.'}>
          <select
            value={settings.micDeviceId ?? ''}
            onChange={(e) => {
              const id = e.target.value === '' ? null : e.target.value
              const label = id === null ? null : (mics.find((m) => m.deviceId === id)?.label ?? null)
              update({ micDeviceId: id, micLabel: label })
            }}
            className={selectCls}
          >
            <option value="">
              {defaultMicName !== null ? `System default (${defaultMicName})` : 'System default'}
            </option>
            {mics.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label}
              </option>
            ))}
          </select>
        </Row>
        {mics.length === 0 && (
          <p className="mt-2 text-xs text-amber-400">
            No microphones found (or mic permission is blocked). Connect one, then reopen this page.
          </p>
        )}
        <Divider />
        <Row label="Mic check" sub="Speak normally — the bar should move. The mic opens only while you're testing.">
          <MicCheck deviceId={settings.micDeviceId} />
        </Row>
      </Section>

      <Section
        icon={<PenIcon className="h-4.5 w-4.5" />}
        title="Writing style"
        description="How Scribe formats what you say."
      >
        <div className="flex gap-2" role="radiogroup" aria-label="Writing style">
          {(['professional', 'casual', 'messaging'] as WritingStyle[]).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={settings.style === s}
              onClick={() => update({ style: s })}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
                settings.style === s
                  ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section
        icon={<KeyboardIcon className="h-4.5 w-4.5" />}
        title="Shortcuts"
        description="How you start a dictation."
      >
        {hotkeyStatus !== null && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              hotkeyStatus.active
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            <p className="flex items-center gap-2 font-medium">
              <span className={`h-2 w-2 rounded-full ${hotkeyStatus.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {hotkeyStatus.detail}
            </p>
            <p className={`mt-1 text-xs ${hotkeyStatus.active ? 'text-emerald-200/70' : 'text-red-200/70'}`}>
              {hotkeyStatus.lastEventAt !== null
                ? `Last shortcut press detected: ${new Date(hotkeyStatus.lastEventAt).toLocaleTimeString()} (${hotkeyStatus.lastEventType ?? '?'})`
                : 'No shortcut press detected yet — press your shortcut right now and this line will update.'}
            </p>
          </div>
        )}
        <Row
          label="Push to talk"
          sub={
            capturing === 'hold' ? (
              <span className="text-sky-400">Press your key or combo now…</span>
            ) : (
              <>
                Hold <Kbd>{settings.holdKeyLabel}</Kbd> and speak
              </>
            )
          }
          active={settings.hotkeyMode === 'hold'}
        >
          {settings.hotkeyMode !== 'hold' && (
            <GhostButton onClick={() => update({ hotkeyMode: 'hold' })}>Use this</GhostButton>
          )}
          <GhostButton onClick={() => void captureHold()} disabled={capturing !== null}>
            {capturing === 'hold' ? 'Listening…' : 'Change'}
          </GhostButton>
        </Row>
        <Divider />
        <Row
          label="Toggle on/off"
          sub={
            capturing === 'toggle' ? (
              <span className="text-sky-400">Press a key combination…</span>
            ) : (
              <>
                Press <Kbd>{settings.toggleAccelerator}</Kbd> to start and stop
              </>
            )
          }
          active={settings.hotkeyMode === 'toggle'}
        >
          {settings.hotkeyMode !== 'toggle' && (
            <GhostButton onClick={() => update({ hotkeyMode: 'toggle' })}>Use this</GhostButton>
          )}
          <GhostButton
            onClick={() => setCapturing(capturing === 'toggle' ? null : 'toggle')}
            onKeyDown={(e) => {
              if (capturing !== 'toggle') return
              e.preventDefault()
              const accel = toAccelerator(e)
              if (accel !== null) {
                update({ toggleAccelerator: accel, hotkeyMode: 'toggle' })
                setCapturing(null)
              }
            }}
          >
            {capturing === 'toggle' ? 'Listening…' : 'Change'}
          </GhostButton>
        </Row>
      </Section>

      <Section
        icon={<MonitorIcon className="h-4.5 w-4.5" />}
        title="System"
        description="How Scribe behaves on this PC."
      >
        <Toggle
          label="Launch at login"
          description="Start Scribe automatically so the hotkey is always ready."
          checked={settings.launchAtLogin}
          onChange={(v) => update({ launchAtLogin: v })}
        />
      </Section>

      <Section
        icon={<ChipIcon className="h-4.5 w-4.5" />}
        title="Models"
        description="Bigger models are more accurate but slower."
      >
        <Row label="Speech recognition">
          <select value={settings.sttModel} onChange={(e) => update({ sttModel: e.target.value })} className={selectCls}>
            <option value="base.en">base.en — fast</option>
            <option value="small.en">small.en — more accurate</option>
          </select>
        </Row>
        <Divider />
        <Row
          label="Cleanup model"
          sub={
            ollamaModels !== null && ollamaModels.length === 0
              ? 'Ollama is not running — showing the saved name.'
              : 'Models installed in Ollama on this PC.'
          }
        >
          {ollamaModels !== null && ollamaModels.length > 0 ? (
            <select
              value={settings.cleanupModel}
              onChange={(e) => update({ cleanupModel: e.target.value })}
              className={selectCls}
            >
              {!ollamaModels.includes(settings.cleanupModel) && (
                <option value={settings.cleanupModel}>{settings.cleanupModel} (not installed)</option>
              )}
              {ollamaModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300">
              {settings.cleanupModel}
            </span>
          )}
        </Row>
        <Divider />
        <Toggle
          label="Clean up my speech"
          description="Off = raw transcription only."
          checked={settings.cleanupEnabled}
          onChange={(v) => update({ cleanupEnabled: v })}
        />
      </Section>

      <Section
        icon={<PhoneIcon className="h-4.5 w-4.5" />}
        title="Phone access"
        description="Dictate from your phone using this PC's models — over your own Wi-Fi only, nothing touches the internet."
      >
        <Toggle
          label="Enable phone dictation"
          description={settings.bridgeEnabled ? 'On — open the link below in your phone browser.' : 'Off.'}
          checked={settings.bridgeEnabled}
          onChange={setBridge}
        />
        {firewallBlocked && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Windows Firewall is blocking Scribe.</p>
              <p className="mt-1 text-amber-200/80">
                The firewall prompt was cancelled earlier, so your phone can never reach this PC. Scribe turned the
                setting back off to match reality.
              </p>
              <button
                onClick={fixFirewall}
                disabled={fixingFirewall}
                className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {fixingFirewall ? 'Waiting for Windows…' : 'Allow in Firewall…'}
              </button>
              <p className="mt-1.5 text-xs text-amber-200/60">Windows will ask for permission once (UAC).</p>
            </div>
          </div>
        )}
        {settings.bridgeEnabled && bridgeUrl !== null && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <code className="rounded bg-zinc-800 px-2 py-1 text-zinc-200">{bridgeUrl}</code>
            <button onClick={() => void navigator.clipboard.writeText(bridgeUrl)} className="font-medium text-sky-400 hover:underline">
              Copy
            </button>
          </div>
        )}
      </Section>

      <Section
        icon={<CloudIcon className="h-4.5 w-4.5" />}
        title="Cloud double-check"
        description="Off by default and never required. When on, Scribe still cleans your speech locally first, then a stronger cloud model proofreads that result and fixes anything it missed. Only the TEXT (never audio) is sent, using your own free API key, and the check is capped at 8 seconds. The overlay shows a notice every time."
      >
        <Toggle
          label="Double-check with the cloud"
          description={
            settings.cloudEnabled
              ? `Active — the local result is proofread by ${settings.cloudProvider ?? 'no provider selected'}.`
              : 'Inactive — everything stays on this device.'
          }
          checked={settings.cloudEnabled}
          onChange={(v) => update({ cloudEnabled: v })}
        />
        {settings.cloudEnabled && (
          <>
            <Divider />
            <Row label="Provider">
              <select
                value={settings.cloudProvider ?? ''}
                onChange={(e) => update({ cloudProvider: e.target.value === '' ? null : (e.target.value as 'groq' | 'gemini') })}
                className={selectCls}
              >
                <option value="">Choose…</option>
                <option value="groq">Groq (free tier)</option>
                <option value="gemini">Google Gemini (free tier)</option>
              </select>
            </Row>
            <Divider />
            <Row label="Your API key" sub="Saved when you click away from the box.">
              <ApiKeyInput value={settings.cloudApiKey} onCommit={(v) => update({ cloudApiKey: v })} />
            </Row>
          </>
        )}
      </Section>

      <Section
        icon={<ShieldIcon className="h-4.5 w-4.5" />}
        title="Privacy"
        description="Everything runs on this device. Nothing is uploaded, ever."
      >
        <Toggle
          label="Save history"
          description="Keep past dictations on this device so you can re-copy and fix words."
          checked={settings.saveHistory}
          onChange={(v) => update({ saveHistory: v })}
        />
        <Divider />
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
          >
            Delete all data…
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-red-400">Delete history, dictionary, and settings?</span>
            <button
              onClick={() => {
                void window.scribe.deleteAllData().then(() => {
                  setConfirmDelete(false)
                  void window.scribe.getSettings().then(setSettings)
                })
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
            >
              Yes, delete everything
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        )}
      </Section>
    </div>
  )
}

const selectCls =
  'max-w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none'

/** Local-draft key field: committing on every keystroke dropped characters (IPC round-trip). */
function ApiKeyInput({ value, onCommit }: { value: string | null; onCommit: (v: string | null) => void }): React.JSX.Element {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <input
      type="password"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft === '' ? null : draft)}
      placeholder="stored only on this device"
      className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
    />
  )
}

/** On-demand mic test: opens the mic only while testing, auto-releases after 8s. */
function MicCheck({ deviceId }: { deviceId: string | null }): React.JSX.Element {
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (!testing) return
    const t = setTimeout(() => setTesting(false), 8000)
    return () => clearTimeout(t)
  }, [testing])
  if (!testing) {
    return (
      <button
        onClick={() => setTesting(true)}
        className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
      >
        Test mic
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <MicMeter deviceId={deviceId} />
      <button onClick={() => setTesting(false)} className="text-xs font-medium text-zinc-400 hover:text-zinc-200">
        Stop
      </button>
    </div>
  )
}

/** Level meter for the selected mic — mounted only during an active mic test. */
function MicMeter({ deviceId }: { deviceId: string | null }): React.JSX.Element {
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let stopped = false
    const base = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    navigator.mediaDevices
      .getUserMedia({ audio: deviceId === null ? base : { ...base, deviceId: { exact: deviceId } } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        setError(null)
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        ctx.createMediaStreamSource(s).connect(analyser)
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = (): void => {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = ((buf[i] ?? 128) - 128) / 128
            sum += v * v
          }
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4))
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not open this microphone.')
      })
    return () => {
      stopped = true
      cancelAnimationFrame(rafRef.current)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [deviceId])

  if (error !== null) {
    return <span className="max-w-56 text-xs text-red-400">Can&apos;t open this mic: {error}</span>
  }
  return (
    <div className="h-2.5 w-48 overflow-hidden rounded-full bg-zinc-800" role="meter" aria-label="Microphone level" aria-valuenow={Math.round(level * 100)}>
      <div
        className={`h-full rounded-full transition-[width] duration-75 ${level > 0.03 ? 'bg-emerald-400' : 'bg-zinc-600'}`}
        style={{ width: `${Math.max(3, level * 100)}%` }}
      />
    </div>
  )
}

function Section({
  icon,
  title,
  description,
  children
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">{icon}</span>
        <div>
          <h2 className="text-base font-medium leading-tight">{title}</h2>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Row({
  label,
  sub,
  active,
  children
}: {
  label: string
  sub?: React.ReactNode
  active?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-medium">
          {label}
          {active === true && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              in use
            </span>
          )}
        </span>
        {sub !== undefined && <span className="mt-0.5 block text-xs text-zinc-400">{sub}</span>}
      </span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function Divider(): React.JSX.Element {
  return <div className="my-3 h-px bg-zinc-800" />
}

function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  const { className: _ignored, ...rest } = props
  return (
    <button
      {...rest}
      className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700/60 disabled:opacity-50"
    />
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200">
      {children}
    </kbd>
  )
}

/** Builds an Electron accelerator from a keydown event; null for bare modifiers. */
function toAccelerator(e: React.KeyboardEvent): string | null {
  const key = e.key
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  if (parts.length === 0) return null // require at least one modifier for a global shortcut
  const named: Record<string, string> = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }
  parts.push(named[key] ?? (key.length === 1 ? key.toUpperCase() : key))
  return parts.join('+')
}

function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-zinc-400">{description}</span>
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
          checked ? 'bg-sky-500' : 'bg-zinc-700'
        }`}
      >
        {/* left-0 anchors the knob; off = left edge, on = slid right. */}
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
