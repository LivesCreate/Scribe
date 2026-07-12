# Changelog

All notable changes to Scribe are listed here, newest first.

Scribe uses **MAJOR.MINOR.PATCH** version numbers:

- **MAJOR** (left) — big, direction-setting releases
- **MINOR** (middle) — significant new features or changes
- **PATCH** (right) — small fixes and tweaks

<!-- This file mirrors src/shared/changelog.ts, which also powers the in-app
     "What's new" panel in Settings. Update that file and keep this in sync. -->

## 1.7.0 — 2026-07-11 · A real Windows installer & a data-respecting uninstaller

- Setup now uses the standard Windows install wizard — welcome, pick a location, progress, finish — instead of a bare progress window.
- Uninstalling from Windows Settings now shows the normal uninstall flow, and before deleting anything it asks whether to save your Scribe data (dictations, dictionary, settings) to a "Scribe Backup" folder on your Desktop. Say No and everything is removed instantly.
- Updates never touch your data — the backup question only appears on a real uninstall.
- The installer now always creates the Desktop shortcut.

## 1.6.4 — 2026-07-11 · Setup checklist re-checks itself

- The "Finish setting up" checklist now re-checks automatically every few seconds and clears itself the moment everything is ready. Before, it took a snapshot on launch — so if Ollama was still starting up (common right after an update), it wrongly showed the cleanup engine as missing until you clicked Re-check.

## 1.6.3 — 2026-07-10 · Scrolling fixed during dictation & smarter model switching

- Fixed: the dictation overlay was silently blocking scrolling and clicking in an invisible area at the bottom-center of the screen while you dictated. It is now fully click-through — your mouse works everywhere during dictation.
- Choosing a speech model that is not downloaded now asks first: Download it, or Go back to your previous model — no more switching into a broken state.

## 1.6.2 — 2026-07-10 · Double-tap fixes & update check up top

- The update check now sits at the very top of Settings, so it is the first thing you see.
- The shortcut mode is now a clear Hold / Double-tap switch instead of an easy-to-miss button — and it explains that holding Ctrl/Win changes scrolling and clicking while you dictate, which Double-tap avoids entirely.
- Double-tap detection window widened (450ms → 650ms) so real-world double-taps of two-key combos register reliably.
- Picking a speech model that is not downloaded yet now shows a Download button with progress right in Settings — before, dictation just failed.
- The overlay now tells you the real reason when something goes wrong (e.g. "Speech model is not downloaded yet") instead of a generic "Something went wrong".

## 1.6.1 — 2026-07-10 · The big one: themes, smarter models, update checks & a stack of fixes

- Scribe now checks GitHub for new releases at every launch, shows the result under Settings → Updates, and warns you if an older installer accidentally downgraded the app.
- New speech model options: distil-large-v3 (near large-v3 accuracy for English at a fraction of the compute — faster, cooler, lighter) and large-v3-turbo (auto-detects 99+ languages).
- Switchable color palettes: Black, Blue, and White — pick yours in Settings → Appearance.
- Pages now slide in smoothly instead of swapping instantly, and the signature blue-purple logo is back.
- Professional style now removes swearing and condenses long rambles into clean, structured summaries.
- Cleanup never adds disclaimers or refuses — mention a link or video and it just works with what you said.
- Fixed: toggles rendering as a broken white blob with the knob on the wrong side — they are now proper blue switches.
- Fixed: dark-on-dark text in Your data; everything there is legible now, with new plain-language explanations of "About you" and the SQLite storage indicator.
- Fixed: maximized window pinned History/Your data to the left edge — pages now center and scale with the window.
- Fixed: the monitor picker listed the same screen twice; it now shows exactly one entry per monitor.
- The debug window is now titled "Scribe Debug" so it never looks like a second Scribe.
- What's new (in-app) now groups updates by size — major, smaller, smallest — with release dates.

## 0.6.0 — 2026-07-07 · Cleaner writing & a smarter dictionary

- Cleanup now writes more like a careful texter: no more em dashes, fewer commas, and proper names (Amazon, Steam, your own dictionary words) capitalized correctly.
- Cleanup now keeps your exact words — it no longer swaps in synonyms, softens slang, or quietly rewrites what you said.
- Spoken lists work better: "first… second… third…" becomes a numbered list, and a final item you announce but never finish ("…and third.") is dropped instead of left dangling.
- New "Concise" writing style that actually shortens rambling speech into a tight, well-written note — cutting repetition and padding while keeping every point.
- The personal dictionary is now editable — change a word or its shorthand anytime.
- Every dictionary entry now explains itself in plain language, e.g. "Say ToF → writes Tide of Fortune", so it is clear you can speak the shorthand instead of the full phrase.

## 0.5.0 — 2026-07-07 · A calmer, more professional look

- Refreshed the whole interface with a quieter, more premium design — elegant serif headings, a calm near-black palette, and consistent cards throughout.
- Settings is now organized into clean labelled groups, each row explaining what it does.
- The Home screen shows your stats at a glance: total dictations, words written, and words per minute.
- First-run setup is now a full-screen guide instead of a small popup, and its final step confirms your mic, speech engine, and model are all ready before you start.
- The dictation overlay now gently floats with a soft glow and a shadow beneath it, like a hovering pill.
- The app version is shown at the bottom of the sidebar.

## 0.4.1 — 2026-07-06 · History tab cleanup

- Copy now confirms it worked — the button turns green and reads "✓ Copied" for a moment.
- Renamed the "Compare raw" button to "Show original", and it now labels the text as "what Scribe heard (before cleanup)".
- Removed the per-entry Edit button to keep the list simple.
- The Model performance card now explains itself: it spells out the word ranges for Short / Medium / Long, what the average means, and that the number by each length is how many of your dictations fell in it.

## 0.4.0 — 2026-07-06 · Tap-to-stop, redesigned overlay, monitor choice & debug console

- Double-tap mode now stops on a single tap: double-tap to start, then one tap to finish and clean up — no second double-tap needed.
- Redesigned the dictation overlay to a cleaner, Wispr-style pill with a live waveform while listening and a spinner while it works.
- The overlay now tells you exactly what it is doing at each step: "Transcribing your speech", "Cleaning up your words", "Checking grammar with the cloud", and "Inserting your text".
- Choose which monitor the overlay appears on (Settings → Dictation overlay); switching previews it on the chosen screen.
- New debug console (Settings → Advanced → Open) — a companion window showing live diagnostics in plain words or raw JSON.
- The left menu now stays put when you scroll, the "100% local" note stays pinned in its corner, and the scrollbar is now invisible for a cleaner look.

## 0.3.0 — 2026-07-06 · Double-tap shortcut, guided setup & performance stats

- New double-tap shortcut mode: double-tap your keys to start dictating, double-tap again to stop — no holding. Settings now offers exactly two choices, Hold or Double-tap, both using the same keys.
- A guided first-run welcome wizard walks new users through microphone and shortcut setup instead of dropping them into Settings.
- The Home "Try it here" panel now shows a live listening indicator with animated voice bars, plus "Cleaning up…" and "Inserting…" status as it works.
- New performance summary on the History tab: it adapts to dictation length, showing time-per-word and average times broken out by short, medium, and long dictations — all from the timings Scribe already saves.

## 0.2.6 — 2026-07-06 · Live history

- The History tab now refreshes itself the moment a dictation finishes while you are looking at it, and briefly highlights the new entry.
- Each entry shows how long it took (transcription plus cleanup) so you can see how fast the models really are.
- New "Compare raw" button reveals exactly what Scribe heard next to the cleaned-up result, so you can judge accuracy at a glance.

## 0.2.5 — 2026-07-06 · Cleaner handling of unfinished sentences

- When you start naming something and trail off — "I went to a place called, uh, what's it called…" — without ever saying the name, Scribe now removes the whole unfinished phrase instead of leaving a broken fragment.
- Names you actually say are still kept exactly as spoken.

## 0.2.4 — 2026-07-06 · Faster, smarter cleanup

- Optional cloud double-check: your local cleanup runs first, then a stronger cloud model proofreads it — it polishes the result instead of replacing it, and is time-boxed so it never slows you down.
- If the cloud is slow or unreachable, Scribe keeps your local result automatically.
- The cleanup model now warms up at startup so your first dictation is not slow.
- The microphone is no longer held open while Settings is on screen — it only opens during an actual mic test.
- Added a 10-minute safety cap on a single recording and a tray "Start/stop dictation" control.

## 0.2.3 — 2026-07-06 · Fixed: dictation now records your voice

- The big one. In the installed app the microphone never actually opened, so dictations came back empty. Rebuilt audio capture from the ground up so it works reliably every time.

## 0.2.2 — 2026-07-06 · Groundwork for the mic fix

- Surfaced hidden microphone errors so failures are visible instead of silent. This is what exposed the bug fixed in 0.2.3.

## 0.2.1 — 2026-07-05 · Diagnostics & polish

- Shortcut status panel in Settings: shows whether your hotkey is armed and lights up when it detects a press, so you can confirm it is working.
- Live microphone level meter under the mic picker.
- The mic dropdown now names your actual default device.
- Opening Scribe a second time now brings the window to the front instead of doing nothing.
- Fixed launch-at-login.

## 0.2.0 — 2026-07-05 · Big usability update

- Choose your microphone from a list, instead of relying on the system default.
- A new dark, polished look inspired by pro dictation apps.
- "Your data" page: a readable, editable view of what Scribe knows about you, plus a raw view.
- The cleanup model is now a dropdown of your installed local models.
- Spoken punctuation: say "comma", "period", or "question mark" to get the symbols.
- Dictionary shorthand: set a short spoken alias so saying "ToF" writes "Tide of Fortune".
- Phone access now detects when Windows Firewall blocked it and offers a one-click fix.
- Fixed the on/off switches so the knob sits on the correct side when off.

## 0.1.0 — 2026-07-04 · First release

- Local voice dictation: hold a key, speak, and Scribe types clean text wherever your cursor is.
- Runs 100% on your device — both speech recognition and cleanup are local. No cloud, no account, no word limits.
- Turns rambling speech into polished text: removes "um" and "uh", fixes punctuation and capitalization, and formats spoken lists into numbered lists.
- Personal dictionary so your own names and terms come out spelled right.
- Dictate from your phone over Wi-Fi by opening a link — nothing to install on the phone.
- Windows installer.

---

<sub>Behind the scenes: the AI development assistant used to build Scribe changed partway through this history. No idea why — it just did.</sub>
