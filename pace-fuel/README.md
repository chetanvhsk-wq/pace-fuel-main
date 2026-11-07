# Pace Fuel: The Elite AI Wellness Ecosystem

Pace Fuel is a high-performance wellness application designed for athletes and fitness enthusiasts. It integrates advanced AI to analyze nutrition, generate optimal training strategies, and provide real-time wellness coaching.

## 🚀 Key Features
- **AI Food Analysis**: Identify food and estimate macros from photos.
- **AI Workout Plans**: Personalized training strategies based on athlete type and goals.
- **AI Wellness Coach**: Science-based advice and encouragement.
- **Holistic Tracking**: Workouts, nutrition, hydration, supplements, and mindfulness.
- **Performance Analytics**: Weekly trends and personal bests.

## 📚 Documentation
For a detailed project overview, technical stack, and data architecture, see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).

## 🛠️ Getting Started
1.  Install dependencies: `npm install`
2.  Optional: create `.env` and set a real `GEMINI_API_KEY` if you want bundled online AI in web/APK builds. Firebase config already lives in `firebase-applet-config.json`.
3.  Run the development server: `npm run dev`
4.  Build for production: `npm run build`

## 📱 Mobile Build (APK)
1.  Install Android Studio and Java JDK 17.
2.  Run `npm run build`.
3.  Sync with Capacitor: `npx cap sync android`.
4.  Open the `android` folder in Android Studio and build the APK.

## 🌐 Online Features
- Firebase login in the Android APK works with `Email/Password` or `Anonymous` auth enabled in Firebase Console.
- Google popup sign-in is web-only in the current mobile build.
- Gemini chat, search, and strategy features need a real Gemini API key. You can either bundle it in `.env` before building or paste it into the app's `Online Setup` box at runtime.
- `APP_URL` is not required for the Android APK.

---
*Built with React, Firebase, and Google Gemini.*
