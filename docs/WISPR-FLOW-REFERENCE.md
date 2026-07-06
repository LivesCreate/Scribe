# Wispr Flow UX reference (from user screenshots, Flow v1.5.980–v1.5.1095)

Captured 2026-07-04 from 19 screenshots of the user's own Wispr Flow install. This is the visual/functional bar for Scribe's UI polish, and a feature checklist for parity decisions.

## Visual language
- Warm off-white/cream background (#f7f5f0-ish), charcoal text; **serif headings** ("General", "System", "Style") over sans body.
- Settings rows: rounded soft-gray cards, label + one-line description left, control right (pill toggle in black, or a quiet "Change"/"Customize" button).
- Left sidebar nav with small line icons: Home, Insights, Dictionary, Snippets, Style, Transforms, Scratchpad; Settings + Help pinned at bottom. Settings has its own sub-nav: General / System / Vibe coding / Account / Data and Privacy.
- Marketing-style hero banners with serif italic headlines inside feature pages.

## Screens captured
- **Home**: "Welcome back" + dismissible feature banner + stats card (total words, WPM, day streak) + a searchable feed of past dictations (timestamp left, text right, hover actions copy/flag/menu). ⇒ Scribe's History page is the analog.
- **Insights**: stat tiles (100 WPM "Top 3%", fixes made, total words), desktop app-usage bars, streak calendar heatmap. Requires their Cloud Sync. ⇒ Nice-to-have; local stats are all Scribe would need.
- **Dictionary**: All/Personal/Shared tabs; entries support plain terms ("FluxBucks") **and replacement rules** ("Fluxbox → FluxBucks", "btw → by the way"). ⇒ Scribe has term+hint+auto-learn; explicit replacement rules are a good next feature.
- **Snippets**: say a trigger word → expands to saved text ("my email address → …"). ⇒ Not in Scribe yet; natural Tier-2.
- **Style**: per-context tabs (Personal messages / Work messages / Email / Other / Auto Cleanup β) with three cards — Formal (Caps+Punctuation), Casual (Caps+Less punctuation), very casual (No Caps+Less punctuation) — each with an example chat bubble. Style only applies in English. ⇒ Scribe's three styles map 1:1; per-app context rules are Tier-2 in the spec.
- **Transforms (β)**: post-dictation rewrites bound to hotkeys (Win+Alt+1 Polish, Win+Alt+2 Prompt Engineer, Win+Alt+3 Summarizer), "Create your own" with custom prompt, opt-in toggle, Win+Alt+O to view changes. ⇒ Equivalent of the spec's Command Mode.
- **Scratchpad (β)**: notes space with "Add to Flow Bar" toggle + enableable shortcut; cloud-sync gated.
- **Settings → General**: **Shortcuts: "Hold Ctrl + Win and speak" with a Change button** (the keybind UX Scribe now mirrors); Microphone picker (Auto-detect); Dictation Languages; App Language dropdown.
- **Settings → System**: Launch app at login ✓; Show Flow bar at all times; Show app in dock; Dictation/notification sounds ✓; **Mute music while dictating** ✓; notification toggles (suggestions/announcements/milestones); Scratchpad open behavior; **Auto-add to dictionary ("Adds corrected words automatically")** ✓ — same behavior Scribe implements via History-edit learning; Creator mode; Reset app.
- **Settings → Vibe coding**: variable recognition for VS Code/Cursor/Windsurf; file tagging in chat. ⇒ IDE-specific dictation context; interesting Tier-2.
- **Settings → Data and Privacy**: Privacy Mode dropdown (no training on dictation data); **Cloud Sync OFF** on user's install; Context awareness toggle (reads text from the app you're dictating into); local data storage: **"Auto-delete local data every 24 hours"** dropdown; notes sharing default; HIPAA BAA. ⇒ Scribe is stronger by default (nothing ever leaves the device); an auto-delete-history-after-N-days option would be an easy parity add.
- **Account**: first/last name, email, profile picture, sign out / delete account. ⇒ Scribe deliberately has no account.
- **Monetization observed**: sidebar showed "0 words remaining — You get 2,000 words per week. Upgrade to Pro" — the cap that motivated Scribe.

## Parity gaps worth building next (ranked)
1. Dictionary **replacement rules** (X → Y) — user already relies on them in Flow.
2. **Snippets** (spoken trigger → saved text).
3. Sounds on state change + **mute music while dictating**.
4. Auto-delete history after N days (privacy parity).
5. Transforms/Command mode with per-transform hotkeys.
6. Microphone picker.
