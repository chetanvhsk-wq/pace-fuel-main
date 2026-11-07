export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  athleteType?: 'endurance' | 'strength' | 'hybrid' | 'general';
  goal?: 'performance' | 'weight-loss' | 'muscle-gain' | 'maintenance';
  activityLevel?: 'sedentary' | 'moderate' | 'active' | 'pro';
  dietPreference?: 'north-indian' | 'south-indian' | 'vegetarian' | 'non-vegetarian' | 'vegan' | 'eggetarian';
  dailyCalorieGoal: number;
  dailyWaterGoal: number;
  dailyStepGoal: number;
  dailyProteinGoal: number;
  dailyCarbsGoal: number;
  dailyFatsGoal: number;
  age?: number;
  height?: number; // in cm
  weight?: number; // in kg
  equipment?: string[]; // e.g. ['dumbbells', 'barbell', 'bench', 'none']
  muscleRecovery?: { [key: string]: number }; // muscle group -> recovery % (0-100)
  personalRecords?: { [exercise: string]: number }; // exercise name -> max weight (kg)
  trainingFrequency?: number; // days per week
  trainingFocus?: string[]; // e.g. ['strength', 'hypertrophy']
  createdAt: string;
}

export interface SupplementLogEntry {
  id?: string;
  userId: string;
  name: string;
  dosage?: string;
  timestamp: string;
  taken?: boolean;
}

export interface FoodLogEntry {
  id?: string;
  userId: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: string;
  imageUrl?: string;
}

export interface WaterLogEntry {
  id?: string;
  userId: string;
  amount: number; // in liters
  timestamp: string;
}

export interface WellnessSession {
  id?: string;
  userId: string;
  type: 'meditation' | 'sleep' | 'stress';
  duration: number; // in minutes
  score?: number; // 0-100
  timestamp: string;
}

export interface ExerciseEntry {
  id?: string;
  userId: string;
  name: string;
  duration: number; // in minutes
  caloriesBurned: number;
  intensity: 'low' | 'moderate' | 'high';
  sets?: number;
  reps?: number;
  weight?: number; // in kg
  volume?: number; // sets * reps * weight
  muscleGroup?: string;
  timestamp: string;
}

export interface DailySummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalWater: number;
  totalSteps: number;
  healthScore: number;
}

export interface WeightEntry {
  id?: string;
  userId: string;
  weight: number;
  timestamp: string;
}

export interface StepLogEntry {
  id?: string;
  userId: string;
  steps: number;
  timestamp: string;
  source?: 'manual' | 'auto';
  dateKey?: string;
}
