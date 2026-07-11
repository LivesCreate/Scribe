# Execution Plan — Project SCRIBE (from build-spec `the build-spec`)

## Context
The user has a complete build-spec for **SCRIBE**: a free, private, local-first voice-dictation utility (a "Wispr Flow you own"). Hold a hotkey, speak, and clean professionally-formatted text (filler removed, lists detected and terminated, dictionary words enforced) is inserted at the cursor in any app. The spec at `docs/BUILD-SPEC.md` is the authoritative requirements document — this file is the *execution adaptation* for this specific machine. Run until finished or the usage limit is hit; **no questions unless truly blocked**. When done (and at major milestones), run `/graphify-windows` on the project folder.

## Machine findings (drives every stack decision)
- **Have:** Node 24.14, npm 11.9, Windows 11, **RTX 3060 Laptop 6 GB** + i7-11370H + **16 GB RAM** → spec's **mid/high tier**; GPU inference viable.
- **Missing:** Rust/cargo, MSVC build tools, Python, Ollama. **~28 GB free disk** (tight — avoid multi-GB toolchains).

## Stack decisions (documented per spec's "document the choice + why")
| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Electron** (spec-permitted fallback) | Tauri needs Rust + MSVC (~8–10 GB install, none present, disk-tight). Electron runs on existing Node; matches the OpenWhispr blueprint the spec cites. |
| UI | React + TS `strict` + Tailwind + shadcn/ui, via **electron-vite** | Per spec. |
| STT | **whisper.cpp prebuilt Windows binary** (CUDA build for the 3060, CPU build fallback) run as a **sidecar process**; ggml models `base.en` + `small.en`/`large-v3-turbo` per tier. No compilation needed. | Python absent (kills faster-whisper); node bindings need MSVC. Prebuilt sidecar avoids all toolchain installs. Dictionary biasing via whisper `--prompt`. |
| Cleanup LLM | **Ollama** (silent installer `/S`) + **qwen2.5:3b-instruct** (~2 GB, GPU), temperature 0 | The heart of the product; Ollama auto-uses CUDA; 3B fits 6 GB VRAM with whisper alongside. |
| Insertion | Save clipboard → set text → synthesize **Ctrl+V via `SendInput`** through **koffi** FFI (prebuilt, no compile); restore clipboard. Fallback: PowerShell SendKeys. | "Type into any app" without native compilation. |
| Audio | `getUserMedia` + WebAudio in renderer; energy-based VAD; 16 kHz WAV to sidecar | No native deps; live level data for overlay waveform. |
| Storage | **better-sqlite3** (has Electron prebuilds); if no prebuild for the ABI, fall back to **sql.js** (wasm) with file persistence | Spec requires local SQLite; both paths avoid MSVC. |
| Project location | `the project folder` | New top-level project folder. |

## Build order (spec's gated phases, adapted)
1. **Phase 0 — Scaffold**: electron-vite + React/TS-strict/Tailwind/shadcn; state machine (`idle→listening→thinking→inserting→done/error`); frameless always-on-top overlay window; global hotkey (hold + toggle); mic capture + level meter; SQLite; **write the cleanup fixture file first** (≥10 input→output pairs incl. the grocery signature test) + vitest harness. *Gate: app launches, hotkey shows overlay, fixtures load.*
2. **Phase 1 — Local STT**: download whisper.cpp release binary + models (with progress UI); wire record→WAV→transcribe→raw text→**insert at cursor**. *Gate: speak → text appears in Notepad.*
3. **Phase 2 — Cleanup stage (the product)**: install Ollama, pull model; implement the full cleanup contract (system prompt encoding filler removal, punctuation, backtrack, **list detection + prose resume**, style presets, dictionary enforcement, never-invent); run fixture suite against the live model, iterate the prompt until it passes. *Gate: fixture suite + signature grocery test pass.*
4. **Phase 3 — Personal dictionary**: SQLite store + manager UI; bias into whisper `--prompt`; enforce in cleanup; **auto-add from corrections** (diff last insertion vs. user's edit where detectable — clipboard/history heuristic, since we can't read arbitrary apps; document the honest limits). *Gate: dictionary test.*
5. **Phase 4 — UI polish**: all overlay states with distinct visuals, live waveform ≥30 fps, onboarding (mic permission, model download, try-it box, hotkey teach), settings (hotkeys/model picker/styles/dictionary/privacy/history), light+dark, a11y (keyboard nav, labels, contrast). *Gate: state/UX walkthrough.*
6. **Phase 5 — Privacy + account model**: local-only optional profile; BYOK cloud (Groq/Gemini) fully opt-in with visible per-use notice; delete-all-data; verify **offline** (whisper.cpp + Ollama are already offline — confirm no network calls). *Gate: offline test.*
7. **Phase 6 — Mobile (adaptive, honest scope)**: responsive **web/PWA dictation screen** (in-app record → clean → copy/share) reusing the React UI; on-device native Android/iOS builds are **deferred** — iOS can't be built on Windows and Android SDK exceeds session scope; log as Tier-2 follow-up per spec's "nearest feasible option, logged."
8. **Phase 7 — Performance + packaging**: latency measurement vs. floors (auto-tier benchmark on first run, downshift logic); electron-builder NSIS installer; run the **full verification battery**; self-score rubric written to `docs/SCORECARD.md`.

## Verification (per spec battery)
- Vitest fixture suite (cleanup contract) — automated, run each phase.
- Signature grocery-list test — exact expected rendering.
- Manual/scripted: insertion into 3 real apps, latency timing on 15-s utterance, offline flow, dictionary auto-add, all overlay states.
- Final: 5-minute one-take test.

## Standing rules
- TS `strict`, no `any`; no giant files; no `// TODO` left in a closed phase; never break privacy-default.
- If a floor is infeasible, substitute nearest feasible option and **log it in `docs/DECISIONS.md`** — never silently lower the bar.
- After completion (and after major phases), run **`/graphify-windows`** on `the project folder` so the project is queryable without re-reading chat.
