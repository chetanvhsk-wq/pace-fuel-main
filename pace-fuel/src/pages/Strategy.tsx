import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Brain, Sparkles, Zap, Target, Activity, Loader2, ChevronRight, Info, RotateCcw } from 'lucide-react';
import { db, auth, getDoc, doc, setDoc } from '../firebase';
import { UserProfile } from '../types';
import { getOptimalNutritionStrategy, getOptimalTrainingStrategy, OptimalNutrition, OptimalTraining } from '../services/aiService';

export default function Strategy() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nutritionStrategy, setNutritionStrategy] = useState<OptimalNutrition | null>(null);
  const [trainingStrategy, setTrainingStrategy] = useState<OptimalTraining | null>(null);
  const [isCalculatingNutrition, setIsCalculatingNutrition] = useState(false);
  const [isCalculatingTraining, setIsCalculatingTraining] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        // Initial strategy if goals are set
        if (data.dailyCalorieGoal) {
          setNutritionStrategy({
            calories: data.dailyCalorieGoal,
            protein: data.dailyProteinGoal || 0,
            carbs: data.dailyCarbsGoal || 0,
            fats: data.dailyFatsGoal || 0,
            reasoning: "Current active strategy based on your profile."
          });
        }
        if (data.trainingFrequency) {
          setTrainingStrategy({
            frequency: data.trainingFrequency,
            focusAreas: data.trainingFocus || [],
            reasoning: "Current active strategy based on your profile."
          });
        }
      }
    });
  }, []);

  const updateNutrition = async () => {
    if (!profile) return;
    setIsCalculatingNutrition(true);
    const strategy = await getOptimalNutritionStrategy(profile);
    if (strategy) {
      setNutritionStrategy(strategy);
      await setDoc(doc(db, 'users', profile.uid), {
        ...profile,
        dailyCalorieGoal: strategy.calories,
        dailyProteinGoal: strategy.protein,
        dailyCarbsGoal: strategy.carbs,
        dailyFatsGoal: strategy.fats,
        dailyStepGoal: strategy.calories > 2500 ? 10000 : 8000 // Simple logic for step goal based on activity/calories
      }, { merge: true });
    }
    setIsCalculatingNutrition(false);
  };

  const updateTraining = async () => {
    if (!profile) return;
    setIsCalculatingTraining(true);
    const strategy = await getOptimalTrainingStrategy(profile);
    if (strategy) {
      setTrainingStrategy(strategy);
      await setDoc(doc(db, 'users', profile.uid), {
        ...profile,
        trainingFrequency: strategy.frequency,
        trainingFocus: strategy.focusAreas
      }, { merge: true });
    }
    setIsCalculatingTraining(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      <div className="space-y-2">
        <p className="font-label text-outline text-[10px] uppercase tracking-[0.2em] font-bold">AI Performance Lab</p>
        <h1 className="font-headline text-4xl font-black text-on-surface tracking-tighter italic">
          Athlete <span className="text-primary">Strategy</span>
        </h1>
        <p className="font-body text-sm text-outline">Deep insights and personalized recommendations for your peak performance.</p>
      </div>

      {/* Nutrition Strategy */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between relative z-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-black italic tracking-tight">Nutrition Strategy</h3>
              <p className="font-body text-xs text-outline">Optimal daily macro-nutrient distribution.</p>
            </div>
          </div>
          <button 
            onClick={updateNutrition}
            disabled={isCalculatingNutrition}
            className="p-3 bg-primary text-on-primary rounded-2xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 w-full sm:w-auto flex justify-center"
          >
            {isCalculatingNutrition ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
          </button>
        </div>

        {nutritionStrategy ? (
          <div className="space-y-6 relative z-10">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-surface rounded-3xl border border-surface-container text-center">
                <p className="font-headline text-3xl font-black text-primary">{nutritionStrategy.calories}</p>
                <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Calories (kcal)</p>
              </div>
              <div className="p-6 bg-surface rounded-3xl border border-surface-container text-center">
                <p className="font-headline text-3xl font-black text-on-surface">{nutritionStrategy.protein}g</p>
                <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Protein</p>
              </div>
              <div className="p-6 bg-surface rounded-3xl border border-surface-container text-center">
                <p className="font-headline text-3xl font-black text-on-surface">{nutritionStrategy.carbs}g</p>
                <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Carbs</p>
              </div>
              <div className="p-6 bg-surface rounded-3xl border border-surface-container text-center">
                <p className="font-headline text-3xl font-black text-on-surface">{nutritionStrategy.fats}g</p>
                <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Fats</p>
              </div>
            </div>
            <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 flex gap-4">
              <Brain className="w-6 h-6 text-primary shrink-0" />
              <p className="text-sm text-on-surface leading-relaxed italic">
                "{nutritionStrategy.reasoning}"
              </p>
            </div>
          </div>
        ) : (
          <div className="p-10 border-2 border-dashed border-surface-container rounded-3xl text-center">
            <p className="text-outline font-body text-sm">No strategy generated yet.</p>
            <button onClick={updateNutrition} className="mt-4 text-primary font-headline font-bold flex items-center gap-2 mx-auto">
              <Sparkles className="w-5 h-5" /> Generate Strategy
            </button>
          </div>
        )}
      </section>

      {/* Training Strategy */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-secondary/5 rounded-full blur-3xl"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between relative z-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-black italic tracking-tight">Training Strategy</h3>
              <p className="font-body text-xs text-outline">Optimal frequency and performance focus.</p>
            </div>
          </div>
          <button 
            onClick={updateTraining}
            disabled={isCalculatingTraining}
            className="p-3 bg-secondary text-on-secondary rounded-2xl shadow-lg shadow-secondary/20 hover:opacity-90 transition-all disabled:opacity-50 w-full sm:w-auto flex justify-center"
          >
            {isCalculatingTraining ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
          </button>
        </div>

        {trainingStrategy ? (
          <div className="space-y-6 relative z-10">
            <div className="grid grid-cols-1 gap-4">
              <div className="p-6 bg-surface rounded-3xl border border-surface-container flex items-center justify-between">
                <div>
                  <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Frequency</p>
                  <p className="font-headline text-3xl font-black text-secondary">{trainingStrategy.frequency} Days / Week</p>
                </div>
                <Activity className="w-10 h-10 text-secondary/20" />
              </div>
              <div className="p-6 bg-surface rounded-3xl border border-surface-container space-y-4">
                <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Focus Areas</p>
                <div className="flex flex-wrap gap-2">
                  {trainingStrategy.focusAreas.map(area => (
                    <span key={area} className="px-4 py-2 bg-secondary/10 text-secondary rounded-xl text-xs font-bold uppercase tracking-widest">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex gap-4">
              <Info className="w-6 h-6 text-secondary shrink-0" />
              <p className="text-sm text-on-surface leading-relaxed italic">
                "{trainingStrategy.reasoning}"
              </p>
            </div>
          </div>
        ) : (
          <div className="p-10 border-2 border-dashed border-surface-container rounded-3xl text-center">
            <p className="text-outline font-body text-sm">No strategy generated yet.</p>
            <button onClick={updateTraining} className="mt-4 text-secondary font-headline font-bold flex items-center gap-2 mx-auto">
              <Sparkles className="w-5 h-5" /> Generate Strategy
            </button>
          </div>
        )}
      </section>

      <div className="p-6 bg-surface-container rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-on-surface/10 rounded-lg">
          <Brain className="w-4 h-4 text-outline" />
        </div>
        <p className="text-[10px] text-outline leading-relaxed">
          Our AI analyzes your athlete profile, goals, and physical metrics to suggest these strategies. These are starting points—listen to your body and adjust as needed.
        </p>
      </div>
    </motion.div>
  );
}
