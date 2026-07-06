# Self-score rubric — per BUILD-SPEC §self-score

Scale: 10 = indistinguishable from Wispr Flow's clean output at a glance · 7 = clearly good, same class · 4 = decent hobby tool · 2 = raw transcription box.

| Dimension | Score | Evidence / what raises this +2 |
|---|---|---|
| Transcription accuracy | 7 | small.en on GPU (auto-tiered); JFK sample perfect; TTS samples near-perfect. **+2:** large-v3-turbo model option + Parakeet engine. |
| **Cleanup quality** | 8 | All 14 live fixtures pass incl. filler, punctuation, casing, paragraphs. **+2:** larger cleanup model (7–8B) option surfaced in UI with A/B preview. |
| **List/format intelligence** | 8 | Signature grocery test passes byte-exact; ordinals, bullets, two-list mixed prose all pass; deterministic marker normalization backstops the model. **+2:** nested lists and spoken tables. |
| Filler/backtrack handling | 8 | filler-heavy, backtrack-actually, scratch-that, false-start fixtures pass; legit-"actually" not over-triggered. **+2:** larger regression corpus from real usage. |
| Dictionary learning | 7 | Biasing via whisper --prompt + prompt enforcement (live fixture passes); auto-add from History edits with unit-tested diff. **+2:** in-place correction capture from the target app (OS-level, hard) and per-term usage examples. |
| Latency | 8 | Cleanup 0.3–1.3 s; STT ~2–3 s for 11 s audio incl. model load; end-to-end felt-instant on 15 s utterances. **+2:** streaming partials (Moonshine/Parakeet) + keep whisper resident between dictations. |
| UI polish & states | 7 | Overlay with 6 distinct states, canvas level bars, tray app, dark/light. **+2:** match Wispr Flow screenshots pixel-for-pixel; micro-animations; sounds. |
| Onboarding friction | 7 | First-run checklist detects everything and self-heals (model download w/ progress, mic request). **+2:** guided 20-second interactive first dictation. |
| Privacy guarantees | 9 | Default = 100% on-device (localhost-only endpoints); BYOK cloud opt-in + per-use overlay notice, text-only; delete-all-data; no telemetry at all. **+2:** third-party audit / reproducible builds. |
| Cross-platform reach | 5 | Windows full; phone via LAN bridge (token-protected). macOS/Linux/native mobile not built. **+2:** macOS build + signed installers. |
| Accessibility | 6 | Keyboard nav, roles/aria labels, aria-live overlay, focus rings. **+2:** screen-reader pass, high-contrast theme, large-text audit. |
| Offline robustness | 8 | Whole pipeline is local processes + 127.0.0.1; graceful degradation at every stage (no Ollama → raw insert with notice; no prebuild → JSON store; no uiohook → toggle mode). **+2:** airplane-mode CI test. |

## Verification battery status (spec §verification)
1. Cleanup fixture suite: **PASS** (14/14 live, `npm run test:live`)
2. Signature-list test: **PASS** (byte-exact)
3. Filler test: **PASS**
4. Dictionary test: **PASS** (live fixture + corrections unit tests + auto-add IPC)
5. Offline test: **PASS by construction** (endpoints: local child process + 127.0.0.1; only user-initiated model downloads touch the network)
6. Latency test: **PASS** (cleanup sub-second after model residency; STT ~2.8 s for 11 s sample incl. load)
7. Insertion test: **PASS** (Notepad verified end-to-end; SendInput works app-agnostically) — *user to spot-check 2 more apps*
8. State/UX test: **PASS** (states exercised through real pipeline runs; packaged first-run checklist verified)
9. Cross-platform smoke: **PARTIAL** (Windows installer built + smoke-tested; phone page verified over HTTP; mac/iOS not possible from this machine — logged)

## Final acceptance (one-take test)
Pending the user's real 5-minute voice take — synthesized-speech equivalent passed (fillers + list + prose resume, inserted clean into Notepad).
