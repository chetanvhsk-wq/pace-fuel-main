import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Apple,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Coffee,
  Loader2,
  Pizza,
  Search,
  SquarePlus,
  Utensils,
  X,
} from 'lucide-react';
import { auth, handleFirestoreError, OperationType } from '../firebase';
import { analyzeFoodImage, FoodAnalysis, searchFood } from '../services/aiService';
import { createFoodLogEntry } from '../lib/foodLogging';
import { getMealTypeLabel, MEAL_TYPE_OPTIONS, MealType, normalizeMealType } from '../lib/mealTypes';

const quickSearches = ['Idli Sambar', 'Chicken Biryani', 'Oats Bowl', 'Paneer Wrap', 'Protein Shake'];

function MealTypeIcon({ mealType }: { mealType: MealType }) {
  if (mealType === 'breakfast') {
    return <Coffee className="h-5 w-5" />;
  }

  if (mealType === 'lunch') {
    return <Pizza className="h-5 w-5" />;
  }

  if (mealType === 'dinner') {
    return <Utensils className="h-5 w-5" />;
  }

  return <Apple className="h-5 w-5" />;
}

export default function AddFood() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMealType = useMemo(
    () => normalizeMealType(searchParams.get('meal')),
    [searchParams],
  );

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodAnalysis[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedFood, setAnalyzedFood] = useState<FoodAnalysis | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 180);

    return () => window.clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const clearTimer = window.setTimeout(() => setSuccessMessage(null), 2600);
    return () => window.clearTimeout(clearTimer);
  }, [successMessage]);

  const updateMealType = (mealType: MealType) => {
    setSearchParams({ meal: mealType }, { replace: true });
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!searchQuery.trim()) {
      setSearchError('Type a food name to search.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await searchFood(searchQuery);
      setSearchResults(results);

      if (results.length === 0) {
        setSearchError('No foods matched that search. Try a simpler name.');
      }
    } catch (error: any) {
      setSearchError(error?.message || 'Unable to search foods right now.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogFood = async (food: FoodAnalysis) => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/');
      return;
    }

    try {
      await createFoodLogEntry(user.uid, food, selectedMealType);
      setSuccessMessage(`Added ${food.name} to ${getMealTypeLabel(selectedMealType)}.`);
      setSearchQuery('');
      setSearchResults([]);
      setAnalyzedFood(null);
      window.setTimeout(() => searchInputRef.current?.focus(), 120);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'foodLogs');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsAnalyzing(true);
    setSearchError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const result = await analyzeFoodImage(base64);
          setAnalyzedFood(result);
        } catch (error) {
          console.error('Error analyzing image:', error);
          setSearchError('Photo analysis needs a valid online AI connection.');
        } finally {
          setIsAnalyzing(false);
          event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading image:', error);
      setIsAnalyzing(false);
      setSearchError('Unable to read that image.');
      event.target.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 pb-20"
    >
      <section className="rounded-3xl md:rounded-[2.5rem] border border-surface-container bg-surface-container-low p-6 md:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/food')}
              className="inline-flex items-center gap-2 rounded-full border border-surface-container bg-surface px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-outline transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Food
            </button>

            <div className="space-y-1">
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-outline">
                Add Food
              </span>
              <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">
                Log your next meal fast
              </h1>
              <p className="max-w-xl text-sm text-outline">
                Pick the meal, search what you ate, and add it with one tap. Your chosen meal stays pre-selected so you can log quickly.
              </p>
            </div>
          </div>

          <div className="hidden rounded-[2rem] bg-primary/10 p-4 text-primary md:flex">
            <MealTypeIcon mealType={selectedMealType} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl md:rounded-[2.5rem] border border-surface-container bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {MEAL_TYPE_OPTIONS.map((option) => {
            const isSelected = option.value === selectedMealType;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateMealType(option.value)}
                className={`flex min-w-[138px] flex-1 items-center gap-3 rounded-[1.75rem] border px-4 py-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary text-on-primary shadow-lg shadow-primary/15'
                    : 'border-surface-container bg-surface-container-low text-on-surface hover:border-primary/30'
                }`}
              >
                <div className={`rounded-2xl p-3 ${isSelected ? 'bg-white/15' : 'bg-white'}`}>
                  <MealTypeIcon mealType={option.value} />
                </div>
                <div className="min-w-0">
                  <p className="font-headline text-base font-bold">{option.label}</p>
                  <p className={`font-label text-[10px] uppercase tracking-widest ${isSelected ? 'text-white/80' : 'text-outline'}`}>
                    {option.shortLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl md:rounded-[2.5rem] border border-surface-container bg-surface-container-low p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">
              Logging to {getMealTypeLabel(selectedMealType)}
            </p>
            <h2 className="font-headline text-2xl font-black tracking-tight">Search and add food</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickSearches.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setSearchQuery(suggestion);
                  window.setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
                className="rounded-full border border-surface-container bg-surface px-3 py-2 text-[11px] font-semibold text-outline transition-colors hover:border-primary/30 hover:text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
          <input
            ref={searchInputRef}
            autoFocus
            className="w-full rounded-[1.75rem] border border-surface-container bg-surface px-12 py-5 pr-36 font-body text-base shadow-sm transition-all placeholder:text-outline focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            placeholder={`Search food for ${getMealTypeLabel(selectedMealType).toLowerCase()}...`}
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-surface-container bg-surface transition-colors hover:border-primary/30">
              <Camera className="h-5 w-5 text-primary" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-full bg-primary px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-on-primary transition-opacity disabled:opacity-60"
            >
              Search
            </button>
          </div>
        </form>

        <AnimatePresence>
          {successMessage ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-primary"
            >
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-semibold">{successMessage}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {searchError ? (
          <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {searchError}
          </div>
        ) : null}

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-primary/15 bg-surface px-6 py-10 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="font-headline text-lg font-bold text-primary">Analyzing your photo</p>
              <p className="text-sm text-outline">Estimating macros and matching the food to your selected meal.</p>
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {analyzedFood ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative space-y-4 rounded-3xl border border-primary/20 bg-surface p-5 shadow-lg"
            >
              <button
                type="button"
                onClick={() => setAnalyzedFood(null)}
                className="absolute right-4 top-4 rounded-full bg-surface-container p-2 text-outline transition-colors hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary/10 p-4 text-primary">
                  <Utensils className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-headline text-xl font-bold">{analyzedFood.name}</p>
                  <p className="text-sm text-outline">{analyzedFood.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-surface-container-low p-3 text-center">
                  <p className="font-label text-[10px] uppercase tracking-widest text-outline">Calories</p>
                  <p className="font-bold">{analyzedFood.calories}</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low p-3 text-center">
                  <p className="font-label text-[10px] uppercase tracking-widest text-outline">Protein</p>
                  <p className="font-bold">{analyzedFood.protein}g</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low p-3 text-center">
                  <p className="font-label text-[10px] uppercase tracking-widest text-outline">Carbs</p>
                  <p className="font-bold">{analyzedFood.carbs}g</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low p-3 text-center">
                  <p className="font-label text-[10px] uppercase tracking-widest text-outline">Fats</p>
                  <p className="font-bold">{analyzedFood.fats}g</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleLogFood(analyzedFood)}
                className="w-full rounded-2xl bg-primary py-4 text-[11px] font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-95"
              >
                Add to {getMealTypeLabel(selectedMealType)}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isSearching ? (
          <div className="py-4 text-center text-primary">
            <span className="animate-pulse font-semibold">Searching food database...</span>
          </div>
        ) : null}

        {searchResults.length > 0 ? (
          <div className="space-y-3">
            {searchResults.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between gap-4 rounded-3xl border border-surface-container bg-surface px-5 py-4 transition-colors hover:border-primary/25"
              >
                <div className="min-w-0">
                  <p className="font-headline text-lg font-bold text-on-surface">{item.name}</p>
                  <p className="text-sm text-outline">
                    {item.calories} kcal • Protein {item.protein}g • Carbs {item.carbs}g • Fat {item.fats}g
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLogFood(item)}
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-on-primary"
                  aria-label={`Add ${item.name} to ${getMealTypeLabel(selectedMealType)}`}
                >
                  <SquarePlus className="h-6 w-6" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </motion.div>
  );
}
