import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { History, PlusCircle, Utensils, Coffee, Pizza, Apple, Zap, Dumbbell, Timer, Flame, Loader2, Brain } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { FoodLogEntry, UserProfile, ExerciseEntry } from '../types';
import { generateFoodRecommendations, FoodRecommendation } from '../services/aiService';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { filterEntriesForToday, sortEntriesByTimestamp } from '../lib/logUtils';
import { createFoodLogEntry } from '../lib/foodLogging';
import { getMealTypeLabel, MEAL_TYPE_OPTIONS, MealType } from '../lib/mealTypes';

const fuelingGuides = {
  endurance: {
    pre: { title: "Pre-Run Fuel", items: ["Oatmeal with Banana", "Toast with Jam", "Beetroot Juice"], icon: Timer },
    post: { title: "Recovery Fuel", items: ["Pasta with Lean Protein", "Chocolate Milk", "Sweet Potato"], icon: Zap }
  },
  strength: {
    pre: { title: "Pre-Lift Fuel", items: ["Rice Cakes with PB", "Greek Yogurt", "Coffee"], icon: Dumbbell },
    post: { title: "Anabolic Window", items: ["Chicken & Rice", "Whey Protein", "Eggs & Avocado"], icon: Flame }
  },
  hybrid: {
    pre: { title: "WOD Fuel", items: ["Apple & Almond Butter", "Cottage Cheese", "Honey Toast"], icon: Zap },
    post: { title: "Total Recovery", items: ["Quinoa Bowl", "Salmon & Greens", "Protein Smoothie"], icon: Flame }
  },
  general: {
    pre: { title: "Active Fuel", items: ["Fruit Salad", "Handful of Nuts", "Green Tea"], icon: Zap },
    post: { title: "Balanced Meal", items: ["Grilled Chicken Salad", "Lentil Soup", "Stir-fry Veggies"], icon: Utensils }
  }
};

const MET_VALUES: Record<string, number> = {
  'running': 9.8,
  'walking': 3.5,
  'cycling': 7.5,
  'swimming': 8.0,
  'weightlifting': 6.0,
  'yoga': 2.5,
  'hiit': 12.0,
  'crossfit': 10.0,
  'default': 5.0
};

export default function FoodLog() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'fuel' | 'exercise'>('fuel');
  const [logs, setLogs] = useState<FoodLogEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [foodRecommendations, setFoodRecommendations] = useState<FoodRecommendation[]>([]);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [recommendationMealType, setRecommendationMealType] = useState<MealType>('breakfast');
  const [recommendationHistoryByMeal, setRecommendationHistoryByMeal] = useState<Record<MealType, string[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  });

  const calorieGoal = profile?.dailyCalorieGoal || 2150;
  const proteinGoal = profile?.dailyProteinGoal || 165;
  const carbsGoal = profile?.dailyCarbsGoal || 280;
  const caloriesBurnedTotal = exercises.reduce((acc, ex) => acc + ex.caloriesBurned, 0);
  const netCalories = calories - caloriesBurnedTotal;
  const remainingCalories = calorieGoal - netCalories;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Profile
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    const q = query(
      collection(db, 'foodLogs'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = sortEntriesByTimestamp(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodLogEntry))
      );
      setLogs(data);
      const todayLogs = filterEntriesForToday(data);
      
      setCalories(todayLogs.reduce((acc, l) => acc + l.calories, 0));
      setProtein(todayLogs.reduce((acc, l) => acc + l.protein, 0));
      setCarbs(todayLogs.reduce((acc, l) => acc + l.carbs, 0));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'foodLogs'));

    const eq = query(
      collection(db, 'exercises'),
      where('userId', '==', user.uid)
    );

    const unsubEx = onSnapshot(eq, (snapshot) => {
      const data = filterEntriesForToday(
        sortEntriesByTimestamp(
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseEntry))
        )
      );
      setExercises(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'exercises'));

    return () => {
      unsub();
      unsubEx();
    };
  }, []);

  useEffect(() => {
    setFoodRecommendations([]);
  }, [recommendationMealType]);

  const navigateToAddFood = (mealType: MealType) => {
    navigate(`/food/add?meal=${mealType}`);
  };

  const logFood = async (
    food: { name: string; calories: number; protein: number; carbs: number; fats: number },
    mealType: MealType = 'snack',
  ) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await createFoodLogEntry(user.uid, food, mealType);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'foodLogs');
    }
  };

  const getRecommendations = async () => {
    if (!profile) return;
    setIsGeneratingRecommendations(true);
    try {
      const seenNames = recommendationHistoryByMeal[recommendationMealType] || [];
      const recs = await generateFoodRecommendations(profile, {
        mealType: recommendationMealType,
        excludeNames: seenNames,
      });

      setFoodRecommendations(recs);
      setRecommendationHistoryByMeal((prev) => ({
        ...prev,
        [recommendationMealType]: Array.from(
          new Set([...prev[recommendationMealType], ...recs.map((item) => item.name)]),
        ),
      }));
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const frequentEntries = [
    { name: 'Paneer Curry', calories: 340, protein: 18, carbs: 12, fats: 24 },
    { name: 'Protein Shake', calories: 180, protein: 30, carbs: 5, fats: 2 },
    { name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fats: 2 },
    { name: 'Dal Tadka', calories: 150, protein: 8, carbs: 22, fats: 4 }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8 pb-20"
    >
      {/* Hero: Daily Summary */}
      <section className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-container p-6 md:p-8 text-on-primary shadow-2xl">
        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="font-label text-[10px] uppercase tracking-[0.3em] opacity-80 mb-2 font-bold">Net Calories Remaining</span>
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter mb-6 break-all">
            {remainingCalories.toLocaleString()}
          </h1>
          
          <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
            <div className="flex flex-col items-center">
              <span className="font-headline text-xl font-bold">{calories.toLocaleString()}</span>
              <span className="font-label text-[8px] uppercase tracking-widest opacity-70">Intake</span>
            </div>
            <div className="flex flex-col items-center border-x border-white/20">
              <span className="font-headline text-xl font-bold">{caloriesBurnedTotal.toLocaleString()}</span>
              <span className="font-label text-[8px] uppercase tracking-widest opacity-70">Burned</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-headline text-xl font-bold">{calorieGoal.toLocaleString()}</span>
              <span className="font-label text-[8px] uppercase tracking-widest opacity-70">Goal</span>
            </div>
          </div>
        </div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary-container/30 rounded-full blur-3xl"></div>
      </section>

      {/* AI Food Recommendations */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline text-2xl font-black italic tracking-tight">AI Fuel Recommendations</h3>
                <p className="font-body text-sm text-outline">
                  Personalized {getMealTypeLabel(recommendationMealType).toLowerCase()} ideas based on your {profile?.dietPreference?.replace('-', ' ')} preference.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {MEAL_TYPE_OPTIONS.map((option) => {
                const selected = option.value === recommendationMealType;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRecommendationMealType(option.value)}
                    className={cn(
                      'rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all',
                      selected
                        ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                        : 'bg-surface text-outline border border-surface-container hover:border-primary/20 hover:text-primary',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

          {foodRecommendations.length === 0 ? (
            <button 
              onClick={getRecommendations}
              disabled={isGeneratingRecommendations || !profile}
              className="w-full py-5 bg-primary text-on-primary rounded-2xl font-headline font-bold flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isGeneratingRecommendations ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>Get {getMealTypeLabel(recommendationMealType)} Suggestions</span>
                  <Zap className="w-5 h-5" />
                </>
              )}
            </button>
          ) : (
            <div className="space-y-4">
              {foodRecommendations.map((rec, i) => (
                <div key={i} className="p-5 bg-surface rounded-2xl border border-surface-container space-y-3 group hover:border-primary/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-headline font-bold text-on-surface">{rec.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-outline uppercase font-label tracking-widest">{rec.calories} kcal</span>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-label uppercase tracking-widest rounded-full font-bold">
                          {rec.dietType}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => logFood(rec, recommendationMealType)}
                      className="p-2 bg-primary/10 text-primary rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-outline leading-relaxed">{rec.description}</p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-container">
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-label text-outline">Protein</p>
                      <p className="text-xs font-bold">{rec.protein}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-label text-outline">Carbs</p>
                      <p className="text-xs font-bold">{rec.carbs}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-label text-outline">Fats</p>
                      <p className="text-xs font-bold">{rec.fats}g</p>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={getRecommendations}
                className="w-full py-3 text-outline font-label text-[10px] uppercase tracking-widest hover:text-primary transition-colors"
              >
                Get Fresh {getMealTypeLabel(recommendationMealType)} Suggestions
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Quick Add Flow */}
            <section className="space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-label text-[10px] uppercase tracking-[0.25em] text-outline font-bold">Quick Add</p>
                  <h2 className="font-headline text-2xl font-extrabold tracking-tight">Choose a meal to log</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToAddFood('snack')}
                  className="rounded-full border border-surface-container bg-surface px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:border-primary/30"
                >
                  Open Add Food
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {MEAL_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => navigateToAddFood(option.value)}
                    className={cn(
                      'group rounded-3xl border border-surface-container bg-surface p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg',
                      option.value === 'breakfast' && 'hover:bg-amber-50/60',
                      option.value === 'lunch' && 'hover:bg-primary/5',
                      option.value === 'dinner' && 'hover:bg-indigo-50/60',
                      option.value === 'snack' && 'hover:bg-rose-50/60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-2xl bg-surface-container-low p-3 text-primary transition-colors group-hover:bg-white">
                        {option.value === 'breakfast' && <Coffee className="h-6 w-6" />}
                        {option.value === 'lunch' && <Pizza className="h-6 w-6" />}
                        {option.value === 'dinner' && <Utensils className="h-6 w-6" />}
                        {option.value === 'snack' && <Apple className="h-6 w-6" />}
                      </div>
                      <span className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">
                        {option.shortLabel}
                      </span>
                    </div>
                    <div className="mt-5 space-y-1">
                      <p className="font-headline text-xl font-black tracking-tight">{option.label}</p>
                      <p className="text-sm text-outline">
                        Search, scan, and log directly into {option.label.toLowerCase()}.
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Athlete Fueling Guide */}
              {profile?.athleteType && fuelingGuides[profile.athleteType] && (
                <div className="grid grid-cols-2 gap-3">
                  {[fuelingGuides[profile.athleteType].pre, fuelingGuides[profile.athleteType].post].map((guide, i) => (
                    <div key={i} className="bg-surface-container-low p-4 rounded-2xl border border-surface-container relative overflow-hidden group">
                      <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <guide.icon className="w-16 h-16" />
                      </div>
                      <h4 className="font-headline font-bold text-sm text-primary mb-2 flex items-center gap-2">
                        <guide.icon className="w-4 h-4" /> {guide.title}
                      </h4>
                      <ul className="space-y-1">
                        {guide.items.map((item, j) => (
                          <li key={j} className="text-[10px] font-body text-outline flex items-center gap-1">
                            <div className="w-1 h-1 bg-primary rounded-full" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Macro Visualization */}
            <section className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-3 bg-surface-container-low px-6 py-4 rounded-full border border-primary/5">
                <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent flex items-center justify-center">
                  <span className="text-xs font-label font-bold">{Math.round((protein / proteinGoal) * 100)}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label text-[10px] uppercase text-outline">Protein</span>
                  <span className="font-headline font-bold text-primary">{protein}g / {proteinGoal}g</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-surface-container-low px-6 py-4 rounded-full border border-secondary/5">
                <div className="w-12 h-12 rounded-full border-4 border-secondary border-t-transparent flex items-center justify-center">
                  <span className="text-xs font-label font-bold">{Math.round((carbs / carbsGoal) * 100)}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label text-[10px] uppercase text-outline">Carbs</span>
                  <span className="font-headline font-bold text-secondary">{carbs}g / {carbsGoal}g</span>
                </div>
              </div>
            </section>

            {/* Today's Meals */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-2xl font-extrabold tracking-tight">Today's Meals</h2>
                <button className="text-primary font-label text-sm font-semibold flex items-center gap-1">
                  <History className="w-4 h-4" /> History
                </button>
              </div>

              {['breakfast', 'lunch', 'dinner', 'snack'].map(meal => {
                const mealLogs = logs.filter(l => l.mealType === meal && new Date(l.timestamp).toDateString() === new Date().toDateString());
                const totalKcal = mealLogs.reduce((acc, l) => acc + l.calories, 0);
                
                return (
                  <div key={meal} className="bg-surface-container-low rounded-3xl p-5 md:p-6 transition-all hover:bg-surface-container-high group border border-surface-container">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          {meal === 'breakfast' && <Coffee className="w-6 h-6" />}
                          {meal === 'lunch' && <Pizza className="w-6 h-6" />}
                          {meal === 'dinner' && <Utensils className="w-6 h-6" />}
                          {meal === 'snack' && <Apple className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="font-headline text-lg font-bold capitalize">{meal}</h3>
                          <p className="font-label text-xs text-outline uppercase tracking-wider">
                            {mealLogs.length > 0 ? format(new Date(mealLogs[0].timestamp), 'hh:mm a') : '--:--'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-headline text-xl font-bold">{totalKcal}</span>
                        <p className="font-label text-[10px] uppercase text-outline">kcal</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {mealLogs.map((log, i) => (
                        <div key={i} className="flex items-center justify-between group/item">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                              <Utensils className="w-4 h-4 text-outline" />
                            </div>
                            <div>
                              <p className="font-body text-sm font-medium">{log.name}</p>
                              <p className="font-label text-[10px] text-outline">{log.calories} kcal</p>
                            </div>
                          </div>
                          <span className="font-label text-sm font-semibold">{log.calories} kcal</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => navigateToAddFood(meal as MealType)}
                      className="w-full mt-6 py-3 border border-dashed border-outline-variant rounded-full text-primary font-label text-xs uppercase tracking-widest hover:bg-surface transition-colors flex items-center justify-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" /> Add {getMealTypeLabel(meal as MealType)} Item
                    </button>
                  </div>
                );
              })}
            </section>
    </motion.div>
  );
}
