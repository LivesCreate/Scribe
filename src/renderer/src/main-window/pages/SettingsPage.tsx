import { useCallback, useEffect, useRef, useState } from 'react'
import type { DisplayInfo, HotkeyStatus, Settings, UpdateStatus, WritingStyle } from '@shared/types'
import { CHANGELOG, CURRENT_VERSION } from '@shared/changelog'
import { WarningIcon } from '../Icons'
import {
  Button,
  Card,
  Kbd,
  PageTitle,
  Segmented,
  SettingGroup,
  SettingRow,
  Toggle,
  applyUiTheme,
  selectCls,
  type UiTheme
} from '../ui'

interface MicOption {
  deviceId: string
  label: string
}

const STYLES: readonly WritingStyle[] = ['professional', 'casual', 'messaging', 'concise']

const STYLE_HINTS: Record<WritingStyle, string> = {
  professional: 'Polished, structured, and clean — condenses long rambles and removes swearing.',
  casual: 'Relaxed and natural, contractions welcome.',
  messaging: 'Short and chat-like, with no trailing period.',
  concise: 'Tightens rambling into the fewest words — it actually shortens what you said.'
}

const THEMES: readonly UiTheme[] = ['black', 'blue', 'white']

const HOTKEY_MODES: readonly Settings['hotkeyMode'][] = ['hold', 'doubletap']

export function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null)
  const [firewallBlocked, setFirewallBlocked] = useState(false)
  const [fixingFirewall, setFixingFirewall] = useState(false)
  const [capturing, setCapturing] = useState<'hold' | null>(null)
  const [mics, setMics] = useState<MicOption[]>([])
  const [defaultMicName, setDefaultMicName] = useState<string | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[] | null>(null)
  const [hotkeyStatus, setHotkeyStatus] = useState<HotkeyStatus | null>(null)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [sttModelReady, setSttModelReady] = useState<boolean | null>(null)
  const [sttDownloadPct, setSttDownloadPct] = useState<number | null>(null)
  /** Set while asking "download this model, or go back?" after a switch. */
  const [pendingModel, setPendingModel] = useState<{ name: string; previous: string } | null>(null)

  // A newly selected speech model may not be on disk yet — dictation would
  // fail until it is. Check whenever the choice changes, and offer the
  // download right here instead of letting the pipeline error later.
  const refreshSttModelReady = useCallback((): void => {
    void window.scribe.getSystemStatus().then((s) => setSttModelReady(s.sttModel))
  }, [])
  useEffect(() => {
    if (settings !== null) refreshSttModelReady()
  }, [settings?.sttModel, refreshSttModelReady, settings])
  useEffect(
    () =>
      window.scribe.onModelDownloadProgress(({ pct }) => {
        setSttDownloadPct(pct)
      }),
    []
  )

  const downloadSttModel = (): void => {
    setSttDownloadPct(0)
    void window.scribe
      .getSettings()
      .then((s) => window.scribe.downloadSttModel(s.sttModel))
      .then(() => {
        setSttDownloadPct(null)
        refreshSttModelReady()
      })
  }

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
    void window.scribe.getDisplays().then(setDisplays)
    void window.scribe.getUpdateStatus().then(setUpdateStatus)
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
      // Change only the keys — the same combo drives whichever mode is active.
      update({ holdKeycodes: combo.keycodes, holdKeyLabel: combo.label })
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

  if (!settings) return <div className="text-sm text-ink-faint">Loading…</div>

  const currentMicKnown = settings.micDeviceId === null || mics.some((m) => m.deviceId === settings.micDeviceId)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageTitle title="Settings" subtitle="Everything applies instantly — no save button." />

      <SettingGroup title="Updates" intro="On every launch Scribe compares itself to the newest GitHub release. Downgrades are detected and warned about.">
        <SettingRow
          label="Update check"
          description={
            updateStatus === null || updateStatus.state === 'checking'
              ? 'Checking for updates…'
              : updateStatus.state === 'current'
                ? `Up to date — v${updateStatus.currentVersion} is the newest release.`
                : updateStatus.state === 'available'
                  ? `Update available: v${updateStatus.latestVersion} (you have v${updateStatus.currentVersion}).`
                  : updateStatus.state === 'no-releases'
                    ? `v${updateStatus.currentVersion} — no releases published on GitHub yet.`
                    : `v${updateStatus.currentVersion} — could not reach GitHub (offline?).`
          }
        >
          {updateStatus?.state === 'available' && updateStatus.url !== null && (
            <Button variant="primary" onClick={() => window.open(updateStatus.url ?? '', '_blank')}>
              Get update
            </Button>
          )}
          <Button
            disabled={checkingUpdates}
            onClick={() => {
              setCheckingUpdates(true)
              void window.scribe.checkForUpdates().then((u) => {
                setUpdateStatus(u)
                setCheckingUpdates(false)
              })
            }}
          >
            {checkingUpdates ? 'Checking…' : 'Check now'}
          </Button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Microphone" intro="Which mic Scribe listens to. Plug in a new one and it appears here.">
        <SettingRow
          label="Input device"
          description={currentMicKnown ? undefined : 'Your saved mic is unplugged — using the system default.'}
        >
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
        </SettingRow>
        {mics.length === 0 && (
          <p className="py-3 text-xs text-amber-400/90">
            No microphones found (or mic permission is blocked). Connect one, then reopen this page.
          </p>
        )}
        <SettingRow label="Mic check" description="Speak normally — the bar should move. The mic opens only while you're testing.">
          <MicCheck deviceId={settings.micDeviceId} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Writing style" intro="How Scribe shapes what you say.">
        <SettingRow label="Style" description={STYLE_HINTS[settings.style]}>
          <Segmented options={STYLES} value={settings.style} onChange={(s) => update({ style: s })} ariaLabel="Writing style" />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Appearance" intro="Pick the color palette for the whole app.">
        <SettingRow label="Color palette" description="Black is the classic look; Blue tints every surface; White is a clean light mode.">
          <Segmented
            options={THEMES}
            value={settings.uiTheme}
            onChange={(t) => {
              applyUiTheme(t)
              update({ uiTheme: t })
            }}
            ariaLabel="Color palette"
          />
        </SettingRow>
      </SettingGroup>

      <section>
        <h2 className="mb-2 px-1 font-serif text-lg text-ink">Shortcut</h2>
        {hotkeyStatus !== null && (
          <div className="mb-2.5 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${hotkeyStatus.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <div>
              <p className="font-medium text-ink">{hotkeyStatus.detail}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {hotkeyStatus.lastEventAt !== null
                  ? `Last shortcut press detected: ${new Date(hotkeyStatus.lastEventAt).toLocaleTimeString()} (${hotkeyStatus.lastEventType ?? '?'})`
                  : 'No press detected yet — press your shortcut now and this line will update.'}
              </p>
            </div>
          </div>
        )}
        <Card className="divide-y divide-line px-5">
          <SettingRow
            label="Your shortcut"
            description={
              capturing === 'hold' ? (
                <span className="text-ink">Press your key or combo now…</span>
              ) : (
                <>
                  Currently <Kbd>{settings.holdKeyLabel}</Kbd> — used by both modes
                </>
              )
            }
          >
            <Button onClick={() => void captureHold()} disabled={capturing !== null}>
              {capturing === 'hold' ? 'Listening…' : 'Change'}
            </Button>
          </SettingRow>
          <SettingRow
            label="How it triggers"
            description={
              settings.hotkeyMode === 'hold' ? (
                <>
                  Hold <Kbd>{settings.holdKeyLabel}</Kbd>, speak, release. Heads up: holding Ctrl/Win
                  also changes how scrolling and clicking behave while you dictate — Double-tap is
                  hands-free.
                </>
              ) : (
                <>
                  Double-tap <Kbd>{settings.holdKeyLabel}</Kbd> to start, speak hands-free, then tap
                  once to stop.
                </>
              )
            }
          >
            <Segmented
              options={HOTKEY_MODES}
              value={settings.hotkeyMode}
              onChange={(m) => update({ hotkeyMode: m })}
              ariaLabel="Shortcut trigger mode"
              labels={{ hold: 'Hold', doubletap: 'Double-tap' }}
            />
          </SettingRow>
        </Card>
      </section>

      <SettingGroup title="Dictation overlay" intro="The little pill that shows a live indicator while you speak.">
        <SettingRow
          label="Show on monitor"
          description={
            displays.length > 1
              ? 'Changing this flashes the overlay on the chosen screen so you can see where it lands.'
              : 'Pick which screen the listening pill appears on.'
          }
        >
          <select
            value={settings.overlayDisplayId ?? ''}
            onChange={(e) => update({ overlayDisplayId: e.target.value === '' ? null : Number(e.target.value) })}
            className={selectCls}
          >
            {/* The default option IS the primary display — never list it twice. */}
            <option value="">Primary monitor</option>
            {displays
              .filter((d) => !d.primary)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
          </select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="System" intro="How Scribe behaves on this PC.">
        <SettingRow label="Launch at login" description="Start Scribe automatically so the hotkey is always ready.">
          <Toggle label="Launch at login" checked={settings.launchAtLogin} onChange={(v) => update({ launchAtLogin: v })} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Models" intro="Bigger models are more accurate but slower.">
        <SettingRow
          label="Speech recognition"
          description={
            pendingModel !== null ? (
              <span className="text-ink">
                <b>{pendingModel.name}</b> isn&apos;t on this PC yet. Download it now, or go back to{' '}
                <b>{pendingModel.previous}</b>?
              </span>
            ) : sttModelReady === false ? (
              <span className="text-amber-400">
                This model is not downloaded yet — dictation will fail until you download it.
              </span>
            ) : settings.sttModel === 'distil-large-v3' ? (
              'Distil-Whisper: near large-v3 accuracy at a fraction of the compute. English only.'
            ) : settings.sttModel === 'large-v3-turbo' ? (
              'Multilingual — auto-detects and transcribes 99+ languages.'
            ) : (
              'Turns your voice into raw text.'
            )
          }
        >
          {pendingModel !== null ? (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  setPendingModel(null)
                  downloadSttModel()
                }}
              >
                Download
              </Button>
              <Button
                onClick={() => {
                  const prev = pendingModel.previous
                  setPendingModel(null)
                  update({ sttModel: prev })
                }}
              >
                Go back
              </Button>
            </>
          ) : (
            sttModelReady === false &&
            (sttDownloadPct !== null && sttDownloadPct < 100 ? (
              <span className="text-sm text-ink-muted" aria-live="polite">
                Downloading… {sttDownloadPct}%
              </span>
            ) : (
              <Button variant="primary" onClick={downloadSttModel}>
                Download
              </Button>
            ))
          )}
          <select
            value={pendingModel?.name ?? settings.sttModel}
            onChange={(e) => {
              const next = e.target.value
              const prev = pendingModel?.previous ?? settings.sttModel
              setPendingModel(null)
              void window.scribe.setSettings({ sttModel: next }).then((s) => {
                setSettings(s)
                void window.scribe.getSystemStatus().then((status) => {
                  setSttModelReady(status.sttModel)
                  // Not on disk: ask before committing — "no" reverts to prev.
                  if (!status.sttModel && next !== prev) setPendingModel({ name: next, previous: prev })
                })
              })
            }}
            className={selectCls}
          >
            <option value="base.en">base.en — fastest, light</option>
            <option value="small.en">small.en — balanced</option>
            <option value="distil-large-v3">distil-large-v3 — best English (fast, ~1.5 GB)</option>
            <option value="large-v3-turbo">large-v3-turbo — multilingual (~1.6 GB)</option>
          </select>
        </SettingRow>
        <SettingRow
          label="Cleanup model"
          description={
            ollamaModels !== null && ollamaModels.length === 0
              ? 'Ollama is not running — showing the saved name.'
              : 'Models installed in Ollama on this PC.'
          }
        >
          {ollamaModels !== null && ollamaModels.length > 0 ? (
            <select value={settings.cleanupModel} onChange={(e) => update({ cleanupModel: e.target.value })} className={selectCls}>
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
            <span className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink">{settings.cleanupModel}</span>
          )}
        </SettingRow>
        <SettingRow label="Clean up my speech" description="Off = raw transcription only.">
          <Toggle label="Clean up my speech" checked={settings.cleanupEnabled} onChange={(v) => update({ cleanupEnabled: v })} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup
        title="Phone access"
        intro="Dictate from your phone using this PC's models — over your own Wi-Fi only, nothing touches the internet."
      >
        <SettingRow
          label="Enable phone dictation"
          description={settings.bridgeEnabled ? 'On — open the link below in your phone browser or the Scribe app.' : 'Off.'}
        >
          <Toggle label="Enable phone dictation" checked={settings.bridgeEnabled} onChange={setBridge} />
        </SettingRow>
        {firewallBlocked && (
          <div className="flex items-start gap-3 py-4 text-sm text-amber-200">
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium">Windows Firewall is blocking Scribe.</p>
              <p className="mt-1 text-amber-200/70">
                The firewall prompt was cancelled earlier, so your phone can never reach this PC. Scribe turned the setting
                back off to match reality.
              </p>
              <button
                onClick={fixFirewall}
                disabled={fixingFirewall}
                className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {fixingFirewall ? 'Waiting for Windows…' : 'Allow in Firewall…'}
              </button>
              <p className="mt-1.5 text-xs text-amber-200/50">Windows will ask for permission once (UAC).</p>
            </div>
          </div>
        )}
        {settings.bridgeEnabled && bridgeUrl !== null && (
          <div className="flex items-center gap-2 py-4 text-sm">
            <code className="rounded bg-surface-2 px-2 py-1 text-ink">{bridgeUrl}</code>
            <button onClick={() => void navigator.clipboard.writeText(bridgeUrl)} className="font-medium text-ink-muted hover:text-ink">
              Copy
            </button>
          </div>
        )}
      </SettingGroup>

      <SettingGroup
        title="Cloud double-check"
        intro="Off by default and never required. When on, Scribe still cleans your speech locally first, then a stronger cloud model proofreads that result and fixes anything it missed. Only the TEXT (never audio) is sent, using your own free API key, capped at 8 seconds. The overlay shows a notice every time."
      >
        <SettingRow
          label="Double-check with the cloud"
          description={
            settings.cloudEnabled
              ? `Active — the local result is proofread by ${settings.cloudProvider ?? 'no provider selected'}.`
              : 'Inactive — everything stays on this device.'
          }
        >
          <Toggle label="Double-check with the cloud" checked={settings.cloudEnabled} onChange={(v) => update({ cloudEnabled: v })} />
        </SettingRow>
        {settings.cloudEnabled && (
          <>
            <SettingRow label="Provider">
              <select
                value={settings.cloudProvider ?? ''}
                onChange={(e) => update({ cloudProvider: e.target.value === '' ? null : (e.target.value as 'groq' | 'gemini') })}
                className={selectCls}
              >
                <option value="">Choose…</option>
                <option value="groq">Groq (free tier)</option>
                <option value="gemini">Google Gemini (free tier)</option>
              </select>
            </SettingRow>
            <SettingRow label="Your API key" description="Saved when you click away from the box.">
              <ApiKeyInput value={settings.cloudApiKey} onCommit={(v) => update({ cloudApiKey: v })} />
            </SettingRow>
          </>
        )}
      </SettingGroup>

      <SettingGroup title="Privacy" intro="Everything runs on this device. Nothing is uploaded, ever.">
        <SettingRow label="Save history" description="Keep past dictations on this device so you can re-copy and fix words.">
          <Toggle label="Save history" checked={settings.saveHistory} onChange={(v) => update({ saveHistory: v })} />
        </SettingRow>
        <div className="py-4">
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
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2">
                Cancel
              </button>
            </div>
          )}
        </div>
      </SettingGroup>

      <SettingGroup title="Advanced" intro="A companion window with live diagnostics — in plain words or raw JSON.">
        <SettingRow label="Debug console" description="See what Scribe is doing under the hood.">
          <Button onClick={() => void window.scribe.openDebugWindow()}>Open</Button>
        </SettingRow>
      </SettingGroup>

      <WhatsNew />
    </div>
  )
}

/** MAJOR (x.0.0) → Major; MINOR (x.y.0) → Feature; anything else → Small fix. */
function updateScale(version: string): 'major' | 'feature' | 'small' {
  const [, minor, patch] = version.split('.').map((n) => parseInt(n, 10) || 0)
  if ((patch ?? 0) > 0) return 'small'
  if ((minor ?? 0) > 0) return 'feature'
  return 'major'
}

const SCALE_LABELS: Record<'major' | 'feature' | 'small', string> = {
  major: 'Major updates',
  feature: 'Smaller updates',
  small: 'Smallest updates & fixes'
}

/**
 * Version history, tucked at the bottom of Settings and collapsed by default.
 * Entries are cataloged by scale — Major, then smaller feature updates, then
 * the smallest fixes — each with its release date. Driven by the shared
 * CHANGELOG.
 */
function WhatsNew(): React.JSX.Element {
  const groups = (['major', 'feature', 'small'] as const)
    .map((scale) => ({ scale, entries: CHANGELOG.filter((e) => updateScale(e.version) === scale) }))
    .filter((g) => g.entries.length > 0)
  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm text-ink-muted hover:text-ink">
        <span className="font-medium">What&apos;s new</span>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted">v{CURRENT_VERSION}</span>
        <span className="flex-1" />
        <span className="text-xs text-ink-faint transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="max-h-96 overflow-y-auto border-t border-line px-5 py-4">
        {groups.map((g) => (
          <div key={g.scale} className="mb-5 last:mb-0">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              {SCALE_LABELS[g.scale]}
            </h3>
            <ol className="space-y-5">
              {g.entries.map((entry) => (
                <li key={entry.version}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-ink">v{entry.version}</span>
                    <span className="text-sm text-ink-muted">— {entry.title}</span>
                    <span className="flex-1" />
                    <span className="shrink-0 text-[11px] text-ink-faint">Released {entry.date}</span>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-muted marker:text-ink-faint">
                    {entry.changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </details>
  )
}

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
      className="w-60 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-zinc-500 focus:outline-none"
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
    return <Button onClick={() => setTesting(true)}>Test mic</Button>
  }
  return (
    <div className="flex items-center gap-2">
      <MicMeter deviceId={deviceId} />
      <button onClick={() => setTesting(false)} className="text-xs font-medium text-ink-muted hover:text-ink">
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
    <div className="h-2.5 w-48 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label="Microphone level" aria-valuenow={Math.round(level * 100)}>
      <div
        className={`h-full rounded-full transition-[width] duration-75 ${level > 0.03 ? 'bg-accent' : 'bg-line'}`}
        style={{ width: `${Math.max(3, level * 100)}%` }}
      />
    </div>
  )
}
