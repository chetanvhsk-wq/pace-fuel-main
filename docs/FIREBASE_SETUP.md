# Firebase Setup Guide

This guide walks you through connecting PaceFuel to your own Firebase project.

---

## 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name it `pace-fuel` (or anything you like)
4. Disable Google Analytics if you don't need it → **Create project**

---

## 2. Enable Authentication

1. In the Firebase Console, go to **Build → Authentication → Get started**
2. Enable these providers:
   - **Email/Password** — for APK and web
   - **Anonymous** — for guest access
   - **Google** — for web popup login (optional, web-only in current build)

---

## 3. Create Firestore Database

1. Go to **Build → Firestore Database → Create database**
2. Start in **production mode** (you'll deploy proper rules in a moment)
3. Choose the region closest to your users (e.g. `asia-south1` for India)

---

## 4. Deploy Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project, accept defaults for rules file
firebase deploy --only firestore:rules
```

The `firestore.rules` file in this repo covers all collections with per-user access control.

---

## 5. Get Your Firebase Config

1. In the Console, go to **Project Settings (⚙️) → General → Your apps**
2. Click **Add app → Web**
3. Register the app, copy the `firebaseConfig` object

Open `firebase-applet-config.json` and replace with your values:

```json
{
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123:web:abc",
  "firestoreDatabaseId": "(default)"
}
```

> **Never commit this file with real credentials to a public repo.** Add it to `.gitignore` or use environment variable injection at build time.

---

## 6. Android Setup (APK)

For the Android build, Firebase Auth works without `google-services.json` in the current setup — it uses the web config via Capacitor. If you need native Firebase SDK features, download `google-services.json` from your project settings and place it at `android/app/google-services.json`.

---

## 7. Storage (Optional)

If you want food photo uploads to persist (not just base64 in memory):

1. Go to **Build → Storage → Get started**
2. Set up rules to allow authenticated users to upload
3. Update the food logging code in `src/services/aiService.ts` to upload to Storage and store the URL in Firestore

---

## Firestore Indexes

The app uses compound queries on some collections. If you see index errors in the console, Firebase will show a direct link to create the index — just click it. Common ones needed:

- `foodLogs` — `userId` asc + `timestamp` desc
- `exercises` — `userId` asc + `timestamp` desc
- `stepLogs` — `userId` asc + `dateKey` asc
