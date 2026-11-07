import { GoogleGenAI, Type } from "@google/genai";
import { getConfiguredGeminiApiKey } from '../lib/runtimeConfig';
import type { MealType } from '../lib/mealTypes';

const FAST_AI_TIMEOUT_MS = 8000;
const FAST_AI_RETRY_ATTEMPTS = 1;
const AI_SUCCESS_CACHE_TTL_MS = 15 * 60 * 1000;
const AI_FALLBACK_CACHE_TTL_MS = 45 * 1000;
const AI_CACHE_STORAGE_KEY = 'pacefuel_ai_cache_v1';
const AI_CACHE_LIMIT = 40;

type AiCacheEntry<T = unknown> = {
  value: T;
  expiresAt: number;
  updatedAt: number;
};

const aiMemoryCache = new Map<string, AiCacheEntry>();
const aiInFlight = new Map<string, Promise<unknown>>();
let aiPersistentCacheLoaded = false;
let aiPersistentCache: Record<string, AiCacheEntry> = {};

function getAiClient() {
  const apiKey = getConfiguredGeminiApiKey();
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

function buildFastAiConfig(config: Record<string, any> = {}, options: { maxOutputTokens?: number; timeout?: number; temperature?: number } = {}) {
  const nextTimeout = options.timeout ?? FAST_AI_TIMEOUT_MS;

  return {
    temperature: options.temperature ?? 0.25,
    maxOutputTokens: options.maxOutputTokens ?? 320,
    ...config,
    thinkingConfig: {
      thinkingBudget: 0,
      ...(config.thinkingConfig || {}),
    },
    httpOptions: {
      timeout: nextTimeout,
      retryOptions: { attempts: FAST_AI_RETRY_ATTEMPTS },
      ...(config.httpOptions || {}),
    },
  };
}

function generateFastContent(ai: GoogleGenAI, params: Record<string, any>, options: { maxOutputTokens?: number; timeout?: number; temperature?: number } = {}) {
  return ai.models.generateContent({
    ...params,
    config: buildFastAiConfig(params.config, options),
  } as any);
}

function normalizeCachePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeCachePayload);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeCachePayload((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

function getAiCacheKey(scope: string, payload: unknown) {
  return `${scope}:${JSON.stringify(normalizeCachePayload(payload))}`;
}

function canUsePersistentAiCache() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadPersistentAiCache() {
  if (aiPersistentCacheLoaded || !canUsePersistentAiCache()) {
    return;
  }

  aiPersistentCacheLoaded = true;

  try {
    const rawCache = window.localStorage.getItem(AI_CACHE_STORAGE_KEY);
    aiPersistentCache = rawCache ? JSON.parse(rawCache) as Record<string, AiCacheEntry> : {};
  } catch {
    aiPersistentCache = {};
  }

  const now = Date.now();
  aiPersistentCache = Object.fromEntries(
    Object.entries(aiPersistentCache).filter(([, entry]) => entry.expiresAt > now),
  );
}

function persistAiCache() {
  if (!canUsePersistentAiCache()) {
    return;
  }

  loadPersistentAiCache();

  const prunedEntries = Object.entries(aiPersistentCache)
    .filter(([, entry]) => entry.expiresAt > Date.now())
    .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
    .slice(0, AI_CACHE_LIMIT);

  aiPersistentCache = Object.fromEntries(prunedEntries);

  try {
    window.localStorage.setItem(AI_CACHE_STORAGE_KEY, JSON.stringify(aiPersistentCache));
  } catch {
    // Ignore storage errors on constrained devices.
  }
}

function getCachedAiValue<T>(cacheKey: string): T | undefined {
  const inMemory = aiMemoryCache.get(cacheKey);
  if (inMemory && inMemory.expiresAt > Date.now()) {
    return inMemory.value as T;
  }

  if (inMemory) {
    aiMemoryCache.delete(cacheKey);
  }

  loadPersistentAiCache();
  const persisted = aiPersistentCache[cacheKey];
  if (persisted && persisted.expiresAt > Date.now()) {
    aiMemoryCache.set(cacheKey, persisted);
    return persisted.value as T;
  }

  if (persisted) {
    delete aiPersistentCache[cacheKey];
    persistAiCache();
  }

  return undefined;
}

function setCachedAiValue<T>(cacheKey: string, value: T, ttlMs: number) {
  const entry: AiCacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
    updatedAt: Date.now(),
  };

  aiMemoryCache.set(cacheKey, entry);
  loadPersistentAiCache();
  aiPersistentCache[cacheKey] = entry;
  persistAiCache();
}

async function withAiCache<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  options: {
    successTtlMs?: number;
    fallbackValue?: T;
    fallbackTtlMs?: number;
    cacheFallback?: boolean;
    shouldCacheSuccess?: (value: T) => boolean;
  } = {},
) {
  const cachedValue = getCachedAiValue<T>(cacheKey);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const inFlightRequest = aiInFlight.get(cacheKey) as Promise<T> | undefined;
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = loader()
    .then((value) => {
      const shouldCache = options.shouldCacheSuccess?.(value) ?? true;
      if (shouldCache) {
        setCachedAiValue(cacheKey, value, options.successTtlMs ?? AI_SUCCESS_CACHE_TTL_MS);
      }
      return value;
    })
    .catch((error) => {
      if (options.fallbackValue !== undefined) {
        if (options.cacheFallback) {
          setCachedAiValue(
            cacheKey,
            options.fallbackValue,
            options.fallbackTtlMs ?? AI_FALLBACK_CACHE_TTL_MS,
          );
        }
        return options.fallbackValue;
      }

      throw error;
    })
    .finally(() => {
      aiInFlight.delete(cacheKey);
    });

  aiInFlight.set(cacheKey, request as Promise<unknown>);
  return request;
}

type ProfileLike = {
  displayName?: string;
  gender?: string;
  age?: number | string;
  height?: number | string;
  weight?: number | string;
  athleteType?: string;
  goal?: string;
  activityLevel?: string;
  dietPreference?: string;
  equipment?: string[];
  dailyCalorieGoal?: number;
  dailyProteinGoal?: number;
  dailyCarbsGoal?: number;
  dailyFatsGoal?: number;
  dailyStepGoal?: number;
  trainingFrequency?: number;
  trainingFocus?: string[];
};

type CoachHistoryEntry = { role: "user" | "model"; parts: { text: string }[] };

type FoodRecommendationOptions = {
  mealType?: MealType;
  excludeNames?: string[];
};

export interface FoodAnalysis {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  description: string;
}

export interface ExercisePlan {
  title: string;
  exercises: {
    name: string;
    duration: string;
    intensity: string;
    description: string;
    targetMuscles: string[];
    sets?: number;
    reps?: number;
    weightSuggestion?: string;
  }[];
  summary: string;
}

export interface FoodRecommendation {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  description: string;
  dietType: string;
}

export interface OptimalNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  reasoning: string;
}

export interface OptimalTraining {
  frequency: number;
  focusAreas: string[];
  reasoning: string;
}

type LocalFoodEntry = FoodRecommendation & {
  tags: string[];
  compatibleDiets: string[];
  preferredGoals: string[];
};

type LocalExerciseEntry = {
  name: string;
  duration: string;
  intensity: string;
  description: string;
  targetMuscles: string[];
  requiredEquipment: string[];
  athleteTypes: string[];
};

const LOCAL_FOOD_LIBRARY: LocalFoodEntry[] = [
  {
    name: "Idli Sambar",
    calories: 280,
    protein: 10,
    carbs: 52,
    fats: 4,
    description: "Light South Indian meal with steady carbs that works well before training.",
    dietType: "Vegan",
    tags: ["idli", "sambar", "south indian", "breakfast", "pre workout", "rice"],
    compatibleDiets: ["vegan", "vegetarian", "eggetarian", "non-vegetarian", "south-indian"],
    preferredGoals: ["performance", "maintenance", "weight-loss"],
  },
  {
    name: "Masala Dosa",
    calories: 420,
    protein: 9,
    carbs: 58,
    fats: 15,
    description: "Higher-carb South Indian classic that suits longer training days.",
    dietType: "Vegan",
    tags: ["dosa", "south indian", "potato", "rice", "breakfast"],
    compatibleDiets: ["vegan", "vegetarian", "eggetarian", "non-vegetarian", "south-indian"],
    preferredGoals: ["performance", "maintenance"],
  },
  {
    name: "Poha with Peanuts",
    calories: 310,
    protein: 9,
    carbs: 48,
    fats: 9,
    description: "Easy-to-digest carb source with a little fat for a balanced breakfast.",
    dietType: "Vegan",
    tags: ["poha", "breakfast", "light", "pre workout", "north indian"],
    compatibleDiets: ["vegan", "vegetarian", "eggetarian", "non-vegetarian", "north-indian"],
    preferredGoals: ["performance", "maintenance", "weight-loss"],
  },
  {
    name: "Paneer Bhurji with Roti",
    calories: 410,
    protein: 24,
    carbs: 28,
    fats: 20,
    description: "High-protein vegetarian meal that supports recovery and strength work.",
    dietType: "Veg",
    tags: ["paneer", "roti", "north indian", "protein", "recovery"],
    compatibleDiets: ["vegetarian", "eggetarian", "non-vegetarian", "north-indian"],
    preferredGoals: ["muscle-gain", "performance", "maintenance"],
  },
  {
    name: "Dal Tadka with Rice",
    calories: 390,
    protein: 16,
    carbs: 58,
    fats: 9,
    description: "Balanced Indian staple with useful carbs and plant protein.",
    dietType: "Veg",
    tags: ["dal", "rice", "north indian", "lentils", "lunch"],
    compatibleDiets: ["vegetarian", "eggetarian", "non-vegetarian", "north-indian"],
    preferredGoals: ["maintenance", "performance", "weight-loss"],
  },
  {
    name: "Rajma Chawal",
    calories: 430,
    protein: 17,
    carbs: 67,
    fats: 8,
    description: "Carb-focused recovery meal with fiber and plant protein.",
    dietType: "Veg",
    tags: ["rajma", "rice", "north indian", "beans", "recovery"],
    compatibleDiets: ["vegetarian", "eggetarian", "non-vegetarian", "north-indian"],
    preferredGoals: ["performance", "maintenance"],
  },
  {
    name: "Chana Salad",
    calories: 260,
    protein: 14,
    carbs: 32,
    fats: 8,
    description: "High-fiber plant-protein option that works well during fat-loss phases.",
    dietType: "Vegan",
    tags: ["chana", "salad", "vegan", "high fiber", "snack"],
    compatibleDiets: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    preferredGoals: ["weight-loss", "maintenance"],
  },
  {
    name: "Tofu Stir Fry",
    calories: 350,
    protein: 24,
    carbs: 20,
    fats: 18,
    description: "Protein-rich vegan option with lower carbs and solid satiety.",
    dietType: "Vegan",
    tags: ["tofu", "vegan", "protein", "dinner", "stir fry"],
    compatibleDiets: ["vegan", "vegetarian", "eggetarian", "non-vegetarian"],
    preferredGoals: ["muscle-gain", "weight-loss", "maintenance"],
  },
  {
    name: "Egg Bhurji Wrap",
    calories: 330,
    protein: 22,
    carbs: 26,
    fats: 14,
    description: "Portable protein-heavy meal that works well after training.",
    dietType: "Eggetarian",
    tags: ["egg", "wrap", "protein", "post workout", "breakfast"],
    compatibleDiets: ["eggetarian", "non-vegetarian"],
    preferredGoals: ["muscle-gain", "performance", "maintenance"],
  },
  {
    name: "Greek Yogurt Fruit Bowl",
    calories: 240,
    protein: 18,
    carbs: 28,
    fats: 5,
    description: "Fast, high-protein snack with enough carbs for recovery.",
    dietType: "Veg",
    tags: ["yogurt", "fruit", "snack", "protein", "recovery"],
    compatibleDiets: ["vegetarian", "eggetarian", "non-vegetarian"],
    preferredGoals: ["muscle-gain", "maintenance", "weight-loss"],
  },
  {
    name: "Protein Shake",
    calories: 180,
    protein: 30,
    carbs: 6,
    fats: 3,
    description: "Convenient protein top-up for recovery or hitting daily targets.",
    dietType: "Veg",
    tags: ["shake", "protein", "post workout", "whey", "quick"],
    compatibleDiets: ["vegetarian", "eggetarian", "non-vegetarian"],
    preferredGoals: ["muscle-gain", "performance", "weight-loss", "maintenance"],
  },
  {
    name: "Chicken Rice Bowl",
    calories: 460,
    protein: 38,
    carbs: 42,
    fats: 11,
    description: "Lean protein plus moderate carbs for performance and muscle recovery.",
    dietType: "Non-Veg",
    tags: ["chicken", "rice", "protein", "recovery", "lunch"],
    compatibleDiets: ["non-vegetarian"],
    preferredGoals: ["muscle-gain", "performance", "maintenance", "weight-loss"],
  },
  {
    name: "Chicken Biryani",
    calories: 520,
    protein: 28,
    carbs: 58,
    fats: 18,
    description: "Dense carb-and-protein meal best suited for heavy training days.",
    dietType: "Non-Veg",
    tags: ["biryani", "chicken", "rice", "north indian", "performance"],
    compatibleDiets: ["non-vegetarian", "north-indian"],
    preferredGoals: ["performance", "muscle-gain"],
  },
  {
    name: "Fish Curry with Rice",
    calories: 430,
    protein: 32,
    carbs: 40,
    fats: 12,
    description: "Lean protein meal with moderate carbs and useful omega-3 fats.",
    dietType: "Non-Veg",
    tags: ["fish", "curry", "rice", "south indian", "omega 3"],
    compatibleDiets: ["non-vegetarian", "south-indian"],
    preferredGoals: ["performance", "maintenance", "weight-loss"],
  },
  {
    name: "Peanut Butter Banana Toast",
    calories: 290,
    protein: 11,
    carbs: 30,
    fats: 14,
    description: "Simple pre-training snack with quick carbs and a bit of fat.",
    dietType: "Veg",
    tags: ["toast", "banana", "pre workout", "quick", "snack"],
    compatibleDiets: ["vegetarian", "eggetarian", "non-vegetarian"],
    preferredGoals: ["performance", "maintenance"],
  },
];

const LOCAL_EXERCISE_LIBRARY: LocalExerciseEntry[] = [
  {
    name: "Push Ups",
    duration: "12 min",
    intensity: "Moderate",
    description: "Bodyweight pressing movement for chest, shoulders, and triceps.",
    targetMuscles: ["chest", "triceps", "shoulders", "arms"],
    requiredEquipment: ["none"],
    athleteTypes: ["general", "hybrid", "strength"],
  },
  {
    name: "Bodyweight Squats",
    duration: "12 min",
    intensity: "Moderate",
    description: "Accessible lower-body movement for quads and glutes.",
    targetMuscles: ["quads", "glutes", "hamstrings"],
    requiredEquipment: ["none"],
    athleteTypes: ["general", "hybrid", "endurance"],
  },
  {
    name: "Walking Lunges",
    duration: "10 min",
    intensity: "Moderate",
    description: "Single-leg movement that builds control and lower-body endurance.",
    targetMuscles: ["quads", "glutes", "hamstrings", "calves"],
    requiredEquipment: ["none"],
    athleteTypes: ["general", "hybrid", "endurance"],
  },
  {
    name: "Plank Hold",
    duration: "8 min",
    intensity: "Low",
    description: "Core stability drill that supports posture and force transfer.",
    targetMuscles: ["abs", "core"],
    requiredEquipment: ["none"],
    athleteTypes: ["general", "hybrid", "endurance", "strength"],
  },
  {
    name: "Mountain Climbers",
    duration: "10 min",
    intensity: "High",
    description: "Conditioning-focused core movement that raises heart rate quickly.",
    targetMuscles: ["abs", "shoulders", "quads"],
    requiredEquipment: ["none"],
    athleteTypes: ["general", "hybrid", "endurance"],
  },
  {
    name: "Dumbbell Bench Press",
    duration: "14 min",
    intensity: "Moderate",
    description: "Pressing exercise for upper-body strength and hypertrophy.",
    targetMuscles: ["chest", "triceps", "shoulders"],
    requiredEquipment: ["dumbbells", "bench"],
    athleteTypes: ["strength", "hybrid"],
  },
  {
    name: "Goblet Squat",
    duration: "14 min",
    intensity: "Moderate",
    description: "Front-loaded squat variation that trains legs and trunk stiffness.",
    targetMuscles: ["quads", "glutes", "abs"],
    requiredEquipment: ["dumbbells"],
    athleteTypes: ["strength", "hybrid", "general"],
  },
  {
    name: "Romanian Deadlift",
    duration: "14 min",
    intensity: "Moderate",
    description: "Posterior-chain hinge for hamstrings, glutes, and lower back strength.",
    targetMuscles: ["hamstrings", "glutes", "lower-back", "back"],
    requiredEquipment: ["dumbbells", "barbell"],
    athleteTypes: ["strength", "hybrid"],
  },
  {
    name: "Overhead Press",
    duration: "12 min",
    intensity: "Moderate",
    description: "Shoulder-focused press that also builds upper-body stability.",
    targetMuscles: ["shoulders", "triceps", "arms"],
    requiredEquipment: ["dumbbells", "barbell"],
    athleteTypes: ["strength", "hybrid"],
  },
  {
    name: "Bent Over Row",
    duration: "12 min",
    intensity: "Moderate",
    description: "Pulling movement for back thickness and posture support.",
    targetMuscles: ["back", "upper-back", "biceps", "arms", "traps"],
    requiredEquipment: ["dumbbells", "barbell"],
    athleteTypes: ["strength", "hybrid"],
  },
  {
    name: "Bench Press",
    duration: "14 min",
    intensity: "High",
    description: "Classic compound lift for pressing strength and chest development.",
    targetMuscles: ["chest", "triceps", "shoulders"],
    requiredEquipment: ["barbell", "bench"],
    athleteTypes: ["strength"],
  },
  {
    name: "Pull Ups",
    duration: "10 min",
    intensity: "High",
    description: "Strong vertical pulling movement for lats, arms, and grip.",
    targetMuscles: ["back", "upper-back", "biceps", "arms"],
    requiredEquipment: ["pullup-bar"],
    athleteTypes: ["strength", "hybrid"],
  },
  {
    name: "Resistance Band Row",
    duration: "12 min",
    intensity: "Low",
    description: "Joint-friendly pulling work for back activation and posture.",
    targetMuscles: ["back", "upper-back", "biceps", "arms"],
    requiredEquipment: ["resistance-bands"],
    athleteTypes: ["general", "hybrid", "endurance"],
  },
  {
    name: "Band Face Pull",
    duration: "8 min",
    intensity: "Low",
    description: "Great accessory move for shoulders, traps, and upper-back health.",
    targetMuscles: ["shoulders", "traps", "upper-back"],
    requiredEquipment: ["resistance-bands"],
    athleteTypes: ["general", "hybrid", "strength"],
  },
];

function hasAiAccess() {
  return Boolean(getConfiguredGeminiApiKey());
}

function requireAiClient() {
  const ai = getAiClient();
  if (!ai) {
    throw new Error("A valid GEMINI_API_KEY is missing. The app is running in local fallback mode.");
  }
  return ai;
}

function parseNumber(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function safeParseJson<T>(value: string | undefined | null): T | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function getBMIData(profile: ProfileLike) {
  const height = parseNumber(profile.height, 170);
  const weight = parseNumber(profile.weight, 70);
  const bmiValue = height > 0 ? weight / Math.pow(height / 100, 2) : null;
  return {
    bmi: bmiValue ? bmiValue.toFixed(1) : "N/A",
    bmiCategory: bmiValue ? getBMICategory(bmiValue) : "N/A",
    height,
    weight,
  };
}

function getGoalLabel(goal?: string) {
  switch (goal) {
    case "muscle-gain":
      return "muscle gain";
    case "weight-loss":
      return "fat loss";
    case "performance":
      return "performance";
    default:
      return "maintenance";
  }
}

function getMealTypeLabel(mealType?: MealType) {
  switch (mealType) {
    case 'breakfast':
      return 'breakfast';
    case 'lunch':
      return 'lunch';
    case 'dinner':
      return 'dinner';
    case 'snack':
      return 'snacks';
    default:
      return 'meals';
  }
}

function getMealTypeTags(mealType?: MealType) {
  switch (mealType) {
    case 'breakfast':
      return ['breakfast', 'pre workout', 'light', 'quick'];
    case 'lunch':
      return ['lunch', 'rice', 'recovery', 'balanced'];
    case 'dinner':
      return ['dinner', 'recovery', 'protein', 'stir fry'];
    case 'snack':
      return ['snack', 'quick', 'post workout', 'protein'];
    default:
      return [];
  }
}

function getProfileName(profile: ProfileLike) {
  const rawName = profile.displayName?.trim();
  if (!rawName) {
    return 'athlete';
  }

  return rawName.split(/\s+/)[0] || 'athlete';
}

function sanitizeResponseText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function getRecentCoachReplies(history: CoachHistoryEntry[]) {
  return history
    .filter((entry) => entry.role === 'model')
    .slice(-3)
    .map((entry) => sanitizeResponseText(entry.parts.map((part) => part.text).join(' ')))
    .filter(Boolean);
}

function dedupeFoodRecommendations(
  recommendations: FoodRecommendation[],
  excludeNames: string[] = [],
) {
  const excluded = new Set(excludeNames.map(normalizeText));
  const seen = new Set<string>();

  return recommendations.filter((recommendation) => {
    const normalizedName = normalizeText(recommendation.name);

    if (seen.has(normalizedName) || excluded.has(normalizedName)) {
      return false;
    }

    seen.add(normalizedName);
    return true;
  });
}

function isFoodCompatibleWithDiet(food: LocalFoodEntry, dietPreference?: string) {
  if (!dietPreference) {
    return true;
  }
  if (dietPreference === "non-vegetarian") {
    return true;
  }
  return food.compatibleDiets.includes(dietPreference);
}

function getLocalFoodSearchResults(query: string): FoodAnalysis[] {
  const normalizedQuery = normalizeText(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  const scored = LOCAL_FOOD_LIBRARY.map((food) => {
    const haystack = [food.name, food.description, food.tags.join(" ")].map(normalizeText).join(" ");
    let score = 0;

    if (normalizeText(food.name).includes(normalizedQuery)) {
      score += 6;
    }

    for (const token of tokens) {
      if (normalizeText(food.name).includes(token)) {
        score += 3;
      } else if (haystack.includes(token)) {
        score += 1;
      }
    }

    return { food, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.food.protein - a.food.protein)
    .slice(0, 5)
    .map((entry) => entry.food);

  return scored.map(({ tags: _tags, compatibleDiets: _compatibleDiets, preferredGoals: _preferredGoals, ...food }) => food);
}

function getLocalFoodRecommendations(
  profile: ProfileLike,
  options: FoodRecommendationOptions = {},
): FoodRecommendation[] {
  const goal = profile.goal || "maintenance";
  const mealTypeTags = getMealTypeTags(options.mealType);
  const excluded = new Set((options.excludeNames || []).map(normalizeText));

  const ranked = LOCAL_FOOD_LIBRARY
    .filter((food) => isFoodCompatibleWithDiet(food, profile.dietPreference))
    .map((food) => {
      const goalMatch = food.preferredGoals.includes(goal) ? 4 : 0;
      const mealMatch = mealTypeTags.reduce((score, tag) => score + (food.tags.includes(tag) ? 2 : 0), 0);
      const proteinBonus = food.protein / 10;
      return { food, score: goalMatch + mealMatch + proteinBonus };
    })
    .sort((a, b) => b.score - a.score || b.food.protein - a.food.protein);

  const preferred = ranked
    .filter(({ food }) => !excluded.has(normalizeText(food.name)))
    .map(({ food }) => food);

  const backup = ranked.map(({ food }) => food);
  const combined = [...preferred, ...backup];
  const seen = new Set<string>();

  return combined
    .filter((food) => {
      const normalizedName = normalizeText(food.name);
      if (seen.has(normalizedName)) {
        return false;
      }
      seen.add(normalizedName);
      return true;
    })
    .slice(0, 5)
    .map(({ tags: _tags, compatibleDiets: _compatibleDiets, preferredGoals: _preferredGoals, ...food }) => food);
}

function getLocalMeditationScript(mood: string, duration: number) {
  const normalizedMood = normalizeText(mood);
  if (normalizedMood.includes("stress") || normalizedMood.includes("anx")) {
    return `For the next ${duration} minutes, slow your breath to a steady four-count inhale and six-count exhale. On every exhale, relax your jaw, shoulders, and chest, and let each breath feel slightly longer and calmer than the last.`;
  }
  if (normalizedMood.includes("tired") || normalizedMood.includes("low")) {
    return `Use this ${duration}-minute session to reset without forcing energy. Sit tall, breathe deeply into your ribs, and with every inhale think "steady," with every exhale think "recover."`;
  }
  if (normalizedMood.includes("focus") || normalizedMood.includes("work")) {
    return `For ${duration} minutes, keep your eyes soft and your attention on one point in your breath. When your mind drifts, gently bring it back to the word "focus" and continue with smooth, quiet breathing.`;
  }
  return `For the next ${duration} minutes, inhale slowly through your nose and exhale with control. Let your breathing become the only task, and use each breath to bring your body back into a calm, steady rhythm.`;
}

function getLocalNutritionStrategy(profile: ProfileLike): OptimalNutrition {
  const age = parseNumber(profile.age, 25);
  const height = parseNumber(profile.height, 170);
  const weight = parseNumber(profile.weight, 70);
  const athleteType = profile.athleteType || "general";
  const goal = profile.goal || "maintenance";
  const activityLevel = profile.activityLevel || "moderate";

  const baseBmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    moderate: 1.45,
    active: 1.65,
    pro: 1.85,
  };

  let calories = baseBmr * (activityMultipliers[activityLevel] || 1.45);

  let proteinMultiplier = 1.7;
  let carbsMultiplier = 3.5;

  if (athleteType === "endurance") {
    proteinMultiplier = 1.6;
    carbsMultiplier = 5.0;
  } else if (athleteType === "strength") {
    proteinMultiplier = 2.0;
    carbsMultiplier = 3.2;
  } else if (athleteType === "hybrid") {
    proteinMultiplier = 1.9;
    carbsMultiplier = 4.0;
  }

  if (goal === "muscle-gain") {
    calories += 350;
    proteinMultiplier += 0.1;
    carbsMultiplier += 0.4;
  } else if (goal === "weight-loss") {
    calories -= 400;
    proteinMultiplier += 0.2;
    carbsMultiplier -= 0.8;
  } else if (goal === "performance") {
    calories += 200;
    carbsMultiplier += 0.5;
  }

  const protein = Math.round(weight * proteinMultiplier);
  const carbs = Math.max(120, Math.round(weight * carbsMultiplier));
  const fats = Math.max(45, Math.round((calories - ((protein * 4) + (carbs * 4))) / 9));
  const finalCalories = Math.round((protein * 4) + (carbs * 4) + (fats * 9));

  return {
    calories: finalCalories,
    protein,
    carbs,
    fats,
    reasoning: `Built from your ${activityLevel} activity level, ${athleteType} training profile, and ${getGoalLabel(goal)} target so protein stays high and carbs match your output.`,
  };
}

function getLocalTrainingStrategy(profile: ProfileLike): OptimalTraining {
  const athleteType = profile.athleteType || "general";
  const goal = profile.goal || "maintenance";
  const activityLevel = profile.activityLevel || "moderate";
  const hasEquipment = (profile.equipment || []).some((item) => item !== "none");

  const frequencyMap: Record<string, number> = {
    sedentary: 3,
    moderate: 4,
    active: 5,
    pro: 6,
  };

  let frequency = frequencyMap[activityLevel] || 4;
  if (goal === "muscle-gain") frequency += 1;
  frequency = clamp(frequency, 3, 6);

  let focusAreas: string[];
  if (athleteType === "strength") {
    focusAreas = ["compound lifts", "upper body strength", "lower body strength", "recovery"];
  } else if (athleteType === "endurance") {
    focusAreas = ["aerobic base", "threshold work", "lower body durability", "mobility"];
  } else if (athleteType === "hybrid") {
    focusAreas = ["full body strength", "conditioning", "core stability", "mobility"];
  } else {
    focusAreas = ["full body training", "cardio base", "core work", "mobility"];
  }

  if (goal === "weight-loss") {
    focusAreas = ["full body training", "daily movement", "conditioning", "recovery"];
  }
  if (!hasEquipment) {
    focusAreas = focusAreas.map((area) => area === "compound lifts" ? "bodyweight strength" : area);
  }

  return {
    frequency,
    focusAreas,
    reasoning: `Recommended ${frequency} training days each week because your current ${activityLevel} workload and ${getGoalLabel(goal)} target respond best to steady volume, focused recovery, and repeatable sessions.`,
  };
}

function canUseExercise(exercise: LocalExerciseEntry, availableEquipment: string[]) {
  if (exercise.requiredEquipment.includes("none")) {
    return true;
  }
  return exercise.requiredEquipment.some((item) => availableEquipment.includes(item));
}

function getExerciseWeightSuggestion(profile: ProfileLike, exercise: LocalExerciseEntry) {
  if (exercise.requiredEquipment.includes("none")) {
    return "0 kg";
  }
  if (profile.goal === "muscle-gain") {
    return "20 kg";
  }
  if (profile.goal === "weight-loss") {
    return "8 kg";
  }
  return "12 kg";
}

function getExerciseSetsAndReps(profile: ProfileLike) {
  if (profile.goal === "muscle-gain") {
    return { sets: 4, reps: 8 };
  }
  if (profile.goal === "weight-loss") {
    return { sets: 3, reps: 15 };
  }
  if (profile.athleteType === "endurance") {
    return { sets: 3, reps: 12 };
  }
  return { sets: 3, reps: 10 };
}

function getLocalExercisePlan(profile: ProfileLike, targetMuscle?: string): ExercisePlan {
  const availableEquipment = profile.equipment && profile.equipment.length > 0 ? profile.equipment : ["none"];
  const athleteType = profile.athleteType || "general";
  const normalizedTarget = targetMuscle ? normalizeText(targetMuscle) : "";

  const matching = LOCAL_EXERCISE_LIBRARY.filter((exercise) => {
    if (!canUseExercise(exercise, availableEquipment)) {
      return false;
    }
    if (!exercise.athleteTypes.includes(athleteType) && athleteType !== "general") {
      return normalizedTarget ? exercise.targetMuscles.some((muscle) => muscle.includes(normalizedTarget)) : false;
    }
    if (!normalizedTarget) {
      return true;
    }
    return exercise.targetMuscles.some((muscle) => normalizeText(muscle).includes(normalizedTarget));
  });

  const fallbackPool = LOCAL_EXERCISE_LIBRARY.filter((exercise) => canUseExercise(exercise, availableEquipment));
  const selected = [...matching];

  for (const exercise of fallbackPool) {
    if (selected.length >= 5) {
      break;
    }
    if (!selected.some((item) => item.name === exercise.name)) {
      selected.push(exercise);
    }
  }

  const { sets, reps } = getExerciseSetsAndReps(profile);
  const exercises = selected.slice(0, 5).map((exercise) => ({
    name: exercise.name,
    duration: exercise.duration,
    intensity: exercise.intensity,
    description: exercise.description,
    targetMuscles: exercise.targetMuscles,
    sets,
    reps,
    weightSuggestion: getExerciseWeightSuggestion(profile, exercise),
  }));

  return {
    title: normalizedTarget ? `${targetMuscle} Focus Session` : "Balanced Training Session",
    exercises,
    summary: `This plan uses the equipment you have available and keeps the work aligned with your ${athleteType} profile and ${getGoalLabel(profile.goal)} target.`,
  };
}

function getLocalWellnessInsight(profile: ProfileLike, logs: any[], exercises: any[], steps: number) {
  const stepGoal = profile.dailyStepGoal || 10000;
  const proteinGoal = profile.dailyProteinGoal || 140;
  const totalProtein = logs.reduce((sum, log) => sum + (Number(log.protein) || 0), 0);
  const workoutCount = exercises.length;

  if (steps < stepGoal * 0.6) {
    return `You are still below today's movement target, so a short walk later would raise your recovery score without adding much fatigue. Keep protein moving toward ${proteinGoal}g so the rest of the day supports your ${getGoalLabel(profile.goal)} goal.`;
  }
  if (totalProtein < proteinGoal * 0.7) {
    return `Your movement is on track, but protein intake looks light for your goal. Add one more protein-focused meal or shake so recovery keeps up with today's workload.`;
  }
  if (workoutCount === 0) {
    return `Nutrition and movement are building well today. If energy allows, a short training session or mobility block would round out the day nicely.`;
  }
  return `Today's habits are lining up well with your goal. Stay consistent with hydration, finish the day strong on protein, and use a calm recovery routine tonight.`;
}

function getLocalCoachReply(message: string, profile: ProfileLike, currentSteps = 0) {
  const normalized = normalizeText(message);
  const nutrition = getLocalNutritionStrategy(profile);
  const training = getLocalTrainingStrategy(profile);
  const foodSuggestion = getLocalFoodRecommendations(profile)[0];
  const stepGoal = profile.dailyStepGoal || 10000;
  const name = getProfileName(profile);

  if (/protein|calorie|macro|food|eat|meal|diet/.test(normalized)) {
    return `${name}, aim for about ${nutrition.calories} kcal with ${nutrition.protein}g protein today. A smart next meal would be ${foodSuggestion?.name || "a balanced protein-and-carb plate"} to keep recovery aligned with your ${getGoalLabel(profile.goal)} goal.`;
  }
  if (/step|walk|cardio|move/.test(normalized)) {
    return `You are at ${currentSteps.toLocaleString()} steps right now, ${name}, with a target of ${stepGoal.toLocaleString()}. If you are short, split the rest into two easy walks so you raise activity without hurting recovery.`;
  }
  if (/sleep|stress|recover|recovery|tired|fatigue/.test(normalized)) {
    return `Treat recovery like training today: hydrate well, keep your final meal protein-focused, and aim for a calm wind-down before bed. That will help you absorb the work from your current ${training.frequency}-day schedule.`;
  }
  if (/workout|training|lift|gym|exercise/.test(normalized)) {
    return `A good structure for you is ${training.frequency} training days per week with focus on ${training.focusAreas.slice(0, 3).join(", ")}. Keep the sessions repeatable and leave enough energy for strong recovery between them.`;
  }

  return `${name}, for your ${profile.athleteType || "general"} profile and ${getGoalLabel(profile.goal)} goal, keep the basics steady: hit protein, stay near your calorie target, and move toward ${stepGoal.toLocaleString()} steps. Ask about meals, workouts, or recovery and I will narrow it down.`;
}

function getLocalProgressAnalysis(profile: ProfileLike, healthData: any[]) {
  if (healthData.length < 2) {
    return `You need a little more logged data before trend analysis gets sharp, so focus on consistent weight and step logging this week. In the meantime, keep nutrition steady around your current ${getGoalLabel(profile.goal)} goal.`;
  }

  const firstWeight = Number(healthData[0]?.weight) || 0;
  const lastWeight = Number(healthData[healthData.length - 1]?.weight) || 0;
  const delta = Number((lastWeight - firstWeight).toFixed(1));

  if (profile.goal === "weight-loss") {
    if (delta < 0) {
      return `Your weight trend is moving in the right direction for fat loss. Keep protein high and avoid making your calorie deficit more aggressive unless progress stalls for another week.`;
    }
    return `Your scale trend looks flat for fat loss, so tighten calorie consistency and increase daily movement slightly before making major diet changes.`;
  }

  if (profile.goal === "muscle-gain") {
    if (delta > 0) {
      return `Your bodyweight is trending upward, which supports a muscle-gain phase. Keep training performance high and hold that surplus steady instead of chasing faster scale changes.`;
    }
    return `Your weight trend is fairly flat for a muscle-gain goal. A small calorie increase and one more protein-forward meal could help you move the scale without overshooting.`;
  }

  return `Your recent trend looks stable, which is useful for maintenance and performance work. Keep logging consistently so you can adjust only when the data shows a real shift.`;
}

function mergeFoodSearchResults(primary: FoodAnalysis[], fallback: FoodAnalysis[]) {
  const mergedResults: FoodAnalysis[] = [];
  const seenNames = new Set<string>();

  [...primary, ...fallback].forEach((item) => {
    const normalizedName = normalizeText(item.name);
    if (seenNames.has(normalizedName)) {
      return;
    }

    seenNames.add(normalizedName);
    mergedResults.push(item);
  });

  return mergedResults.slice(0, 5);
}

export async function analyzeFoodImage(base64Image: string): Promise<FoodAnalysis | null> {
  if (!hasAiAccess()) {
    return null;
  }

  try {
    const ai = requireAiClient();
    const response = await generateFastContent(ai, {
      model: "gemini-2.5-flash-preview",
      contents: [
        {
          parts: [
            { text: "Identify the food in this image, especially Indian food. Provide estimated nutritional information (calories, protein, carbs, fats) for a standard serving. Return the data in JSON format." },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fats: { type: Type.NUMBER },
            description: { type: Type.STRING }
          },
          required: ["name", "calories", "protein", "carbs", "fats"]
        }
      }
    }, { maxOutputTokens: 220, timeout: 12000 });

    return safeParseJson<FoodAnalysis>(response.text) || null;
  } catch (error) {
    console.error("Error analyzing food image:", error);
    return null;
  }
}

export async function searchFood(query: string): Promise<FoodAnalysis[]> {
  const localResults = getLocalFoodSearchResults(query);

  if (!hasAiAccess()) {
    return localResults;
  }

  const cacheKey = getAiCacheKey('food-search', { query: query.trim().toLowerCase() });

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: `Search for nutritional information for: ${query}. Focus on Indian food if applicable. Return a list of up to 5 matching items with their macros (calories, protein, carbs, fats).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fats: { type: Type.NUMBER },
                description: { type: Type.STRING }
              },
              required: ["name", "calories", "protein", "carbs", "fats"]
            }
          }
        }
      }, { maxOutputTokens: 420 });

      const parsed = safeParseJson<FoodAnalysis[]>(response.text);
      if (!parsed?.length) {
        throw new Error('Food search returned no usable AI results.');
      }

      return mergeFoodSearchResults(parsed, localResults);
    },
    {
      fallbackValue: localResults,
      cacheFallback: localResults.length > 0,
      successTtlMs: 20 * 60 * 1000,
    },
  );
}

export async function generateExercisePlan(profile: ProfileLike, targetMuscle?: string): Promise<ExercisePlan | null> {
  const localPlan = getLocalExercisePlan(profile, targetMuscle);

  if (!hasAiAccess()) {
    return localPlan;
  }

  const cacheKey = getAiCacheKey('exercise-plan', {
    profile,
    targetMuscle: targetMuscle || 'full-body',
  });

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const { bmi, bmiCategory } = getBMIData(profile);

      const prompt = `Generate a personalized exercise plan for a user with the following profile:
      Age: ${profile.age}
      Height: ${profile.height}cm
      Weight: ${profile.weight}kg
      BMI: ${bmi} (${bmiCategory})
      Athlete Type: ${profile.athleteType}
      Goal: ${profile.goal}
      Activity Level: ${profile.activityLevel}
      Available Equipment: ${profile.equipment?.join(", ") || "None"}
      Target Muscle Group: ${targetMuscle || "Full Body"}
      
      The plan should include 4-6 specific exercises with duration, intensity, a brief description, and a list of target muscles.
      Also suggest optimal Sets, Reps, and Weight (if applicable) for each exercise based on their goal and athlete type.
      CRITICAL: Only suggest exercises that can be performed with the "Available Equipment".
      Focus on their specific goal, athlete type, and target muscle group. Return the data in JSON format.`;

      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    intensity: { type: Type.STRING },
                    description: { type: Type.STRING },
                    targetMuscles: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    sets: { type: Type.NUMBER },
                    reps: { type: Type.NUMBER },
                    weightSuggestion: { type: Type.STRING }
                  },
                  required: ["name", "duration", "intensity", "description", "targetMuscles", "sets", "reps", "weightSuggestion"]
                }
              },
              summary: { type: Type.STRING }
            },
            required: ["title", "exercises", "summary"]
          }
        }
      }, { maxOutputTokens: 560, timeout: 9000 });

      const parsed = safeParseJson<ExercisePlan>(response.text);
      if (!parsed?.exercises?.length) {
        throw new Error('Exercise plan returned no usable AI output.');
      }

      return parsed;
    },
    {
      fallbackValue: localPlan,
      cacheFallback: Boolean(localPlan),
      successTtlMs: 20 * 60 * 1000,
    },
  );
}

export async function generateFoodRecommendations(
  profile: ProfileLike,
  options: FoodRecommendationOptions = {},
): Promise<FoodRecommendation[]> {
  const localRecommendations = getLocalFoodRecommendations(profile, options);

  if (!hasAiAccess()) {
    return localRecommendations;
  }

  const cacheKey = getAiCacheKey('food-recommendations', { profile, options });

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const { bmi, bmiCategory } = getBMIData(profile);
      const mealTypeLabel = getMealTypeLabel(options.mealType);
      const excludedNames = options.excludeNames?.filter(Boolean) || [];

      const prompt = `Generate 3-5 healthy ${mealTypeLabel} suggestions for a user with the following profile:
      Age: ${profile.age}
      Height: ${profile.height}cm
      Weight: ${profile.weight}kg
      BMI: ${bmi} (${bmiCategory})
      Athlete Type: ${profile.athleteType}
      Diet Preference: ${profile.dietPreference} (Crucial: Must strictly follow this preference - Veg, Non-Veg, Vegan, etc.)
      Goal: ${profile.goal}
      Activity Level: ${profile.activityLevel}
      Target Meal: ${mealTypeLabel}
      Avoid repeating or closely paraphrasing any of these previous suggestion names: ${excludedNames.length ? excludedNames.join(', ') : 'none'}.
      
      Keep each recommendation practical, natural, and short. Each description must be a single concise sentence.
      Include realistic calorie estimates and useful macro values.
      Provide recommendations that are culturally relevant (focus on Indian food if applicable) and help them reach their goal while considering their BMI status. Return the data in JSON format.`;

      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fats: { type: Type.NUMBER },
                description: { type: Type.STRING },
                dietType: { type: Type.STRING }
              },
              required: ["name", "calories", "protein", "carbs", "fats", "description", "dietType"]
            }
          }
        }
      }, { maxOutputTokens: 420, temperature: 0.72 });

      const parsed = safeParseJson<FoodRecommendation[]>(response.text);
      const cleaned = dedupeFoodRecommendations(parsed || [], excludedNames).map((item) => ({
        ...item,
        description: sanitizeResponseText(item.description),
      }));

      if (!cleaned.length) {
        throw new Error('Food recommendations returned no usable AI output.');
      }

      return cleaned;
    },
    {
      fallbackValue: localRecommendations,
      cacheFallback: localRecommendations.length > 0,
      successTtlMs: 30 * 60 * 1000,
    },
  );
}

export async function getWellnessInsights(profile: ProfileLike, logs: any[], exercises: any[], steps: number): Promise<string> {
  const localInsight = getLocalWellnessInsight(profile, logs, exercises, steps);

  if (!hasAiAccess()) {
    return localInsight;
  }

  const cacheKey = getAiCacheKey('wellness-insights', {
    profile,
    logs: logs.slice(0, 5),
    exercises: exercises.slice(0, 5),
    steps,
  });

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const { bmi, bmiCategory } = getBMIData(profile);

      const prompt = `As an AI Wellness Coach, analyze the following data for a user:
      Profile: ${JSON.stringify({ ...profile, bmi, bmiCategory })}
      Recent Food Logs: ${JSON.stringify(logs.slice(0, 5))}
      Recent Exercises: ${JSON.stringify(exercises.slice(0, 5))}
      Today's Steps: ${steps} (Goal: ${profile.dailyStepGoal || 10000})
      
      Provide a concise (2-3 sentences) insight or encouragement for the user to help them reach their goal. Focus on actionable advice based on their physical metrics (Age, BMI Category, etc.) and their daily activity (steps).`;

      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: prompt,
      }, { maxOutputTokens: 180 });

      if (!response.text?.trim()) {
        throw new Error('Wellness insight came back empty.');
      }

      return response.text;
    },
    {
      fallbackValue: localInsight,
      cacheFallback: true,
      successTtlMs: 3 * 60 * 1000,
      fallbackTtlMs: 20 * 1000,
    },
  );
}

export async function chatWithCoach(message: string, profile: ProfileLike, history: CoachHistoryEntry[], currentSteps?: number): Promise<string> {
  const localReply = getLocalCoachReply(message, profile, currentSteps);

  if (!hasAiAccess()) {
    return localReply;
  }

  const recentHistory = history.slice(-8);
  const cacheKey = getAiCacheKey('coach-chat', {
    message,
    profile,
    recentHistory,
    currentSteps,
  });

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const { bmi, bmiCategory } = getBMIData(profile);
      const recentCoachReplies = getRecentCoachReplies(recentHistory);
      const profileName = getProfileName(profile);

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: buildFastAiConfig({
          systemInstruction: `You are the Pace Fuel Coach, a sharp but warm AI coach for fitness, nutrition, and recovery.
          User name: ${profileName}.
          User Profile: ${JSON.stringify({ ...profile, bmi, bmiCategory })}.
          Today's Activity: ${currentSteps ? `${currentSteps} steps` : "Not tracked yet"}.
          
          Core behavior rules:
          - Sound natural, specific, and varied.
          - Do not repeat the same advice, sentence openings, or wording from recent coach replies.
          - If the user asks a follow-up, build on the conversation instead of restarting from scratch.
          - Tailor advice using their age, BMI category, height, weight, goal, activity level, and today's steps.
          - Keep responses concise: 2 to 4 short sentences max.
          - Give one clear next step whenever possible.
          - If asked for medical diagnosis or treatment, briefly advise professional care.
          
          Recent coach replies to avoid repeating:
          ${recentCoachReplies.length ? recentCoachReplies.map((reply, index) => `${index + 1}. ${reply}`).join('\n') : 'None yet.'}`,
        }, { maxOutputTokens: 240, timeout: 8000, temperature: 0.7 }),
        history: recentHistory,
      });

      const response = await chat.sendMessage({ message });
      if (!response.text?.trim()) {
        throw new Error('Coach chat came back empty.');
      }

      return sanitizeResponseText(response.text);
    },
    {
      fallbackValue: localReply,
      cacheFallback: true,
      successTtlMs: 2 * 60 * 1000,
      fallbackTtlMs: 20 * 1000,
    },
  );
}

export async function generateMeditationScript(mood: string, duration: number): Promise<string> {
  const localScript = getLocalMeditationScript(mood, duration);

  if (!hasAiAccess()) {
    return localScript;
  }

  const cacheKey = getAiCacheKey('meditation-script', { mood: mood.trim().toLowerCase(), duration });

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const prompt = `Generate a short meditation script or focus area for a ${duration}-minute session.
      The user's current mood/focus is: ${mood}.
      Provide a calming, supportive message and a specific technique (e.g., box breathing, visualization).
      Keep it under 100 words.`;

      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: prompt,
      }, { maxOutputTokens: 140 });

      if (!response.text?.trim()) {
        throw new Error('Meditation script came back empty.');
      }

      return response.text;
    },
    {
      fallbackValue: localScript,
      cacheFallback: true,
      successTtlMs: 12 * 60 * 1000,
    },
  );
}

export async function getDetailedProgressAnalysis(profile: ProfileLike, healthData: any[]): Promise<string> {
  const localAnalysis = getLocalProgressAnalysis(profile, healthData);

  if (!hasAiAccess()) {
    return localAnalysis;
  }

  const cacheKey = getAiCacheKey('progress-analysis', {
    profile,
    healthData,
  });

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const { bmi, bmiCategory } = getBMIData(profile);

      const prompt = `As an AI Sports Scientist, analyze the following weekly performance data for an athlete:
      Profile: ${JSON.stringify({ ...profile, bmi, bmiCategory })}
      Weekly Data: ${JSON.stringify(healthData)}
      
      Provide a highly specific, actionable recommendation (1-2 sentences) regarding their macro split or training intensity based on the trends in the data and their physical status (BMI Category, Age).
      Focus on helping them reach their goal: ${profile.goal}.`;

      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: prompt,
      }, { maxOutputTokens: 180 });

      if (!response.text?.trim()) {
        throw new Error('Detailed progress analysis came back empty.');
      }

      return response.text;
    },
    {
      fallbackValue: localAnalysis,
      cacheFallback: true,
      successTtlMs: 10 * 60 * 1000,
    },
  );
}

export async function getOptimalNutritionStrategy(profile: ProfileLike): Promise<OptimalNutrition | null> {
  const localStrategy = getLocalNutritionStrategy(profile);

  if (!hasAiAccess()) {
    return localStrategy;
  }

  const cacheKey = getAiCacheKey('nutrition-strategy', profile);

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const { bmi, bmiCategory } = getBMIData(profile);

      const prompt = `As an expert Sports Nutritionist, determine the optimal daily calorie and macro-nutrient goals for an athlete with the following profile:
      Age: ${profile.age}
      Height: ${profile.height}cm
      Weight: ${profile.weight}kg
      BMI: ${bmi} (${bmiCategory})
      Athlete Type: ${profile.athleteType}
      Goal: ${profile.goal}
      Activity Level: ${profile.activityLevel}
      Diet Preference: ${profile.dietPreference}
      
      Calculate the precise Calories (kcal), Protein (g), Carbs (g), and Fats (g) they should aim for daily.
      Provide a brief (1 sentence) reasoning for these specific numbers based on their physical metrics and goal.
      Return the data in JSON format.`;

      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fats: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["calories", "protein", "carbs", "fats", "reasoning"]
          }
        }
      }, { maxOutputTokens: 220 });

      const parsed = safeParseJson<OptimalNutrition>(response.text);
      if (!parsed) {
        throw new Error('Nutrition strategy returned no usable AI output.');
      }

      return parsed;
    },
    {
      fallbackValue: localStrategy,
      cacheFallback: Boolean(localStrategy),
      successTtlMs: 60 * 60 * 1000,
    },
  );
}

export async function getOptimalTrainingStrategy(profile: ProfileLike): Promise<OptimalTraining | null> {
  const localStrategy = getLocalTrainingStrategy(profile);

  if (!hasAiAccess()) {
    return localStrategy;
  }

  const cacheKey = getAiCacheKey('training-strategy', profile);

  return withAiCache(
    cacheKey,
    async () => {
      const ai = requireAiClient();
      const { bmi, bmiCategory } = getBMIData(profile);

      const prompt = `As an elite Performance Coach, recommend the optimal training frequency and focus for an athlete with the following profile:
      Age: ${profile.age}
      Height: ${profile.height}cm
      Weight: ${profile.weight}kg
      BMI: ${bmi} (${bmiCategory})
      Athlete Type: ${profile.athleteType}
      Goal: ${profile.goal}
      Activity Level: ${profile.activityLevel}
      Available Equipment: ${profile.equipment?.join(", ") || "None"}
      
      Recommend:
      1. Optimal training frequency (days per week).
      2. Focus areas (muscle groups or performance aspects).
      3. Detailed reasoning for these choices.
      
      Return the data in JSON format.`;

      const response = await generateFastContent(ai, {
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              frequency: { type: Type.NUMBER },
              focusAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
              reasoning: { type: Type.STRING }
            },
            required: ["frequency", "focusAreas", "reasoning"]
          }
        }
      }, { maxOutputTokens: 260 });

      const parsed = safeParseJson<OptimalTraining>(response.text);
      if (!parsed) {
        throw new Error('Training strategy returned no usable AI output.');
      }

      return parsed;
    },
    {
      fallbackValue: localStrategy,
      cacheFallback: Boolean(localStrategy),
      successTtlMs: 60 * 60 * 1000,
    },
  );
}
