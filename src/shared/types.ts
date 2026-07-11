/** Dictation pipeline states. Overlay visuals key off these. */
export type ScribeState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'inserting'
  | 'done'
  | 'error'

export interface StateChange {
  state: ScribeState
  /** Human-readable detail, e.g. an error message or progress note. */
  detail?: string
}

export type WritingStyle = 'professional' | 'casual' | 'messaging' | 'concise'

export interface DictionaryTerm {
  id: number
  term: string
  /**
   * For manual terms: an optional spoken shorthand — when the speaker says
   * this, the full term is written instead (e.g. "ToF" -> "Tide of Fortune").
   * For auto-corrections: a provenance note ("corrected from ...").
   */
  hint: string | null
  /** How this term entered the dictionary. */
  source: 'manual' | 'auto-correction'
  createdAt: string
}

export interface HistoryEntry {
  id: number
  rawTranscript: string
  cleanText: string
  style: WritingStyle
  durationMs: number
  createdAt: string
}

export interface Settings {
  /**
   * How the shortcut starts a dictation:
   *  - 'hold'      — hold the combo, speak, release (push-to-talk)
   *  - 'doubletap' — double-tap the combo to start; double-tap again to stop
   */
  hotkeyMode: 'hold' | 'doubletap'
  /** uiohook keycodes held together for push-to-talk. Default: right Ctrl. */
  holdKeycodes: number[]
  /** Human-readable name of the hold combo, e.g. "Ctrl + Win". */
  holdKeyLabel: string
  /** Electron accelerator for toggle mode. */
  toggleAccelerator: string
  launchAtLogin: boolean
  style: WritingStyle
  sttModel: string
  cleanupModel: string
  cleanupEnabled: boolean
  saveHistory: boolean
  /** Cloud is always opt-in; off by default. */
  cloudEnabled: boolean
  cloudProvider: 'groq' | 'gemini' | null
  /** User-supplied key (BYOK), stored only on this device. */
  cloudApiKey: string | null
  /** Set after the first-run benchmark has picked models for this device. */
  benchmarked: boolean
  /** LAN bridge: lets your phone dictate through this PC. Off by default. */
  bridgeEnabled: boolean
  bridgePort: number
  bridgeToken: string | null
  /** Chosen input device (getUserMedia deviceId); null = system default. */
  micDeviceId: string | null
  /** Friendly name of the chosen mic, for display. */
  micLabel: string | null
  /** Free text the user writes about themselves; shown/edited in Your Data. */
  userProfile: string
  /** False until the first-run welcome wizard has been completed or skipped. */
  onboarded: boolean
  /** Electron display id the overlay appears on; null = primary monitor. */
  overlayDisplayId: number | null
  /** Color palette for the main window. */
  uiTheme: 'black' | 'blue' | 'white'
  /** Highest app version ever run — used to warn about accidental downgrades. */
  highestVersionRun: string
}

export const DEFAULT_SETTINGS: Settings = {
  hotkeyMode: 'hold',
  holdKeycodes: [3613], // uiohook VC_CONTROL_R
  holdKeyLabel: 'Right Ctrl',
  toggleAccelerator: 'Control+Shift+Space',
  launchAtLogin: false,
  style: 'professional',
  sttModel: 'base.en',
  cleanupModel: 'qwen3:4b-instruct',
  cleanupEnabled: true,
  saveHistory: true,
  cloudEnabled: false,
  cloudProvider: null,
  cloudApiKey: null,
  benchmarked: false,
  bridgeEnabled: false,
  bridgePort: 8737,
  bridgeToken: null,
  micDeviceId: null,
  micLabel: null,
  userProfile: '',
  onboarded: false,
  overlayDisplayId: null,
  uiTheme: 'black',
  highestVersionRun: '0.0.0'
}

/** Result of the on-launch GitHub release check. */
export interface UpdateStatus {
  state: 'checking' | 'current' | 'available' | 'offline' | 'no-releases'
  currentVersion: string
  latestVersion: string | null
  /** GitHub release page for the newest version, when one exists. */
  url: string | null
  checkedAt: number | null
}

/** Live hotkey diagnostics shown in Settings so "nothing happened" is debuggable. */
export interface HotkeyStatus {
  mode: 'hold' | 'doubletap'
  /** True when the hook/accelerator is actually armed and listening. */
  active: boolean
  /** Human-readable explanation of the current state (or failure). */
  detail: string
  lastEventType: 'start' | 'end' | 'toggle' | null
  lastEventAt: number | null
}

export interface BridgeStatus {
  url: string | null
  /** True when Windows Firewall has a Block rule for this app (user hit Cancel on the prompt). */
  firewallBlocked: boolean
}

/** Everything Scribe stores about the user — the Your Data page's raw view. */
export interface DataSnapshot {
  aboutYou: string
  settings: Omit<Settings, 'cloudApiKey' | 'bridgeToken'> & { cloudApiKey: string; bridgeToken: string }
  dictionary: DictionaryTerm[]
  history: HistoryEntry[]
  storageBackend: 'sqlite' | 'json-fallback'
  storagePath: string
}

export interface SystemStatusInfo {
  whisperEngine: boolean
  whisperVariant: 'cuda' | 'cpu' | null
  sttModel: boolean
  ollamaRunning: boolean
  cleanupModelReady: boolean
  micPermission: 'unknown' | 'granted' | 'denied'
}

/** A monitor the dictation overlay can be shown on. */
export interface DisplayInfo {
  id: number
  label: string
  primary: boolean
}

/** A live diagnostics snapshot for the debug console. */
export interface DebugInfo {
  version: string
  platform: string
  system: SystemStatusInfo
  hotkey: HotkeyStatus
  settings: Omit<Settings, 'cloudApiKey' | 'bridgeToken'> & {
    cloudApiKey: string
    bridgeToken: string
  }
  storageBackend: 'sqlite' | 'json-fallback'
  displays: DisplayInfo[]
  log: { at: number; line: string }[]
}

/** IPC channel names — single source of truth for main/preload/renderer. */
export const IPC = {
  stateChanged: 'scribe:state-changed',
  startRecording: 'scribe:start-recording',
  stopRecording: 'scribe:stop-recording',
  audioCaptured: 'scribe:audio-captured',
  micError: 'scribe:mic-error',
  micLevel: 'scribe:mic-level',
  getSettings: 'scribe:get-settings',
  setSettings: 'scribe:set-settings',
  getHistory: 'scribe:get-history',
  getDictionary: 'scribe:get-dictionary',
  addDictionaryTerm: 'scribe:add-dictionary-term',
  updateDictionaryTerm: 'scribe:update-dictionary-term',
  removeDictionaryTerm: 'scribe:remove-dictionary-term',
  updateHistoryEntry: 'scribe:update-history-entry',
  getSystemStatus: 'scribe:get-system-status',
  getBridgeUrl: 'scribe:get-bridge-url',
  getBridgeStatus: 'scribe:get-bridge-status',
  fixFirewall: 'scribe:fix-firewall',
  listOllamaModels: 'scribe:list-ollama-models',
  getDataSnapshot: 'scribe:get-data-snapshot',
  organizeData: 'scribe:organize-data',
  captureHoldKeys: 'scribe:capture-hold-keys',
  getHotkeyStatus: 'scribe:get-hotkey-status',
  hotkeyEvent: 'scribe:hotkey-event',
  downloadSttModel: 'scribe:download-stt-model',
  modelDownloadProgress: 'scribe:model-download-progress',
  deleteAllData: 'scribe:delete-all-data',
  transcriptReady: 'scribe:transcript-ready',
  getDisplays: 'scribe:get-displays',
  getDebugInfo: 'scribe:get-debug-info',
  openDebugWindow: 'scribe:open-debug-window',
  overlayPreview: 'scribe:overlay-preview',
  getUpdateStatus: 'scribe:get-update-status',
  checkForUpdates: 'scribe:check-for-updates'
} as const
