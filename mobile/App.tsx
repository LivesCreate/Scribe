import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Clipboard from 'expo-clipboard'
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync
} from 'expo-audio'
import {
  loadConfig,
  saveConfig,
  clearConfig,
  parseServerInput,
  type ServerConfig,
  type WritingStyle
} from './src/config'
import { dictate, ping } from './src/api'

type Phase = 'idle' | 'listening' | 'thinking' | 'done' | 'error'
const STYLES: WritingStyle[] = ['professional', 'casual', 'messaging']

// Mono, modest bitrate — this is speech, not music. The PC downsamples to the
// 16 kHz WAV Whisper wants, so exact rate here only affects upload size.
const SPEECH_PRESET = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 }

export default function App(): React.JSX.Element {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    void loadConfig().then((c) => {
      setConfig(c)
      setShowSetup(c === null)
      setLoaded(true)
    })
  }, [])

  if (!loaded) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#38bdf8" />
        <StatusBar style="light" />
      </View>
    )
  }

  if (showSetup || config === null) {
    return (
      <SetupScreen
        initial={config}
        onSaved={(c) => {
          setConfig(c)
          setShowSetup(false)
        }}
        onCancel={config === null ? undefined : () => setShowSetup(false)}
      />
    )
  }

  return <DictateScreen config={config} onOpenSetup={() => setShowSetup(true)} />
}

function DictateScreen({
  config,
  onOpenSetup
}: {
  config: ServerConfig
  onOpenSetup: () => void
}): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('idle')
  const [style, setStyle] = useState<WritingStyle>('professional')
  const [result, setResult] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const recorder = useAudioRecorder(SPEECH_PRESET)

  const start = async (): Promise<void> => {
    setResult('')
    setMessage('')
    setCopied(false)
    const perm = await requestRecordingPermissionsAsync()
    if (!perm.granted) {
      setPhase('error')
      setMessage('Microphone permission is off. Enable it in your phone settings.')
      return
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setPhase('listening')
    } catch {
      setPhase('error')
      setMessage('Could not start the microphone.')
    }
  }

  const stop = async (): Promise<void> => {
    setPhase('thinking')
    try {
      await recorder.stop()
      const uri = recorder.uri
      if (uri === null) throw new Error('No recording was captured.')
      const out = await dictate(config, uri, style)
      const text = out.clean.length > 0 ? out.clean : out.raw
      if (text.length === 0) {
        setPhase('error')
        setMessage('No speech detected — try again a little louder.')
        return
      }
      setResult(text)
      setPhase('done')
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const onMicPress = (): void => {
    if (phase === 'listening') void stop()
    else if (phase !== 'thinking') void start()
  }

  const copy = async (): Promise<void> => {
    await Clipboard.setStringAsync(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const listening = phase === 'listening'
  const busy = phase === 'thinking'
  const statusText =
    phase === 'listening'
      ? 'Listening… tap to finish'
      : phase === 'thinking'
        ? 'Your PC is cleaning it up…'
        : phase === 'error'
          ? message
          : phase === 'done'
            ? 'Done'
            : 'Tap to dictate'

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Scribe</Text>
          <Text style={styles.subtitle}>
            {config.host}:{config.port}
          </Text>
        </View>
        <Pressable onPress={onOpenSetup} hitSlop={12}>
          <Text style={styles.gear}>⚙︎</Text>
        </Pressable>
      </View>

      <View style={styles.styleRow}>
        {STYLES.map((s) => (
          <Pressable
            key={s}
            onPress={() => setStyle(s)}
            style={[styles.stylePill, style === s && styles.stylePillOn]}
          >
            <Text style={[styles.stylePillText, style === s && styles.stylePillTextOn]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.center}>
        <Pressable
          onPress={onMicPress}
          disabled={busy}
          style={[styles.mic, listening && styles.micOn, busy && styles.micBusy]}
        >
          {busy ? (
            <ActivityIndicator color="#e4e4e7" size="large" />
          ) : (
            <Text style={styles.micGlyph}>{listening ? '■' : '🎙'}</Text>
          )}
        </Pressable>
        <Text style={[styles.status, phase === 'error' && styles.statusError]}>{statusText}</Text>
      </View>

      <ScrollView style={styles.outBox} contentContainerStyle={styles.outContent}>
        <Text style={styles.outText}>
          {result.length > 0 ? result : 'Your cleaned text will appear here.'}
        </Text>
      </ScrollView>

      {result.length > 0 && (
        <Pressable onPress={() => void copy()} style={styles.copyBtn}>
          <Text style={styles.copyBtnText}>{copied ? '✓ Copied' : 'Copy'}</Text>
        </Pressable>
      )}

      <Text style={styles.footer}>
        Audio goes only to your own PC on your network — never the internet.
      </Text>
    </View>
  )
}

function SetupScreen({
  initial,
  onSaved,
  onCancel
}: {
  initial: ServerConfig | null
  onSaved: (c: ServerConfig) => void
  onCancel?: () => void
}): React.JSX.Element {
  const [address, setAddress] = useState(initial !== null ? `${initial.host}:${initial.port}` : '')
  const [token, setToken] = useState(initial?.token ?? '')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')

  const save = async (): Promise<void> => {
    const parsed = parseServerInput(address, initial)
    if (parsed === null) {
      setError('Enter your PC address, e.g. 192.168.1.24:8737')
      return
    }
    const config: ServerConfig = {
      ...parsed,
      token: token.trim().length > 0 ? token.trim() : parsed.token
    }
    if (config.token.length === 0) {
      setError('Paste the phone-access token from Scribe → Settings.')
      return
    }
    setTesting(true)
    setError('')
    const ok = await ping(config)
    setTesting(false)
    await saveConfig(config)
    if (!ok) {
      setError('Saved, but the PC did not answer. You can still try dictating.')
    }
    onSaved(config)
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.setupContent}>
      <StatusBar style="light" />
      <Text style={styles.title}>Connect to your PC</Text>
      <Text style={styles.setupBlurb}>
        On your PC, open Scribe → Settings → Phone access and turn it on. It shows an address and a
        token. Enter them here. Your phone and PC must be on the same Wi-Fi.
      </Text>

      <Text style={styles.label}>PC address</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="192.168.1.24:8737"
        placeholderTextColor="#52525b"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />

      <Text style={styles.label}>Access token</Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="paste from Scribe"
        placeholderTextColor="#52525b"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      {error.length > 0 && <Text style={styles.setupError}>{error}</Text>}

      <Pressable onPress={() => void save()} disabled={testing} style={styles.primaryBtn}>
        {testing ? (
          <ActivityIndicator color="#09090b" />
        ) : (
          <Text style={styles.primaryBtnText}>Save & connect</Text>
        )}
      </Pressable>

      {onCancel !== undefined && (
        <Pressable onPress={onCancel} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Cancel</Text>
        </Pressable>
      )}
      {initial !== null && (
        <Pressable onPress={() => void clearConfig().then(() => onCancel?.())} style={styles.linkBtn}>
          <Text style={styles.linkDanger}>Forget this PC</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090b', paddingHorizontal: 22, paddingTop: 64 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fafafa', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: '#71717a', fontSize: 13, marginTop: 2 },
  gear: { color: '#a1a1aa', fontSize: 24 },
  styleRow: { flexDirection: 'row', gap: 8, marginTop: 20, justifyContent: 'center' },
  stylePill: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7
  },
  stylePillOn: { borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)' },
  stylePillText: { color: '#a1a1aa', fontSize: 13, textTransform: 'capitalize' },
  stylePillTextOn: { color: '#7dd3fc' },
  mic: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  micOn: { backgroundColor: '#0c4a6e', borderColor: '#38bdf8' },
  micBusy: { backgroundColor: '#18181b', borderColor: '#3f3f46' },
  micGlyph: { fontSize: 52, color: '#e4e4e7' },
  status: { color: '#d4d4d8', fontSize: 15, fontWeight: '500', textAlign: 'center', minHeight: 20 },
  statusError: { color: '#fca5a5' },
  outBox: {
    maxHeight: 200,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 14,
    backgroundColor: '#0e0e11'
  },
  outContent: { padding: 16 },
  outText: { color: '#e4e4e7', fontSize: 16, lineHeight: 23 },
  copyBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#0ea5e9'
  },
  copyBtnText: { color: '#f0f9ff', fontSize: 15, fontWeight: '600' },
  footer: {
    color: '#52525b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 26
  },
  setupContent: { paddingBottom: 60 },
  setupBlurb: { color: '#a1a1aa', fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 8 },
  label: { color: '#d4d4d8', fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#fafafa',
    fontSize: 16,
    backgroundColor: '#0e0e11'
  },
  setupError: { color: '#fca5a5', fontSize: 13, marginTop: 14 },
  primaryBtn: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#38bdf8'
  },
  primaryBtnText: { color: '#09090b', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkBtnText: { color: '#a1a1aa', fontSize: 14 },
  linkDanger: { color: '#f87171', fontSize: 14 }
})
