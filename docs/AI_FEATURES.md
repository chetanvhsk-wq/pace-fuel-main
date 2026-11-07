# AI Features Documentation

PaceFuel uses Google Gemini for four distinct intelligent features. Here's how each one works under the hood.

---

## Setup

All AI calls go through `src/services/aiService.ts`. The service resolves your API key from:

1. `GEMINI_API_KEY` in `.env` (bundled at build time)
2. Runtime key pasted into the in-app **Online Setup** modal (stored in localStorage)

If neither is set, AI features degrade gracefully — basic tracking still works.

---

## Feature 1: AI Food Analysis

**Where:** AddFood page (📸 camera/upload button)

**Model:** `gemini-2.5-flash-preview`

**How it works:**
- User uploads or takes a photo of their meal
- Image is base64-encoded and sent to Gemini with a structured prompt
- Gemini returns a JSON object with: food name, estimated calories, protein, carbs, fats, and serving size
- Result is pre-filled into the food log form for user to confirm and save

**Specialization:** Optimized prompting for Indian cuisine — recognizes dishes like dal, roti, biryani, paneer, idli, etc. with reasonable macro estimates.

**Caching:** Results are cached in memory + localStorage (`pacefuel_ai_cache_v1`) for 15 minutes to avoid repeat API calls for the same image.

---

## Feature 2: AI Workout Plan Generator

**Where:** Training page (⚡ Generate Plan button)

**Model:** `gemini-3-flash-preview`

**How it works:**
- Reads user's profile: athlete type (endurance/strength/hybrid/general), available equipment, training frequency, goals, and BMI
- Sends a structured prompt requesting a JSON workout plan
- Returns a full weekly plan with exercises, sets, reps, rest times, and progression notes
- Rendered as an interactive plan in the Training page

**Output format:**
```json
{
  "planName": "...",
  "weeks": [...],
  "exercises": [
    { "name": "...", "sets": 4, "reps": "8-10", "muscleGroup": "...", "notes": "..." }
  ]
}
```

---

## Feature 3: AI Wellness Coach

**Where:** Wellness page (chat interface via WellnessCoach component)

**Model:** `gemini-3-flash-preview`

**How it works:**
- Persistent chat session — context is maintained across messages within the session
- System prompt establishes the coach as a science-based sports scientist named "Viorra"
- Aware of the user's current macros, hydration, and workout data via context injection
- Responds conversationally with actionable advice, not generic platitudes

**Limitations:**
- Session context resets on page refresh (not persisted to Firestore)
- Not a substitute for a real registered dietitian or sports physician

---

## Feature 4: AI Meditation Script Generator

**Where:** Wellness page (Mindfulness section)

**Model:** `gemini-2.5-flash-preview`

**How it works:**
- User selects current mood (calm, anxious, tired, motivated, etc.)
- Gemini generates a 5–10 minute guided meditation script tailored to that mood
- Script is displayed as a timed reading with breathing cue markers

---

## Feature 5: Performance Strategy Analyzer

**Where:** Strategy page

**Model:** `gemini-3-flash-preview`

**How it works:**
- Aggregates recent 7-day data: average calories vs goal, macro ratios, workout volume, sleep score
- Sends a structured analysis prompt with all this context
- Returns specific recommendations: macro adjustments, training intensity suggestions, recovery priorities

---

## Rate Limiting & Reliability

The AI service has built-in safeguards:

- **Timeout:** 8 seconds per request (`FAST_AI_TIMEOUT_MS`)
- **Retries:** 1 automatic retry on failure
- **In-flight deduplication:** Identical concurrent requests share one API call
- **Cache TTL:** 15 min for successful responses, 45 sec for fallback results
- **Cache limit:** 40 entries max (LRU eviction)

---

## Extending AI Features

To add a new AI feature:

1. Add a new function in `src/services/aiService.ts`
2. Use `generateFastContent()` for quick responses, raw `ai.models.generateContent()` for complex ones
3. Always handle the `null` case when `getAiClient()` returns null (no API key)
4. Return a sensible fallback so the UI doesn't break in offline mode
