import { clipboard } from 'electron'
import { execFile } from 'node:child_process'

/**
 * Inserts text at the current cursor position in whatever app has focus:
 * save clipboard -> put text on clipboard -> synthesize Ctrl+V via the
 * Win32 SendInput API (koffi FFI, prebuilt) -> restore clipboard.
 * Falls back to PowerShell SendKeys if the FFI path is unavailable.
 */
export async function insertAtCursor(text: string): Promise<void> {
  const previous = clipboard.readText()
  clipboard.writeText(text)
  try {
    await pasteViaSendInput()
  } catch (err) {
    console.error('[insert] SendInput failed, falling back to SendKeys:', err)
    await pasteViaSendKeys()
  }
  // Give the target app time to read the clipboard before restoring it.
  await delay(300)
  clipboard.writeText(previous)
}

const VK_CONTROL = 0x11
const VK_V = 0x56
const KEYEVENTF_KEYUP = 0x0002
const INPUT_KEYBOARD = 1

interface SendInputFns {
  sendKey: (vk: number, flags: number) => void
}

let ffi: SendInputFns | null = null

function loadFfi(): SendInputFns {
  if (ffi) return ffi
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const koffi = require('koffi') as typeof import('koffi')
  const user32 = koffi.load('user32.dll')

  const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
    wVk: 'uint16',
    wScan: 'uint16',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr'
  })
  // INPUT's union is padded so the struct matches the 64-bit layout (40 bytes).
  const INPUT = koffi.struct('INPUT', {
    type: 'uint32',
    _pad: 'uint32',
    ki: KEYBDINPUT,
    _tail: koffi.array('uint8', 8)
  })
  const SendInput = user32.func('uint32 SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)')
  const inputSize = koffi.sizeof(INPUT)

  ffi = {
    sendKey: (vk: number, flags: number) => {
      const input = {
        type: INPUT_KEYBOARD,
        _pad: 0,
        ki: { wVk: vk, wScan: 0, dwFlags: flags, time: 0, dwExtraInfo: 0 },
        _tail: [0, 0, 0, 0, 0, 0, 0, 0]
      }
      const sent = SendInput(1, [input], inputSize) as number
      if (sent !== 1) throw new Error('SendInput rejected the event')
    }
  }
  return ffi
}

async function pasteViaSendInput(): Promise<void> {
  const { sendKey } = loadFfi()
  sendKey(VK_CONTROL, 0)
  sendKey(VK_V, 0)
  await delay(15)
  sendKey(VK_V, KEYEVENTF_KEYUP)
  sendKey(VK_CONTROL, KEYEVENTF_KEYUP)
}

function pasteViaSendKeys(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"
      ],
      { timeout: 10_000, windowsHide: true },
      (err) => (err ? reject(err) : resolve())
    )
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
