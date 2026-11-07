# 🏋️ PaceFuel — Elite AI Wellness Ecosystem

<p align="center">
  <img src="public/app-logo.png" alt="PaceFuel Logo" width="120" />
</p>

<p align="center">
  <strong>AI-powered fitness & nutrition tracking for athletes who mean business.</strong><br/>
  Built with React + TypeScript + Firebase + Google Gemini.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Firebase-12-FFCA28?style=flat-square&logo=firebase" />
  <img src="https://img.shields.io/badge/Gemini_AI-2.5-4285F4?style=flat-square&logo=google" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?style=flat-square&logo=capacitor" />
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Android-green?style=flat-square" />
</p>

---

## What is PaceFuel?

PaceFuel is a cross-platform wellness app (web + Android APK) that uses Google Gemini to give athletes a genuinely intelligent training partner. It's not just a logger — it analyzes your photos, generates personalized workout plans, coaches you in real-time, and adapts to your goals.

---

## Features

| Feature | Description |
|---|---|
| 📸 AI Food Analysis | Snap a photo — Gemini identifies food and estimates macros (specialized for Indian cuisine) |
| 🏋️ AI Workout Plans | Custom plans generated from your athlete type, equipment, and goals |
| 🤖 AI Wellness Coach | Science-based conversational coaching with persistent session memory |
| 📊 Performance Analytics | Weekly trends, calorie tracking, and personal bests via Recharts |
| 💧 Holistic Tracking | Workouts, nutrition, hydration, supplements, steps, and mindfulness |
| 🧘 Wellness & Recovery | Meditation timers, mood tracking, AI-generated meditation scripts |
| 🗺️ Muscle Map | Visual tracker for muscle group targeting and recovery status |
| 📱 Native Android | Full APK via Capacitor with Firebase auth (Email/Password + Anonymous) |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Styling | Tailwind CSS 4, custom hardware-specialist dark aesthetic |
| Backend | Firebase 12 (Firestore, Auth, Storage) |
| AI Engine | Google Gemini 2.5 Flash + 3.1 Pro via `@google/genai` |
| Native Bridge | Capacitor 8 (Android) |
| Animations | Framer Motion |
| Data Viz | Recharts |

---

## Project Structure

```
pace-fuel/
├── src/
│   ├── components/
│   │   ├── Layout.tsx          # Main nav shell, bottom bar
│   │   ├── MuscleMap.tsx       # SVG muscle group tracker
│   │   ├── WellnessCoach.tsx   # AI chat coach component
│   │   ├── AutoStepTracker.tsx # Automatic step counting
│   │   └── ErrorBoundary.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx       # Health score, daily summary
│   │   ├── FoodLog.tsx         # Meal log + macro breakdown
│   │   ├── AddFood.tsx         # AI photo food entry
│   │   ├── Training.tsx        # Exercise log + AI plan generator
│   │   ├── Wellness.tsx        # Meditation, sleep, supplements
│   │   ├── Progress.tsx        # Charts, trends, personal bests
│   │   ├── Strategy.tsx        # AI macro/training strategy
│   │   ├── ProfileSetup.tsx    # Onboarding + goal config
│   │   └── Login.tsx           # Firebase auth (Google/Email/Anon)
│   ├── services/
│   │   └── aiService.ts        # Gemini API calls, caching, retries
│   ├── lib/
│   │   ├── stepTracking.ts
│   │   ├── foodLogging.ts
│   │   ├── runtimeConfig.ts    # API key runtime resolution
│   │   ├── mealTypes.ts
│   │   └── utils.ts
│   ├── firebase.ts             # Firebase init + Firestore helpers
│   ├── types.ts                # All TypeScript interfaces
│   ├── App.tsx                 # Router, auth guard, lazy loading
│   └── main.tsx
├── android/                    # Capacitor Android project
├── public/
│   └── app-logo.png
├── firebase-applet-config.json # Firebase project config
├── firebase-blueprint.json     # Firestore schema reference
├── firestore.rules             # Security rules
├── capacitor.config.ts
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Firebase project ([console.firebase.google.com](https://console.firebase.google.com))
- A Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))

### 1. Clone & Install

```bash
git clone https://github.com/your-username/pace-fuel.git
cd pace-fuel
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in your Gemini API key:

```env
GEMINI_API_KEY="your-key-here"
```

> Firebase config is already bundled in `firebase-applet-config.json`. If using your own Firebase project, replace the values there.

### 3. Enable Firebase Services

In Firebase Console, enable:
- **Authentication** — Email/Password and Anonymous providers
- **Firestore Database** — start in test mode, then deploy `firestore.rules`
- **Storage** (optional, for food photo uploads)

### 4. Deploy Firestore Rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 5. Run Dev Server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## Building for Production

### Web

```bash
npm run build
# Output in dist/ — deploy to Vercel, Firebase Hosting, or any static host
```

### Android APK

Requirements: Android Studio + Java JDK 17.

```bash
npm run build
npx cap sync android
# Then open android/ in Android Studio → Build > Build APK(s)
```

A prebuilt APK is included at `pace-fuel.apk` in this repo for direct install.

---

## AI Features Setup

The app works in offline mode without a Gemini key — basic tracking still functions. To unlock AI features:

**Option A — build-time (web/APK):** Set `GEMINI_API_KEY` in `.env` before building.

**Option B — runtime:** Paste your key into the **Online Setup** modal inside the app. No rebuild needed.

| Feature | Gemini Model |
|---|---|
| Food photo analysis | `gemini-2.5-flash-preview` |
| Workout plan generation | `gemini-3-flash-preview` |
| Wellness coach chat | `gemini-3-flash-preview` |
| Meditation script generation | `gemini-2.5-flash-preview` |
| Performance strategy | `gemini-3-flash-preview` |

---

## Firestore Data Model

| Collection | Document ID | Key Fields |
|---|---|---|
| `users` | `{uid}` | athleteType, goal, dailyGoals |
| `foodLogs` | auto | userId, name, calories, macros, mealType |
| `exercises` | auto | userId, name, duration, muscleGroup |
| `waterLogs` | auto | userId, amount |
| `wellnessSessions` | auto | userId, type, duration, score |
| `supplementLogs` | auto | userId, name, taken |
| `stepLogs` | auto | userId, steps, dateKey |
| `weight_logs` | auto | userId, weight |

Full schema reference: [`firebase-blueprint.json`](./firebase-blueprint.json)

---

## Scripts

```bash
npm run dev       # Start dev server on :3000
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run lint      # TypeScript type check
npm run clean     # Remove dist/
```

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with clear messages
4. Push and open a PR

---

## License

MIT © 2026 PaceFuel

---

> Built with React, Firebase, and Google Gemini. Designed for athletes who don't cut corners.
