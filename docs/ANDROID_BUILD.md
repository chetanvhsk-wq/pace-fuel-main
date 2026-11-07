# Android APK Build Guide

How to build a fresh APK from source.

---

## Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Java JDK | 17 | [adoptium.net](https://adoptium.net) |
| Android Studio | Latest stable | [developer.android.com](https://developer.android.com/studio) |

After installing Android Studio, also install:
- **Android SDK** (API Level 34 recommended)
- **Android SDK Build-Tools**

Set `JAVA_HOME` and `ANDROID_HOME` in your shell profile if Android Studio doesn't do it automatically.

---

## Build Steps

```bash
# 1. Install dependencies
npm install

# 2. Set up your .env (Gemini key optional — AI works at runtime too)
cp .env.example .env

# 3. Build the web bundle
npm run build

# 4. Sync to Capacitor Android project
npx cap sync android

# 5. Open in Android Studio
npx cap open android
```

In Android Studio:
- Wait for Gradle sync to complete
- Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Signing for Release

For a release APK (Play Store or direct distribution):

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore pace-fuel-release.keystore -alias pace-fuel -keyalg RSA -keysize 2048 -validity 10000
   ```
2. In Android Studio: **Build → Generate Signed Bundle / APK**
3. Point to your keystore file and fill in the credentials

> Keep your `.keystore` file backed up and **never commit it**.

---

## Troubleshooting

**Gradle sync fails**
- Make sure Java JDK 17 is active (`java -version`)
- In Android Studio: File → Invalidate Caches → Restart

**`npx cap sync` errors**
- Run `npm run build` first — Capacitor needs `dist/` to exist

**Firebase auth not working on device**
- Ensure Email/Password and Anonymous auth are enabled in Firebase Console
- Google sign-in popup is web-only in current build

**AI features not working in APK**
- Either set `GEMINI_API_KEY` in `.env` before `npm run build`, or use the in-app Online Setup to paste your key at runtime
