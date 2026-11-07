import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, Droplets, Brain, Activity, Flame, ChevronRight, Plus, Pill, Target, Trophy, TrendingUp, Sparkles, Loader2, Footprints } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, auth, OperationType, handleFirestoreError, collection, query, where, onSnapshot, getDoc, doc, addDoc } from '../firebase';
import { FoodLogEntry, WaterLogEntry, WellnessSession, UserProfile, SupplementLogEntry, StepLogEntry } from '../types';
import { getWellnessInsights } from '../services/aiService';
import { ExerciseEntry } from '../types';
import { filterEntriesForToday, sortEntriesByTimestamp } from '../lib/logUtils';

export default function Dashboard() {
  const [logs, setLogs] = useState<FoodLogEntry[]>([]);
  const [water, setWater] = useState(0);
  const [mind, setMind] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [supps, setSupps] = useState<SupplementLogEntry[]>([]);
  const [calories, setCalories] = useState(0);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [totalVolume, setTotalVolume] = useState(0);
  const [steps, setSteps] = useState(0);
  const [isLoggingSteps, setIsLoggingSteps] = useState(false);
  const [stepInput, setStepInput] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Profile
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    // Food Logs
    const foodQ = query(
      collection(db, 'foodLogs'), 
      where('userId', '==', user.uid)
    );
    const unsubFood = onSnapshot(foodQ, (snapshot) => {
      const data = sortEntriesByTimestamp(snapshot.docs.map(doc => doc.data() as FoodLogEntry));
      const todayFoodLogs = filterEntriesForToday(data);
      setLogs(data.slice(0, 5));
      setCalories(todayFoodLogs.reduce((acc, l) => acc + l.calories, 0));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'foodLogs'));

    // Water
    const waterQ = query(
      collection(db, 'waterLogs'), 
      where('userId', '==', user.uid)
    );
    const unsubWater = onSnapshot(waterQ, (snapshot) => {
      const totalWater = filterEntriesForToday(
        snapshot.docs.map(doc => doc.data() as WaterLogEntry)
      )
        .reduce((acc, l) => acc + l.amount, 0);
      setWater(totalWater);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'waterLogs'));

    // Wellness
    const wellQ = query(
      collection(db, 'wellnessSessions'), 
      where('userId', '==', user.uid)
    );
    const unsubWell = onSnapshot(wellQ, (snapshot) => {
      const totalMind = filterEntriesForToday(
        snapshot.docs.map(doc => doc.data() as WellnessSession)
      )
        .filter(l => l.type === 'meditation')
        .reduce((acc, l) => acc + l.duration, 0);
      setMind(totalMind);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'wellnessSessions'));

    // Supplements
    const suppQ = query(
      collection(db, 'supplementLogs'), 
      where('userId', '==', user.uid)
    );
    const unsubSupp = onSnapshot(suppQ, (snapshot) => {
      const todaySupps = filterEntriesForToday(
        snapshot.docs.map(doc => doc.data() as SupplementLogEntry)
      );
      setSupps(todaySupps);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'supplementLogs'));

    // Exercises
    const exQ = query(
      collection(db, 'exercises'), 
      where('userId', '==', user.uid)
    );
    const unsubEx = onSnapshot(exQ, (snapshot) => {
      const todayEx = filterEntriesForToday(
        snapshot.docs.map(doc => doc.data() as ExerciseEntry)
      );
      setExercises(todayEx);
      setTotalVolume(todayEx.reduce((acc, ex) => acc + (ex.volume || 0), 0));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'exercises'));

    // Steps
    const stepsQ = query(
      collection(db, 'stepLogs'),
      where('userId', '==', user.uid)
    );
    const unsubSteps = onSnapshot(stepsQ, (snapshot) => {
      const totalSteps = filterEntriesForToday(
        snapshot.docs.map(doc => doc.data() as StepLogEntry)
      )
        .reduce((acc, l) => acc + l.steps, 0);
      setSteps(totalSteps);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'stepLogs'));

    return () => {
      unsubFood();
      unsubWater();
      unsubWell();
      unsubSupp();
      unsubEx();
      unsubSteps();
    };
  }, []);

  const fetchInsight = async () => {
    if (!profile) return;
    setIsLoadingInsight(true);
    const insight = await getWellnessInsights(profile, logs, exercises, steps);
    setAiInsight(insight);
    setIsLoadingInsight(false);
  };

  const calorieGoal = profile?.dailyCalorieGoal || 2150;
  const waterGoal = (profile?.dailyWaterGoal || 3000) / 1000;
  const stepGoal = profile?.dailyStepGoal || 10000;
  const mindGoal = 20; // 20 minutes

  const calorieProgress = Math.min(100, (calories / calorieGoal) * 100);
  const waterProgress = Math.min(100, (water / waterGoal) * 100);
  const stepProgress = Math.min(100, (steps / stepGoal) * 100);
  const mindProgress = Math.min(100, (mind / mindGoal) * 100);

  const healthScore = Math.round((calorieProgress + waterProgress + stepProgress + mindProgress) / 4) || 0;

  const calculateBMI = () => {
    if (!profile?.weight || !profile?.height) return null;
    const bmi = profile.weight / Math.pow(profile.height / 100, 2);
    let category = '';
    let color = '';
    if (bmi < 18.5) { category = 'Underweight'; color = 'text-blue-400'; }
    else if (bmi < 25) { category = 'Normal'; color = 'text-green-400'; }
    else if (bmi < 30) { category = 'Overweight'; color = 'text-yellow-400'; }
    else { category = 'Obese'; color = 'text-red-400'; }
    return { value: bmi.toFixed(1), category, color };
  };

  const bmiData = calculateBMI();
  const welcomeName = auth.currentUser?.displayName?.split(' ')[0]
    || auth.currentUser?.email?.split('@')[0]
    || 'Athlete';

  const handleLogSteps = async () => {
    if (!auth.currentUser || !stepInput) return;
    const stepsToAdd = parseInt(stepInput);
    if (isNaN(stepsToAdd)) return;

    try {
      await addDoc(collection(db, 'stepLogs'), {
        userId: auth.currentUser.uid,
        steps: stepsToAdd,
        source: 'manual',
        timestamp: new Date().toISOString()
      });
      setStepInput('');
      setIsLoggingSteps(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stepLogs');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="font-label text-outline text-[10px] uppercase tracking-[0.2em] font-bold">Athlete Dashboard</p>
          <h1 className="font-headline text-3xl font-black text-on-surface tracking-tighter">
            Welcome, <span className="text-primary italic">{welcomeName}</span>
          </h1>
        </div>
        <Link to="/setup" className="p-3 bg-surface-container-low rounded-2xl border border-surface-container hover:bg-surface transition-all">
          <Activity className="w-6 h-6 text-primary" />
        </Link>
      </div>

      {/* Health Score Ring */}
      <section className="relative flex flex-col items-center justify-center py-10">
        <div className="relative w-64 h-64">
          <svg className="w-full h-full -rotate-90">
            <circle cx="128" cy="128" r="110" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-surface-container-highest" />
            <motion.circle 
              cx="128" cy="128" r="110" fill="transparent" stroke="currentColor" strokeWidth="12" 
              strokeDasharray={2 * Math.PI * 110}
              initial={{ strokeDashoffset: 2 * Math.PI * 110 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 110 * (1 - healthScore / 100) }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="text-primary"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-headline text-7xl font-black text-on-surface tracking-tighter">{healthScore}</span>
            <div className="flex items-center gap-1 text-primary">
              <TrendingUp className="w-3 h-3" />
              <span className="font-label text-[10px] font-bold uppercase tracking-widest">Fuel Score</span>
            </div>
          </div>
        </div>
        
      {/* Quick Stats Overlay */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-12 w-full">
        <div className="text-center">
          <p className="font-headline text-2xl font-bold text-on-surface">{calories}</p>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest">Kcal</p>
        </div>
        <div className="text-center border-l border-surface-container">
          <p className="font-headline text-2xl font-bold text-on-surface">{water.toFixed(1)}L</p>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest">Hydration</p>
        </div>
        <div className="text-center md:border-l border-surface-container pt-4 md:pt-0 border-t md:border-t-0">
          <p className="font-headline text-2xl font-bold text-on-surface">{mind}m</p>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest">Mind</p>
        </div>
        <div className="text-center border-l border-surface-container pt-4 md:pt-0 border-t md:border-t-0">
          <p className="font-headline text-2xl font-bold text-on-surface">{steps.toLocaleString()}</p>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest">Steps</p>
        </div>
      </div>
      </section>

      {/* Step Tracking */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Footprints className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-black italic tracking-tight">Step Tracking</h3>
              <p className="font-body text-sm text-outline">Daily movement goal.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Goal</p>
            <p className="font-headline font-bold text-primary">{profile?.dailyStepGoal || 10000} steps</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-4 w-full bg-surface-container rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((steps / (profile?.dailyStepGoal || 10000)) * 100, 100)}%` }}
              className="h-full bg-primary rounded-full"
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="font-headline font-bold text-xl">{steps.toLocaleString()} <span className="text-sm font-normal text-outline">/ {(profile?.dailyStepGoal || 10000).toLocaleString()}</span></p>
            <button 
              onClick={() => setIsLoggingSteps(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-label text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all"
            >
              <Plus className="w-3 h-3" /> Adjust Steps
            </button>
          </div>
        </div>
      </section>

      {/* Step Logging Modal */}
      {isLoggingSteps && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-surface rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container space-y-6 shadow-2xl"
          >
            <div className="space-y-2">
              <h3 className="font-headline text-2xl font-black italic tracking-tight">Adjust Steps</h3>
              <p className="font-body text-sm text-outline">Auto tracking can handle live steps. Use this only to correct today&apos;s count.</p>
            </div>
            <input 
              type="number" 
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full p-6 rounded-3xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-xl font-bold"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setIsLoggingSteps(false)}
                className="flex-1 py-4 rounded-2xl font-headline font-bold text-outline hover:bg-surface-container transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogSteps}
                className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-headline font-bold shadow-lg shadow-primary/20"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Daily Fuel Strategy */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-black italic tracking-tight">Fuel Strategy</h3>
              <p className="font-body text-sm text-outline">Macro-nutrient distribution for today.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Goal</p>
            <p className="font-headline font-bold text-primary">{profile?.dailyCalorieGoal || 0} kcal</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {[
            { label: 'Protein', current: logs.reduce((acc, l) => acc + l.protein, 0), goal: profile?.dailyProteinGoal || 1, color: 'bg-blue-500', unit: 'g' },
            { label: 'Carbs', current: logs.reduce((acc, l) => acc + l.carbs, 0), goal: profile?.dailyCarbsGoal || 1, color: 'bg-yellow-500', unit: 'g' },
            { label: 'Fats', current: logs.reduce((acc, l) => acc + l.fats, 0), goal: profile?.dailyFatsGoal || 1, color: 'bg-red-500', unit: 'g' }
          ].map((macro) => (
            <div key={macro.label} className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="font-label text-[10px] uppercase font-bold tracking-widest text-outline">{macro.label}</span>
                <span className="font-headline font-bold text-sm">
                  {macro.current}<span className="text-outline font-normal text-[10px] ml-0.5">{macro.unit}</span>
                  <span className="mx-1 text-outline font-normal">/</span>
                  {macro.goal}<span className="text-outline font-normal text-[10px] ml-0.5">{macro.unit}</span>
                </span>
              </div>
              <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((macro.current / macro.goal) * 100, 100)}%` }}
                  className={`h-full rounded-full ${macro.color}`}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Insights Card */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-black italic tracking-tight">AI Insights</h3>
              <p className="font-body text-sm text-outline">Personalized coaching based on your data.</p>
            </div>
          </div>

          {aiInsight ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-surface rounded-3xl border border-primary/10 relative group"
            >
              <Sparkles className="absolute top-4 right-4 w-5 h-5 text-primary opacity-30" />
              <p className="font-body text-sm text-on-surface leading-relaxed italic">
                "{aiInsight}"
              </p>
              <button 
                onClick={fetchInsight}
                className="mt-4 text-[10px] font-label uppercase tracking-widest text-primary font-bold hover:underline"
              >
                Refresh Insight
              </button>
            </motion.div>
          ) : (
            <button 
              onClick={fetchInsight}
              disabled={isLoadingInsight}
              className="w-full py-5 bg-surface border-2 border-dashed border-primary/30 text-primary rounded-3xl font-headline font-bold flex items-center justify-center gap-3 hover:bg-primary/5 transition-all disabled:opacity-50"
            >
              {isLoadingInsight ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Daily Insight</span>
                </>
              )}
            </button>
          )}
        </div>
      </section>

      {/* Athlete Strategy Card */}
      {profile?.athleteType && (
        <section className="bg-primary text-on-primary rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl shadow-primary/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20 group-hover:scale-110 transition-transform duration-500">
            <Trophy className="w-48 h-48" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline text-2xl font-black italic tracking-tight uppercase">Athlete Strategy</h3>
                  <p className="font-body text-sm opacity-80">Optimized for {profile.athleteType} performance.</p>
                </div>
              </div>
              {bmiData && (
                <div className="text-right">
                  <p className="text-[10px] opacity-70 uppercase font-bold tracking-widest">BMI Status</p>
                  <p className="font-headline font-bold text-white">{bmiData.category}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white/10 rounded-3xl backdrop-blur-md border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  <span className="font-label text-[10px] uppercase font-bold tracking-widest">Primary Objective</span>
                </div>
                <p className="font-headline text-xl font-bold capitalize">{profile.goal?.replace('-', ' ') || 'Maintenance'}</p>
                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '65%' }}
                    className="h-full bg-white rounded-full"
                  />
                </div>
              </div>

              <div className="p-5 bg-white/10 rounded-3xl backdrop-blur-md border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span className="font-label text-[10px] uppercase font-bold tracking-widest">Muscle Recovery</span>
                </div>
                <div className="flex gap-1.5 h-10 items-end">
                  {Object.entries(profile.muscleRecovery || {}).map(([muscle, score]: [string, any], i) => (
                    <div 
                      key={muscle} 
                      className={`flex-1 rounded-t-lg transition-all duration-500 ${(score as number) > 80 ? 'bg-white' : (score as number) > 50 ? 'bg-white/60' : 'bg-white/30'}`}
                      style={{ height: `${Math.max(score as number, 10)}%` }}
                      title={`${muscle}: ${score}%`}
                    />
                  ))}
                </div>
                <p className="text-[10px] opacity-70 uppercase font-bold tracking-widest text-center">
                  Avg: {Math.round((Object.values(profile.muscleRecovery || {}) as number[]).reduce((a: number, b: number) => a + b, 0) / (Object.keys(profile.muscleRecovery || {}).length || 1))}%
                </p>
              </div>
            </div>

            <Link 
              to="/strategy" 
              className="flex items-center justify-center gap-2 w-full py-4 bg-white text-primary rounded-2xl font-headline font-bold text-sm shadow-lg hover:bg-opacity-90 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Help me find my optimal stuff
            </Link>
          </div>
        </section>
      )}

      {/* Performance Grid */}
      <section className="grid grid-cols-2 gap-3 md:gap-4">
        <Link to="/training" className="bg-surface-container-low p-5 md:p-6 rounded-3xl border border-surface-container hover:bg-surface transition-all group col-span-2">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <div className="text-right">
              <p className="font-headline text-2xl font-bold text-on-surface">{totalVolume.toLocaleString()} <span className="text-sm font-normal text-outline">kg</span></p>
              <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Today's Volume</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Training</p>
              <p className="font-headline text-xl font-bold text-on-surface">Log Workout</p>
            </div>
            <ChevronRight className="w-5 h-5 text-outline" />
          </div>
        </Link>

        <Link to="/food" className="bg-surface-container-low p-5 md:p-6 rounded-3xl border border-surface-container hover:bg-surface transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
              <Flame className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-outline" />
          </div>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Nutrition</p>
          <p className="font-headline text-xl font-bold text-on-surface">Log Fuel</p>
        </Link>

        <Link to="/wellness" className="bg-surface-container-low p-5 md:p-6 rounded-3xl border border-surface-container hover:bg-surface transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-secondary/10 rounded-2xl text-secondary group-hover:scale-110 transition-transform">
              <Droplets className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-outline" />
          </div>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Hydration</p>
          <p className="font-headline text-xl font-bold text-on-surface">Track Water</p>
        </Link>
        
        <Link to="/wellness" className="bg-surface-container-low p-5 md:p-6 rounded-3xl border border-surface-container hover:bg-surface transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500 group-hover:scale-110 transition-transform">
              <Pill className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-outline" />
          </div>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Recovery</p>
          <p className="font-headline text-xl font-bold text-on-surface">Supplements</p>
        </Link>

        <Link to="/wellness" className="bg-surface-container-low p-5 md:p-6 rounded-3xl border border-surface-container hover:bg-surface transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
              <Brain className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-outline" />
          </div>
          <p className="font-label text-[10px] uppercase text-outline tracking-widest font-bold">Mindset</p>
          <p className="font-headline text-xl font-bold text-on-surface">Meditation</p>
        </Link>
      </section>

      {/* Recent Fueling */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="font-headline text-2xl font-black tracking-tight">Recent Fueling</h2>
          <Link to="/food" className="text-primary font-label text-[10px] font-bold uppercase tracking-widest">View All</Link>
        </div>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="p-10 border-2 border-dashed border-surface-container rounded-3xl text-center">
              <p className="text-outline font-body text-sm">No fuel logged today.</p>
              <Link to="/food" className="mt-4 inline-flex items-center gap-2 text-primary font-headline font-bold">
                <Plus className="w-5 h-5" /> Start Logging
              </Link>
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-surface-container">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center overflow-hidden">
                    {log.imageUrl ? (
                      <img 
                        src={log.imageUrl} 
                        alt={log.name} 
                        className="w-full h-full object-cover rounded-xl" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Zap className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-headline font-bold text-on-surface truncate max-w-[150px]">{log.name}</p>
                    <p className="font-label text-[10px] text-outline uppercase tracking-wider">{log.mealType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline font-bold text-on-surface">{log.calories} kcal</p>
                  <p className="font-label text-[10px] text-outline uppercase tracking-wider">P: {log.protein}g</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
}
