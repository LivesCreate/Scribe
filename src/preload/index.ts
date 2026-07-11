import { contextBridge, ipcRenderer } from 'electron'
import type { DictionaryTerm, HistoryEntry, Settings, StateChange, UpdateStatus } from '@shared/types'
import { IPC } from '@shared/types'

const api = {
  onStateChanged(cb: (change: StateChange) => void): () => void {
    const handler = (_e: unknown, change: StateChange): void => cb(change)
    ipcRenderer.on(IPC.stateChanged, handler)
    return () => ipcRenderer.removeListener(IPC.stateChanged, handler)
  },
  onStartRecording(cb: () => void): () => void {
    const handler = (): void => cb()
    ipcRenderer.on(IPC.startRecording, handler)
    return () => ipcRenderer.removeListener(IPC.startRecording, handler)
  },
  onStopRecording(cb: () => void): () => void {
    const handler = (): void => cb()
    ipcRenderer.on(IPC.stopRecording, handler)
    return () => ipcRenderer.removeListener(IPC.stopRecording, handler)
  },
  onMicLevel(cb: (level: number) => void): () => void {
    const handler = (_e: unknown, level: number): void => cb(level)
    ipcRenderer.on(IPC.micLevel, handler)
    return () => ipcRenderer.removeListener(IPC.micLevel, handler)
  },
  onOverlayPreview(cb: () => void): () => void {
    const handler = (): void => cb()
    ipcRenderer.on(IPC.overlayPreview, handler)
    return () => ipcRenderer.removeListener(IPC.overlayPreview, handler)
  },
  onTranscriptReady(cb: (t: { raw: string; clean: string }) => void): () => void {
    const handler = (_e: unknown, t: { raw: string; clean: string }): void => cb(t)
    ipcRenderer.on(IPC.transcriptReady, handler)
    return () => ipcRenderer.removeListener(IPC.transcriptReady, handler)
  },
  sendAudio(wav: ArrayBuffer): void {
    ipcRenderer.send(IPC.audioCaptured, wav)
  },
  sendMicLevel(level: number): void {
    ipcRenderer.send(IPC.micLevel, level)
  },
  sendMicError(message: string): void {
    ipcRenderer.send(IPC.micError, message)
  },
  getSettings(): Promise<Settings> {
    return ipcRenderer.invoke(IPC.getSettings)
  },
  setSettings(patch: Partial<Settings>): Promise<Settings> {
    return ipcRenderer.invoke(IPC.setSettings, patch)
  },
  getHistory(limit?: number): Promise<HistoryEntry[]> {
    return ipcRenderer.invoke(IPC.getHistory, limit)
  },
  getDictionary(): Promise<DictionaryTerm[]> {
    return ipcRenderer.invoke(IPC.getDictionary)
  },
  addDictionaryTerm(term: string, hint: string | null): Promise<DictionaryTerm> {
    return ipcRenderer.invoke(IPC.addDictionaryTerm, term, hint)
  },
  updateDictionaryTerm(id: number, term: string, hint: string | null): Promise<DictionaryTerm | null> {
    return ipcRenderer.invoke(IPC.updateDictionaryTerm, id, term, hint)
  },
  removeDictionaryTerm(id: number): Promise<void> {
    return ipcRenderer.invoke(IPC.removeDictionaryTerm, id)
  },
  updateHistoryEntry(id: number, newCleanText: string): Promise<{ learned: string[] }> {
    return ipcRenderer.invoke(IPC.updateHistoryEntry, id, newCleanText)
  },
  deleteAllData(): Promise<void> {
    return ipcRenderer.invoke(IPC.deleteAllData)
  },
  getSystemStatus(): Promise<import('@shared/types').SystemStatusInfo> {
    return ipcRenderer.invoke(IPC.getSystemStatus)
  },
  getBridgeUrl(): Promise<string | null> {
    return ipcRenderer.invoke(IPC.getBridgeUrl)
  },
  getBridgeStatus(): Promise<import('@shared/types').BridgeStatus> {
    return ipcRenderer.invoke(IPC.getBridgeStatus)
  },
  fixFirewall(): Promise<boolean> {
    return ipcRenderer.invoke(IPC.fixFirewall)
  },
  listOllamaModels(): Promise<string[]> {
    return ipcRenderer.invoke(IPC.listOllamaModels)
  },
  getDataSnapshot(): Promise<import('@shared/types').DataSnapshot> {
    return ipcRenderer.invoke(IPC.getDataSnapshot)
  },
  organizeData(): Promise<string> {
    return ipcRenderer.invoke(IPC.organizeData)
  },
  captureHoldKeys(): Promise<{ keycodes: number[]; label: string } | null> {
    return ipcRenderer.invoke(IPC.captureHoldKeys)
  },
  getHotkeyStatus(): Promise<import('@shared/types').HotkeyStatus> {
    return ipcRenderer.invoke(IPC.getHotkeyStatus)
  },
  onHotkeyEvent(cb: (e: { type: 'start' | 'end' | 'toggle'; at: number }) => void): () => void {
    const handler = (_e: unknown, ev: { type: 'start' | 'end' | 'toggle'; at: number }): void => cb(ev)
    ipcRenderer.on(IPC.hotkeyEvent, handler)
    return () => ipcRenderer.removeListener(IPC.hotkeyEvent, handler)
  },
  downloadSttModel(name: string): Promise<string> {
    return ipcRenderer.invoke(IPC.downloadSttModel, name)
  },
  getDisplays(): Promise<import('@shared/types').DisplayInfo[]> {
    return ipcRenderer.invoke(IPC.getDisplays)
  },
  getDebugInfo(): Promise<import('@shared/types').DebugInfo> {
    return ipcRenderer.invoke(IPC.getDebugInfo)
  },
  openDebugWindow(): Promise<void> {
    return ipcRenderer.invoke(IPC.openDebugWindow)
  },
  getUpdateStatus(): Promise<UpdateStatus> {
    return ipcRenderer.invoke(IPC.getUpdateStatus)
  },
  checkForUpdates(): Promise<UpdateStatus> {
    return ipcRenderer.invoke(IPC.checkForUpdates)
  },
  onModelDownloadProgress(cb: (p: { name: string; pct: number }) => void): () => void {
    const handler = (_e: unknown, p: { name: string; pct: number }): void => cb(p)
    ipcRenderer.on(IPC.modelDownloadProgress, handler)
    return () => ipcRenderer.removeListener(IPC.modelDownloadProgress, handler)
  }
}

export type ScribeApi = typeof api

contextBridge.exposeInMainWorld('scribe', api)
