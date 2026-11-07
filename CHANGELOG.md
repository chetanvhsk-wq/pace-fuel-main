# Changelog

All notable changes to PaceFuel are documented here.

Format: [Semantic Versioning](https://semver.org/) — `Major.Minor.Patch`

---

## [1.0.0] — 2026-04-01

### Initial Release

**Core Features**
- Firebase Auth — Google popup (web), Email/Password, and Anonymous sign-in
- Firestore real-time sync for all logs and user profile
- Full onboarding flow with athlete type, goals, and daily targets

**Tracking**
- Food log with meal type categorization (breakfast, lunch, dinner, snack)
- Exercise log with muscle group targeting and volume tracking
- Water intake tracker with daily goal progress
- Supplement log with daily intake status
- Step counter — manual and automatic (AutoStepTracker)
- Weight log for trend tracking
- Wellness sessions — meditation, sleep, stress

**AI Features (Gemini)**
- Photo-based food analysis — identifies food items and estimates macros, optimized for Indian cuisine
- AI workout plan generator based on athlete type, equipment, and goals
- Real-time Wellness Coach with persistent chat session
- AI-generated meditation scripts based on current mood
- Performance strategy analyzer with macro/training recommendations

**Analytics**
- Dashboard with dynamic health score (0–100) based on calorie balance, hydration, steps, mindfulness
- Weekly trends chart — calories, weight, workout volume
- Personal bests tracking for strength and endurance milestones
- Muscle group volume and recovery visualization (MuscleMap)

**Mobile**
- Capacitor 8 integration for Android
- Native splash screen across all density buckets
- Firebase Auth compatible with APK (Email/Password + Anonymous)
- Prebuilt APK included (`pace-fuel.apk`)

**Tech**
- React 19 with lazy loading + prefetching on all routes
- Tailwind CSS 4 with hardware-specialist dark aesthetic
- Framer Motion animations
- Recharts for data visualization
- Full TypeScript strict-mode codebase
- Firestore security rules covering all collections

---

## Upcoming

- [ ] iOS Capacitor optimization
- [ ] Offline-first Firestore persistence
- [ ] Push notifications for workout reminders
- [ ] Apple Health / Google Fit integration
- [ ] Multi-language support
