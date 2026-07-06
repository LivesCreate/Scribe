# Build-Spec: a free, private, cross-platform voice-dictation utility (a "Wispr Flow" you own)

> **What this file is.** This is both (a) the plan and (b) the **build-spec prompt** you can hand to a builder (Fable 5) so it can build with minimal back-and-forth. It is written in the spirit of the long, precise LAAS spec you admired — **but it is not a copy of it**; it is purpose-built for a dictation utility. Rename the project codename to whatever you like.

---

## Context — why this exists (read me first)

The user relies on **Wispr Flow** (a.k.a. "Whisperflow"): press a hotkey, talk for minutes, and it inserts **clean, professional, correctly-formatted** text at the cursor — filler removed, grammar fixed, and — the part they love — it **intelligently formats spoken lists** ("from the store I need: 1. … 2. … 3. …") and then **returns to normal paragraphs** when the list ends. It also has a **personal dictionary** for invented words (e.g. names of games the user created) that teaches spelling/capitalization/usage.

The user wants to **own a free, privacy-first equivalent**: no subscription, **nothing forced to the cloud**, using **free/open models**, **account-optional** (account only unlocks *local* data saving), a **beautiful UI**, that **works great on desktop (primary) and on mobile (adaptive to device power)**.

**Research findings that shaped this spec** (full sources in the chat report):
- Wispr Flow's quality comes from a **two-stage pipeline**: speech-to-text → a **fine-tuned LLM cleanup pass** that structures/formats/contextualizes. The transcriber is commodity; **the cleanup LLM is the product.**
- Smart-formatting behavior is documented: **numbers/ordinals trigger lists**; spoken punctuation words work; formatting is **context-aware**; **Backtrack** removes false starts on "actually"/"scratch that" or restatement.
- "Type into any app" only works in a **desktop app** (OS accessibility + global hotkey). A pure browser page can only be copy-paste. This drives the architecture below.
- Proven open blueprint: **OpenWhispr** (Electron + React/TS + Tailwind/shadcn + SQLite; whisper.cpp + Parakeet via sherpa-onnx; local LLM via llama.cpp; BYOK cloud optional; MIT).
- Free local models available: STT — **faster-whisper / whisper.cpp / large-v3-turbo**, **NVIDIA Parakeet TDT 0.6B** (fastest, English-leaning), **Moonshine** (streaming). Cleanup LLM — small instruct models via **Ollama/llama.cpp**.

**Decisions already made with the user:** cross-platform (desktop-primary, mobile-adaptive); **local-first, cloud-optional**; account optional and local-only.

---

## THE BUILD-SPEC — Project SCRIBE (rename freely)
*A voice-to-clean-text utility. Speak freely; get text you'd have been proud to type.*

### The bar
The target is the **Wispr Flow felt experience**: you hold a key, talk for five minutes stream-of-consciousness, and what lands is **what you *meant* to write** — professional, punctuated, correctly listed, filler gone — not a raw transcript. The bar is not "a transcription box." A raw dump of dictated words with `um`s left in, no paragraph structure, and no list intelligence is a **failed build**, no matter how clean the code. Every phase is judged against the two-stage "clean output" standard, not against "the speech-to-text works."

### The five pillars
Every requirement serves one of these. If the spec doesn't cover a decision, resolve it in favor of the pillar.

- **A. The cleanup is the product.** Detail lives in the *rewrite*, not the transcript. The LLM pass must remove filler, fix grammar, apply punctuation, and **format structure** (lists vs. paragraphs) the way a careful human editor would. A pipeline that transcribes accurately but formats poorly has failed.
- **B. Private by default.** On desktop, the full pipeline runs **locally, offline** — audio never leaves the device. Any path that sends audio/text off-device is **opt-in, per-use-visible, and off by default**. No telemetry of content, ever.
- **C. Zero-friction, account-optional.** Works instantly with **no sign-up**. An account is **local-only** and unlocks *local* persistence (history, dictionary), never a cloud sync to a company server. First dictation should happen within 60 seconds of launch.
- **D. Beautiful, calm, alive UI.** A small floating overlay that feels premium: clear **states** (idle / listening / thinking / inserting / error), live mic feedback, no jank. It should feel like a first-party OS feature, not a hobby tool.
- **E. It learns *you*.** A **personal dictionary** teaches invented words, names, jargon — spelling, capitalization, and usage — and it **auto-learns from your corrections**. Your style and vocabulary persist across sessions and devices (locally).

### Fixed constraints
| Constraint | Value |
|---|---|
| Cost to user | **Free.** No subscription, no paywalled core feature. |
| Privacy | Local-first. **Default = nothing leaves the device.** Cloud is opt-in only. |
| Language/stack | **TypeScript, `strict: true`, no `any`** in app code. Native/inference sidecars may be Rust/C++/Python as needed. |
| Desktop shell | **Tauri 2** (Rust core) preferred for size/perf and single-codebase mobile reach; **Electron acceptable fallback** (matches OpenWhispr blueprint) if a needed capability is blocked. Document the choice + why. |
| UI | **React + TypeScript + Tailwind + shadcn/ui**, shared across desktop & mobile web layers. |
| Local STT | **faster-whisper / whisper.cpp** (language coverage) and/or **Parakeet TDT via sherpa-onnx** (speed). Bundled model download on first run. |
| Local cleanup LLM | Small instruct model via **Ollama or llama.cpp** (e.g. an 3–8B-class quantized model). |
| Cloud (optional) | **BYOK free tiers only** (e.g. Groq / Gemini), user-supplied key, clearly gated. No hardcoded paid keys. |
| Storage | **Local SQLite** (e.g. better-sqlite3 / SQLx). No server DB. |
| Determinism | Same audio + same dictionary + same settings → same output (temperature pinned low for cleanup). |
| Assets | No paid assets. Icons/sounds generated or open-licensed with attribution. |

### Floors — the numbers that define "good enough"
| Dimension | Floor |
|---|---|
| **End-to-end latency (desktop, local)** | From key-release to text inserted: **< 2.5 s** for a 15-second utterance on a mid-range PC; **< 1.2 s** with GPU/Parakeet. (Wispr's cloud p99 is <700 ms — we target "feels instant," not parity.) |
| **Transcription accuracy** | Use a model at or above **Whisper-small** quality; **WER target < 8%** on clear English speech. |
| **Cleanup quality** | On the verification transcripts (§Verification), cleaned output must pass the **editor test**: filler removed, sentences grammatical, punctuation correct, **lists detected and correctly terminated**, paragraphs preserved. |
| **List intelligence** | Correctly convert spoken numbered/ordinal sequences into lists **and correctly resume prose after the list** — verified against the fixture set below. |
| **Dictionary** | Custom words are (a) **biased into the transcriber** and (b) **enforced in cleanup**; a corrected word is **auto-added** and applied on the next utterance. |
| **UI responsiveness** | Overlay appears **< 100 ms** after hotkey; live mic feedback at ≥ 30 fps; no main-thread stall > 8 ms during inference (inference off the UI thread). |
| **Cold start** | App launches and is dictation-ready in **< 5 s** after models are downloaded. |
| **Offline** | Desktop core works with **network fully disabled**. Verified. |
| **Cross-platform** | Desktop: **Windows + macOS** (Linux best-effort). Mobile: **Android + iOS**, adaptive (see matrix). |

### The system — enumerated components
1. **Global hotkey / push-to-talk** (desktop): hold-to-talk and toggle modes; configurable.
2. **Audio capture**: low-latency mic stream; VAD (voice-activity detection) to trim silence; whisper-mode support (works when quiet).
3. **Transcription engine**: pluggable (whisper.cpp / faster-whisper / Parakeet-sherpa-onnx). Streaming partials where the model supports it (Moonshine/Parakeet) for live text.
4. **Dictionary-biasing layer**: inject custom terms into the STT (`initial_prompt` / hotword biasing) before transcription.
5. **Cleanup LLM stage** — *the heart* (see contract below).
6. **Insertion layer** (desktop): paste/type at cursor via OS accessibility; fallback to clipboard-paste. Mobile: custom keyboard / share-sheet / in-app.
7. **Command Mode** (Tier 2): select existing text, speak an instruction ("make formal", "bulletize", "translate"), replace in place.
8. **Backtrack / self-correction**: strip false starts on "actually"/"scratch that" and on restatement, without over-triggering on legit usage.
9. **Personal dictionary store** + **auto-add-from-corrections** watcher.
10. **History** (local, optional, deletable): past dictations, re-copy, redo cleanup.
11. **Settings**: hotkeys, model choice, writing style/tone presets, per-app style rules (Tier 2), privacy toggles, cloud key entry.
12. **State machine + overlay UI** driving all of the above.

### The cleanup-LLM contract (build this precisely — it *is* the product)
The cleanup stage takes `{ raw_transcript, custom_dictionary[], writing_style, target_context }` and returns clean text. Its system prompt must encode these rules:

- **Preserve meaning; never invent content.** Only reformat/repair what was said.
- **Remove disfluencies**: `um, uh, like, you know, I mean, sort of` (as filler), stutters, and repeated restarts.
- **Backtrack**: if the speaker self-corrects ("2 pm, actually 3 pm" / "scratch that"), keep only the corrected version. Do **not** trigger on meaningful "actually/like" (e.g. "I actually liked it", "it's like glue").
- **Punctuation & casing**: add correct punctuation, capitalize sentence starts and proper nouns, honor spoken punctuation words ("period", "new paragraph", "comma").
- **List detection (the signature behavior)** — encode explicitly with examples:
  - Spoken **numbers or ordinals in sequence** ("one … two … three" / "first … second") → a **numbered list**.
  - Item content = the words between markers; the list **ends** when the speaker stops the sequence and returns to prose (no next number/ordinal, or a clear closing clause) → **resume paragraph formatting**.
  - Support bulleted lists when the speaker says "bullet" / "next item" without ordinals.
  - **Worked example (must pass):**
    - *Input:* "so before we get groceries let me note from the store I need one milk two eggs three bread and then after that we can head home and start cooking dinner"
    - *Output:*
      ```
      So before we get groceries, let me note. From the store I need:
      1. Milk
      2. Eggs
      3. Bread

      And then after that, we can head home and start cooking dinner.
      ```
- **Custom dictionary enforcement**: any provided term must be spelled/capitalized exactly as defined, even if it sounds like a common word.
- **Style/tone**: apply the selected writing style (e.g. Professional / Casual / Messaging). In messaging contexts, allow lowercase-casual and drop trailing periods (mirrors Wispr's context behavior) — only if that style is selected.
- **Determinism**: low temperature; the same input yields the same clean output.
- Provide a **few-shot prompt fixture file** with ≥ 10 worked input→output pairs (lists, mixed list+prose, self-correction, dictionary words, multi-paragraph) that also serve as regression tests.

### UI/UX spec
- **Overlay** (desktop): small, draggable, near-cursor or docked; glassy/calm aesthetic; light + dark; respects OS theme.
- **States** with distinct visuals + optional subtle sound: `idle → listening (live waveform/level) → thinking (processing shimmer) → inserting → done`; plus `error` (mic denied, model missing, offline-but-cloud-selected).
- **Onboarding**: permission requests (mic, accessibility), one-click model download with progress, a 20-second interactive "try it now" that dictates into a sample box, hotkey teach.
- **Settings**: hotkeys; engine/model picker with size/speed/accuracy tradeoff shown; writing-style presets; personal dictionary manager (add/edit/import/export, per-term casing + example usage); privacy panel (what's local, cloud opt-in, delete-all-data); history.
- **Mobile**: a polished in-app dictation screen + (Tier 2) a **custom keyboard**/share target so cleaned text drops into other apps; the same state machine and styling.
- **Accessibility**: full keyboard nav, screen-reader labels, high-contrast mode, large-text support (this is an assistive tool — treat a11y as core, not optional).

### Model auto-selection by device tier (no fixed specs — this app ships to many users)
The app must **detect the device on first run and pick models automatically** — never assume one machine. Provide a manual override in Settings, but the default is chosen for the user.
- **Low tier** (older/weak CPU, no usable GPU, ≤ 8 GB RAM, or budget phone): STT = Whisper `tiny`/`base` or Parakeet-small; cleanup = smallest local instruct model (~1–2B) **or** offer opt-in free cloud if local is too slow. Prioritize "it works" over max quality.
- **Mid tier** (typical laptop, 8–16 GB RAM, integrated/modest GPU): STT = Whisper `small`/`large-v3-turbo` or Parakeet; cleanup = ~3–4B local model. This is the default target for the latency floors.
- **High tier** (16 GB+ RAM, discrete GPU): STT = `large-v3-turbo`/Parakeet on GPU; cleanup = ~7–8B local model for best output.
- Run a quick **one-time benchmark** on first launch (transcribe + clean a short built-in sample) to confirm the chosen tier hits the latency floor; downshift automatically if not. Show the user what was selected and let them change it.

### Platform matrix (desktop-primary, mobile-adaptive)
| Capability | Desktop (primary) | Mobile (adaptive) |
|---|---|---|
| Runs pipeline locally/offline | **Yes, default** | Yes on capable devices; else opt-in cloud |
| STT model | large-v3-turbo / Parakeet, GPU if present | tiny/base on-device, or platform ASR, or cloud (opt-in) |
| Cleanup LLM | local 3–8B via Ollama/llama.cpp | small on-device model on strong phones; else opt-in free cloud |
| Insert into any app | **Yes** (accessibility + hotkey) | Custom keyboard / share sheet (Tier 2); in-app always |
| Device-capability detection | n/a | **Required**: pick local vs cloud path from device specs; never silently upload |

### Privacy & account model (enforce, don't hand-wave)
- **No account required** for full local use.
- **Local-only account**: unlocks local history + dictionary persistence; credentials + data stay on-device (or user-controlled storage). **No company server.**
- **Cloud is always opt-in**, per-provider, with a visible "audio will be sent to X" notice each time it's active, and an easy off switch.
- **No content telemetry.** If any anonymous usage metric exists, it's opt-in and never includes audio/text.
- One-click **delete all data**.

### Verification battery (run at every phase close)
1. **Cleanup fixture suite**: the ≥10 input→output pairs must pass (lists, list→prose resume, self-correction, dictionary, multi-paragraph). This is the gate that proves the pillar.
2. **The signature-list test**: the grocery example above renders exactly (list formed *and* prose resumes).
3. **Filler test**: a transcript seeded with um/uh/false-starts comes out clean, meaning intact.
4. **Dictionary test**: define an invented word (e.g. a made-up game name); it's spelled/capitalized correctly; then correct a different word and confirm **auto-add** applies it next time.
5. **Offline test**: disable network on desktop; full flow still works.
6. **Latency test**: measure key-release→insertion on a 15-s utterance; meet the floor.
7. **Insertion test**: text lands correctly in ≥3 real apps (e.g. a browser field, an editor, a chat app).
8. **State/UX test**: all overlay states reachable and visually distinct; permission-denied and model-missing paths handled gracefully.
9. **Cross-platform smoke**: build + basic flow on Windows, macOS, Android, iOS (simulator OK where hardware absent).

### Phase plan — gated (a phase closes only after build → run → battery → fix top issues)
| Phase | Deliverable | Gate |
|---|---|---|
| 0 | Scaffold (Tauri 2 + React/TS/Tailwind/shadcn), state machine, overlay shell, SQLite, hotkey, mic capture, test harness with fixture files wired in | App launches; hotkey shows overlay; fixtures load |
| 1 | Local STT integrated; raw transcript inserts at cursor (desktop) | Speak → raw text appears in another app |
| 2 | **Cleanup LLM stage** + the full contract (filler, punctuation, **list detection + resume**, backtrack) | Cleanup fixture suite + signature-list test pass |
| 3 | Personal dictionary: biasing + enforcement + **auto-add from corrections** | Dictionary test passes |
| 4 | UI polish: all states, live mic feedback, onboarding, settings, history, a11y | State/UX test; a11y audit |
| 5 | Privacy/account model + cloud-optional (BYOK) with opt-in gating; offline verified | Offline test; privacy audit |
| 6 | Mobile app (adaptive local/cloud, device detection) + share/keyboard target | Cross-platform smoke; mobile flow |
| 7 | Performance + packaging/installers; final full battery | Latency floor; full battery green |
| Tier 2 | Command Mode; per-app style rules; multilingual; streaming live-text | after core battery passes |

### Banned outcomes — instant fail
- Output is a **raw transcript** with filler/no punctuation/no list intelligence ("it transcribes" is not the goal).
- **List behavior missing**: numbered speech doesn't become a list, or the list never terminates back to prose.
- **Audio/text sent off-device by default** or without a visible notice; any hidden telemetry of content.
- **Account required** to use the core, or account data living on a company server.
- The cleanup stage **invents or drops meaning**.
- One-giant-file architecture; `any`-typed TS; a `// TODO` in a closed phase.
- Ugly/placeholder UI shipped as "done"; unhandled permission-denied / model-missing / offline states.
- Asking the user to accept a subscription, a paid model, or "just copy-paste" as the only insertion path on desktop.

### Self-score rubric (score after each phase; write "what raises this +2"; fix the two cheapest before proceeding)
Rows: transcription accuracy · **cleanup quality** · **list/format intelligence** · filler/backtrack handling · dictionary learning · latency · UI polish & states · onboarding friction · privacy guarantees · cross-platform reach · accessibility · offline robustness.
(10 = indistinguishable from Wispr Flow's clean output on a glance; 7 = clearly good, same class; 4 = decent hobby tool; 2 = raw transcription box.)

### Final acceptance — the one-take test
Record one **5-minute stream-of-consciousness** that includes: rambling prose with filler, an embedded numbered shopping/todo list that then returns to prose, one self-correction, and one invented dictionary word. Run it through the desktop app **offline**. If the inserted result reads like **carefully edited writing** — filler gone, list correctly formed *and* closed, invented word spelled right, meaning intact — the project has done its job. Until then, iterate on the cleanup stage.

---

## Notes for handing this to a builder
- This spec is self-contained; paste the **"THE BUILD-SPEC"** section onward to the builder. The **Context** section above is background for you.
- **Screenshots**: the user has screenshots of the current Wispr Flow UI. Share them with the builder in Phase 4 (UI) as the visual reference to match/beat.
- If any Tier-1 floor proves infeasible on target hardware, the builder should substitute the nearest feasible option and log it — **never silently lower the bar, and never break the privacy-default pillar.**
- Recommended first concrete step for the builder: stand up Phase 0 + the **cleanup fixture file** early, because the fixtures define success for the whole project.
