<div align="center">



# PaceFuel
### AI Wellness. Built for how India actually eats and trains.

**PaceFuel is a smart, full-stack wellness app that understands your food, your body, and your goals — powered by Google Gemini and Firebase.**


</div>

---

## The Problem With Fitness Apps

Most apps are built for Western diets and Western workout cultures. They don't know what a dosa is. They've never heard of dal makhani. They assume you eat chicken breast for every meal and have a full gym setup.

PaceFuel is different. It was built from the ground up for real people — especially people in India — who want to track what they actually eat, train the way they actually train, and get advice that actually applies to their life.

---

## What PaceFuel Does

PaceFuel is a **complete AI wellness ecosystem**. Not just a calorie counter, not just a workout logger — it's a system that connects your food, your movement, your sleep, your stress, and your goals into one intelligent loop.

Here's what that looks like in practice:

**You photograph your lunch** — say, a plate of rice, sambar, and papad. PaceFuel's AI identifies every item, estimates the macros, and logs it in two taps. No manual searching, no guessing portion sizes, no American food database that's never seen a home-cooked Indian meal.

**You tell it your goal** — lose fat, build muscle, improve performance, or just feel better. PaceFuel builds you a personalized workout plan based on what equipment you have (or don't have), how many days a week you can train, and what kind of athlete you are.

**You talk to your wellness coach** — an AI sports scientist that knows your data: your calories for the week, your sleep scores, your hydration, your personal bests. It doesn't give generic advice. It knows you trained legs yesterday and that you're under on protein today.

**You close the loop** — daily health score, weekly trends, muscle recovery map, strategy adjustments. Everything connects.

---

## Features

### 📸 AI Food Analysis — Understands Indian Food
Snap a photo of your meal. PaceFuel sends it to Gemini 2.5 Flash and gets back a full macro breakdown in seconds. The system is specifically trained and prompted to recognize Indian cuisine — regional dishes, home-cooked meals, street food, restaurant portions. Dal, biryani, chole bhature, paneer butter masala, idli sambar, pav bhaji — it knows them all, with reasonable estimates for home-cooked portions vs restaurant sizes.

### 🏋️ AI Workout Plan Generator
Tell PaceFuel your athlete type (endurance, strength, hybrid, or general fitness), what equipment you have access to, how often you train, and what you're working toward. Gemini generates a full multi-week workout plan — exercises, sets, reps, rest periods, progression notes — built specifically for your inputs, not pulled from a generic template.

### 🤖 AI Wellness Coach
An always-available AI coach that knows your data. The coach reads your recent food logs, hydration, training volume, and wellness scores before every conversation — so when you ask "why am I feeling sluggish?" it can actually look at your numbers and tell you, instead of giving you a Wikipedia paragraph about sleep hygiene.

### 📊 Performance Analytics & Personal Bests
Weekly charts for calories, weight, and workout volume. A rolling leaderboard of your personal bests for every tracked lift. Trend analysis that surfaces patterns you wouldn't notice yourself — "you consistently under-eat on rest days" or "your strength peaks on Tuesdays."

### 🗺️ Muscle Map
An interactive SVG map of the human body showing which muscle groups you've trained, with what volume, and how recovered they are. See at a glance if you're overloading one area or neglecting another.

### 💧 Holistic Tracking
Every dimension of wellness in one place:
- Food logs (breakfast, lunch, dinner, snacks)
- Water intake with daily goal tracking
- Supplements and vitamins (with daily check-off)
- Steps — manual or automatic via AutoStepTracker
- Bodyweight log
- Meditation and mindfulness sessions with AI-generated scripts
- Sleep and stress tracking

### 🧘 Wellness & Recovery
Meditation timer with AI-generated scripts that adapt to your current mood. Stress tracking. Sleep quality scoring. The app treats recovery as a performance variable, not an afterthought.

### 🌐 Dynamic Health Score
Every day gets a score from 0–100, calculated from your calorie balance, hydration, step count, and mindfulness progress. It's not just a vanity number — it's a quick signal for whether you're on track, and the AI coach uses it to contextualize its advice.

---

## App Preview

> Screenshots coming soon — build the project and run `npm run dev` to explore it live.

The UI follows a hardware-specialist dark aesthetic: dark matte surfaces, vibrant accent glows, monospace data labels, and tactile motion. Think performance tool, not lifestyle app.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project — [console.firebase.google.com](https://console.firebase.google.com)
- A Gemini API key — [aistudio.google.com](https://aistudio.google.com) (free tier works)

### Install

```bash
git clone https://github.com/your-username/pace-fuel.git
cd pace-fuel
npm install
```

### Configure

```bash
cp .env.example .env
```

Add your Gemini API key to `.env`:
```env
GEMINI_API_KEY="your-key-from-ai-studio"
```

Firebase config is already in `firebase-applet-config.json`. If you're connecting your own Firebase project, replace those values. See [Firebase Setup Guide](./docs/FIREBASE_SETUP.md).

### Run

```bash
npm run dev
# → http://localhost:3000
```

The app works without a Gemini key — basic tracking is fully functional offline. AI features activate when a key is present (bundled or pasted at runtime in the Online Setup modal).

---

## AI Features

All AI features route through `src/services/aiService.ts`, which handles caching, retries, timeouts, and in-flight deduplication. The app is designed to degrade gracefully — if the AI is unavailable or the key is missing, everything else still works.

| Feature | Model | What it does |
|---|---|---|
| Food photo analysis | Gemini 2.5 Flash | Identifies food items, estimates macros — optimized for Indian cuisine |
| Workout plan generation | Gemini 3 Flash | Builds full multi-week plans from your profile |
| Wellness coach | Gemini 3 Flash | Conversational coaching with access to your live data |
| Meditation scripts | Gemini 2.5 Flash | Generates guided scripts based on current mood |
| Performance strategy | Gemini 3 Flash | Analyzes 7-day data and suggests macro/training adjustments |

**Key design decisions:**
- Results are cached in memory + localStorage for 15 minutes — no duplicate API calls
- 8-second timeout per request with 1 automatic retry
- Identical concurrent requests share one API call (in-flight dedup)
- API key can be set at runtime via the in-app modal — no rebuild needed

Full docs: [AI Features →](./docs/AI_FEATURES.md)

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + TypeScript 5.8 | Strict type safety, latest concurrent features |
| Build | Vite 6 | Sub-second HMR, optimized production builds |
| Styling | Tailwind CSS 4 | Utility-first, no runtime CSS-in-JS overhead |
| Backend | Firebase 12 (Firestore + Auth) | Real-time sync, offline support, zero backend ops |
| AI | Google Gemini via `@google/genai` | Best vision model for food analysis, strong multilingual support |
| Native | Capacitor 8 | Web-first Android without React Native's tradeoffs |
| Animations | Framer Motion | Smooth, performant transitions |
| Charts | Recharts | Composable, TypeScript-native data visualization |

---

## Project Structure

```
pace-fuel/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx       Health score, daily summary, quick stats
│   │   ├── FoodLog.tsx         Meal log with macro breakdown
│   │   ├── AddFood.tsx         AI photo food entry
│   │   ├── Training.tsx        Exercise log + AI plan generator
│   │   ├── Wellness.tsx        Meditation, sleep, supplements, hydration
│   │   ├── Progress.tsx        Charts, trends, personal bests
│   │   ├── Strategy.tsx        AI macro and training recommendations
│   │   ├── ProfileSetup.tsx    Onboarding, goals, athlete type
│   │   └── Login.tsx           Firebase auth
│   ├── components/
│   │   ├── Layout.tsx          Shell, navigation, bottom bar
│   │   ├── MuscleMap.tsx       SVG muscle group tracker
│   │   ├── WellnessCoach.tsx   AI coach chat interface
│   │   └── AutoStepTracker.tsx Passive step counting
│   ├── services/
│   │   └── aiService.ts        All Gemini API calls, caching, retries
│   ├── firebase.ts             Firebase init + Firestore helpers
│   └── types.ts                Full TypeScript interfaces
├── android/                    Capacitor Android project
├── firestore.rules             Production-ready security rules
├── firebase-blueprint.json     Firestore schema reference
└── docs/
    ├── FIREBASE_SETUP.md
    ├── ANDROID_BUILD.md
    └── AI_FEATURES.md
```

---

## Firestore Schema

| Collection | Description |
|---|---|
| `users/{uid}` | Profile: athleteType, goals, daily targets, equipment, PRs |
| `foodLogs` | Meals: name, macros, mealType, imageUrl, timestamp |
| `exercises` | Workouts: name, duration, muscleGroup, sets, reps, volume |
| `waterLogs` | Hydration entries |
| `wellnessSessions` | Meditation, sleep, stress sessions with scores |
| `supplementLogs` | Daily supplement check-offs |
| `stepLogs` | Daily step counts with dateKey deduplication |
| `weight_logs` | Bodyweight entries for trend tracking |

Security rules enforce per-user isolation on all collections — no cross-user reads or writes. See `firestore.rules`.

---

## Building the Android APK

Requirements: Android Studio + Java JDK 17.

```bash
npm run build
npx cap sync android
npx cap open android
# Build → Build APK(s) in Android Studio
```

A prebuilt debug APK is available in the repo root as `pace-fuel.apk`.

Full guide: [Android Build →](./docs/ANDROID_BUILD.md)

---

## Scripts

```bash
npm run dev       # Dev server on :3000
npm run build     # Production build → dist/
npm run preview   # Preview the production build
npm run lint      # TypeScript type check (no emit)
npm run clean     # Remove dist/
```

---

## Team

PaceFuel was built by a 5-person team across 4 specialized layers. Each person owned a distinct part of the stack end to end.

| Layer | Role | Name | Responsibilities |
|---|---|---|---|
| Layer 1 — Surface UI | Product Designer | **Bharath Reddy KV** | UI behavior, design patterns, paper sketches → feature mapping → Figma handoff to frontend |
| Layer 2 — Interactive Code | Frontend Developer | **Akshay S** | UI structuring from Figma handoff, backend integration connecting data endpoints to UI components, responsive architecture across mobile/tablet/desktop |
| Layer 2 — Interactive Code | Frontend Developer | **Aravind Krishna SA** | Reusable UI component library, animations/gestures/transitions, cross-device and cross-resolution debugging & QA |
| Layer 3 — Server Foundation | Backend Developer | **Akash N** | Firebase Firestore DB design (3 collections: User Profiles, Workouts, Nutrition Logs), secure auth with token-based session management, real-time sync via Firestore listeners — zero polling |
| Layer 4 — Intelligence Cloud | Backend & AI Developer | **Chetan** | External AI APIs integration, food image recognition via computer vision, NLP-based nutrition estimation, dynamic AI assistant with LLM context injection, ML predictive analytics, structured data output pipeline |

### How the stack connects

Every feature in PaceFuel flows through all four layers. The AI food analysis feature is the clearest example:

1. **Bharath** designed the Analyze Meal interface and the post-scan macro display
2. **Akshay & Aravind** built the trigger, formatted the API request with ImageID + UserID, dispatched it to the backend
3. **Chetan** received the raw image, ran computer vision to identify the food item, estimated the macro profile, and returned structured JSON
4. **Akash** logged the result to Firestore, updated the user profile, and pushed the real-time refresh to the dashboard

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first — it covers branch naming, commit style, and the PR checklist.

For bugs, open an issue using the bug report template. For feature ideas, start a Discussion.

---

## Roadmap

- [ ] iOS optimization via Capacitor
- [ ] Google Fit / Apple Health integration for automatic step sync
- [ ] Offline-first Firestore persistence
- [ ] Push notifications for workout and hydration reminders
- [ ] Barcode scanner for packaged food
- [ ] Multi-language support (Hindi, Tamil, Telugu)

---

## License

Copyright © 2026 PaceFuel. All rights reserved.

---

<div align="center">

**Built with React, Firebase, and Google Gemini.**<br/>
Designed for athletes who don't cut corners — and developers who don't either.

</div>
