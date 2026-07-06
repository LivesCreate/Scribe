import { execFile } from 'node:child_process'
import { app } from 'electron'

/**
 * Windows Firewall integration for the phone bridge. When the firewall
 * prompt appears and the user clicks Cancel, Windows silently creates a
 * BLOCK rule for the exe — the bridge then listens happily but no phone
 * can ever reach it. These helpers detect that state (no admin needed)
 * and can repair it (one UAC prompt).
 */

function exePath(): string {
  return process.execPath
}

function runPowerShell(script: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: timeoutMs, windowsHide: true },
      (err, stdout) => {
        if (err) reject(err)
        else resolve(stdout)
      }
    )
  })
}

/** True when an enabled inbound Block rule targets this app's executable. */
export async function firewallBlocked(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  const exe = exePath().replace(/'/g, "''")
  const script = `(Get-NetFirewallApplicationFilter -Program '${exe}' -ErrorAction SilentlyContinue | Get-NetFirewallRule | Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Block' -and $_.Direction -eq 'Inbound' } | Measure-Object).Count`
  try {
    const out = await runPowerShell(script, 15_000)
    return parseInt(out.trim(), 10) > 0
  } catch {
    return false // can't tell — don't scare the user with a false positive
  }
}

/**
 * Removes the Block rules for this exe and adds a private-network Allow
 * rule. Requires elevation, so Windows shows one UAC prompt.
 */
export async function fixFirewall(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  const exe = exePath().replace(/'/g, "''")
  const inner = [
    `Get-NetFirewallApplicationFilter -Program '${exe}' -ErrorAction SilentlyContinue | Get-NetFirewallRule | Where-Object { $_.Action -eq 'Block' } | Remove-NetFirewallRule`,
    `New-NetFirewallRule -DisplayName 'Scribe phone dictation' -Direction Inbound -Program '${exe}' -Action Allow -Profile Private | Out-Null`
  ].join('; ')
  // -Verb RunAs triggers the UAC consent dialog; -Wait so we can re-check after.
  const script = `Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-Command',"${inner.replace(/"/g, '\\"')}"`
  try {
    await runPowerShell(script, 120_000)
    return !(await firewallBlocked())
  } catch {
    return false // user declined the UAC prompt
  }
}

/** App name shown in guidance text (installed exe is Scribe.exe; dev is electron.exe). */
export function firewallAppName(): string {
  return app.getName()
}
