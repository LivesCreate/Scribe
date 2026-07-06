const TARGET_SAMPLE_RATE = 16000

/**
 * Captures mic audio, reports live levels, returns 16 kHz mono PCM16 WAV.
 *
 * Uses a ScriptProcessorNode rather than an AudioWorklet on purpose: a
 * worklet must load its processor from a module URL, and a packaged Electron
 * app blocks the blob: URL that would carry it ("Unable to load a worklet's
 * module"). ScriptProcessorNode needs no module load and works everywhere.
 * It is deprecated but perfectly adequate for 16 kHz mono voice capture.
 */
export class Recorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private mute: GainNode | null = null
  private chunks: Float32Array[] = []
  private sourceSampleRate = 48000
  private levelCallback: (level: number) => void

  constructor(onLevel: (level: number) => void) {
    this.levelCallback = onLevel
  }

  async start(deviceId: string | null = null): Promise<void> {
    this.chunks = []
    const base = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId === null ? base : { ...base, deviceId: { exact: deviceId } }
      })
    } catch (err) {
      // The chosen mic may have been unplugged; fall back to the default
      // device rather than failing the dictation.
      if (deviceId === null) throw err
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: base })
    }
    this.ctx = new AudioContext()
    // A window in the background/tray can create a suspended context; without
    // resuming, no audio flows.
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.sourceSampleRate = this.ctx.sampleRate

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    // Zero-gain sink keeps the processor in the graph (so onaudioprocess fires)
    // without routing the mic to the speakers (which would cause feedback).
    this.mute = this.ctx.createGain()
    this.mute.gain.value = 0

    this.processor.onaudioprocess = (e: AudioProcessingEvent): void => {
      const channel = e.inputBuffer.getChannelData(0)
      this.chunks.push(new Float32Array(channel))
      let sum = 0
      for (let i = 0; i < channel.length; i++) {
        const v = channel[i] ?? 0
        sum += v * v
      }
      this.levelCallback(Math.sqrt(sum / channel.length))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.mute)
    this.mute.connect(this.ctx.destination)
  }

  /** Stops capture and returns the recording as a WAV file buffer. */
  async stop(): Promise<ArrayBuffer> {
    if (this.processor !== null) this.processor.onaudioprocess = null
    this.processor?.disconnect()
    this.mute?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    await this.ctx?.close()
    const merged = mergeChunks(this.chunks)
    const resampled = resampleLinear(merged, this.sourceSampleRate, TARGET_SAMPLE_RATE)
    const wav = encodeWavPcm16(resampled, TARGET_SAMPLE_RATE)
    this.ctx = null
    this.stream = null
    this.source = null
    this.processor = null
    this.mute = null
    this.chunks = []
    return wav
  }
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

function resampleLinear(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = pos - i0
    out[i] = (input[i0] ?? 0) * (1 - frac) + (input[i1] ?? 0) * frac
  }
  return out
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return buffer
}
