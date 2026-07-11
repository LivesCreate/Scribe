# Scribe — mobile app

A real, installable **Android app** (React Native + TypeScript + Expo) that dictates
through your PC's local Scribe models. Same language and cleanup pipeline as the
desktop app — the phone records, the PC transcribes and cleans, nothing touches
the internet.

This is **Phase B1** of the mobile plan: the phone depends on the PC. On-device
(offline) transcription comes later (B2/B4).

## What it does today
- Tap the mic to start, tap again to stop.
- Recording is sent to your PC's Scribe bridge (`POST /dictate`), cleaned by the
  same qwen model, and shown back with a **Copy** button.
- Pick a writing style (Professional / Casual / Messaging).
- First launch asks for your PC's address + phone-access token (stored in the
  phone's secure store).

## Prerequisites on the PC (one time)
1. Run the desktop app with the mobile-audio support (this repo's current code):
   ```bash
   cd ..            # the Scribe desktop root
   npm run dev      # or install a fresh build: npm run package
   ```
   > The desktop app now bundles `ffmpeg` to transcode the phone's `.m4a` to the
   > 16 kHz WAV Whisper needs. A build from before that change won't accept phone
   > audio — rebuild first.
2. In Scribe → **Settings → Phone access**, turn it on. Note the **address**
   (e.g. `192.168.1.24:8737`) and the **token**.
3. Phone and PC must be on the **same Wi-Fi**.

## Test it now (no build, ~2 minutes)
1. On the phone, install **Expo Go** from the Play Store.
2. On the PC:
   ```bash
   cd mobile
   npm install        # first time only
   npx expo start
   ```
3. Scan the QR code with Expo Go. Enter the PC address + token, then dictate.

## Build the real installable APK (EAS cloud build)
This machine has no Android SDK, so the APK is built in Expo's cloud. You need a
free Expo account (the login step can only be done by you):

```bash
cd mobile
npx eas-cli login                              # your free Expo account
npx eas-cli init                               # creates the project, writes projectId
npx eas-cli build -p android --profile preview # builds an installable .apk
```

When it finishes (~10–15 min) EAS prints a URL — open it on the phone and install
the APK. `preview` = internal-distribution APK; `production` = Play Store bundle.

## Over-the-air updates ("update really good")
After the first login, enable OTA JS updates so you can ship changes without
rebuilding the APK:

```bash
npx eas-cli update:configure
npx eas-cli update --branch preview -m "what changed"
```

Installed apps on the `preview` channel pick the update up on next launch.

## Project layout
- `App.tsx` — the two screens (dictation + first-run PC setup).
- `src/config.ts` — PC connection (host/port/token) in secure storage.
- `src/api.ts` — the `POST /dictate` call and a liveness `ping`.
- `app.json` / `eas.json` — Expo + build configuration.
