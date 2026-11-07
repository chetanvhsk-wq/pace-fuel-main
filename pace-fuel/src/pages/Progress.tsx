import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Flame, Target, Zap, Activity, Brain, Loader2, Sparkles, Dumbbell, Utensils, Plus, History, Scale, X, ChevronRight, Footprints, Trophy } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, collection, query, where, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, WeightEntry, StepLogEntry, ExerciseEntry } from '../types';
import { getDetailedProgressAnalysis, getOptimalNutritionStrategy, getOptimalTrainingStrategy, OptimalNutrition, OptimalTraining } from '../services/aiService';
import { useNavigate } from 'react-router-dom';
import { sortEntriesByTimestamp } from '../lib/logUtils';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const macroData = [
  { name: 'Protein', value: 45, color: '#0d631b' },
  { name: 'Carbs', value: 30, color: '#964900' },
  { name: 'Fats', value: 25, color: '#707a6c' },
];

const BMI_MIN = 10;
const BMI_MAX = 40;
const BMI_RANGE = BMI_MAX - BMI_MIN;

const BMI_ZONES = [
  { label: 'Underweight', start: BMI_MIN, end: 18.5, fill: 'bg-blue-500/20', text: 'text-blue-600' },
  { label: 'Normal', start: 18.5, end: 25, fill: 'bg-green-500/20', text: 'text-green-600' },
  { label: 'Overweight', start: 25, end: 30, fill: 'bg-orange-500/20', text: 'text-orange-600' },
  { label: 'Obese', start: 30, end: BMI_MAX, fill: 'bg-red-500/20', text: 'text-red-600' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-2xl shadow-2xl border border-surface-container-highest backdrop-blur-md">
        <p className="font-headline font-bold text-primary mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs font-label">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-outline uppercase tracking-wider">{entry.name}:</span>
            <span className="font-bold text-on-surface">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Progress() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [optimalNutrition, setOptimalNutrition] = useState<OptimalNutrition | null>(null);
  const [optimalTraining, setOptimalTraining] = useState<OptimalTraining | null>(null);
  const [isCalculatingOptimal, setIsCalculatingOptimal] = useState(false);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [isLoggingWeight, setIsLoggingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [stepHistory, setStepHistory] = useState<StepLogEntry[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  const [isLoggingSteps, setIsLoggingSteps] = useState(false);
  const [newSteps, setNewSteps] = useState('');
  const [isSavingSteps, setIsSavingSteps] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));

    const q = query(
      collection(db, 'weight_logs'),
      where('userId', '==', user.uid)
    );

    const unsubWeight = onSnapshot(q, (snap) => {
      const logs = sortEntriesByTimestamp(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WeightEntry[],
        'asc'
      );
      setWeightHistory(logs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'weight_logs'));

    const stepsQ = query(
      collection(db, 'stepLogs'),
      where('userId', '==', user.uid)
    );

    const unsubSteps = onSnapshot(stepsQ, (snap) => {
      const logs = sortEntriesByTimestamp(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StepLogEntry[],
        'asc'
      );
      setStepHistory(logs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'stepLogs'));

    const exQ = query(
      collection(db, 'exercises'),
      where('userId', '==', user.uid)
    );

    const unsubEx = onSnapshot(exQ, (snap) => {
      const logs = sortEntriesByTimestamp(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ExerciseEntry[]
      );
      setExerciseHistory(logs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'exercises'));

    return () => {
      unsubProfile();
      unsubWeight();
      unsubSteps();
      unsubEx();
    };
  }, []);

  const handleLogWeight = async () => {
    const user = auth.currentUser;
    if (!user || !newWeight) return;
    setIsSavingWeight(true);
    try {
      const weightNum = parseFloat(newWeight);
      await addDoc(collection(db, 'weight_logs'), {
        userId: user.uid,
        weight: weightNum,
        timestamp: new Date().toISOString()
      });
      // Also update profile weight
      await updateDoc(doc(db, 'users', user.uid), {
        weight: weightNum
      });
      setIsLoggingWeight(false);
      setNewWeight('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'weight_logs');
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleLogSteps = async () => {
    const user = auth.currentUser;
    if (!user || !newSteps) return;
    setIsSavingSteps(true);
    try {
      const stepsNum = parseInt(newSteps);
      await addDoc(collection(db, 'stepLogs'), {
        userId: user.uid,
        steps: stepsNum,
        source: 'manual',
        timestamp: new Date().toISOString()
      });
      setIsLoggingSteps(false);
      setNewSteps('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stepLogs');
    } finally {
      setIsSavingSteps(false);
    }
  };

  const fetchAnalysis = async () => {
    if (!profile) return;
    setIsLoading(true);
    // Mocking some health data for analysis if real data is sparse
    const analysis = await getDetailedProgressAnalysis(profile, weightHistory.slice(-7));
    setAiAnalysis(analysis);
    setIsLoading(false);
  };

  const fetchOptimalStrategy = async () => {
    if (!profile) return;
    setIsCalculatingOptimal(true);
    try {
      const [nutrition, training] = await Promise.all([
        getOptimalNutritionStrategy(profile),
        getOptimalTrainingStrategy(profile)
      ]);
      setOptimalNutrition(nutrition);
      setOptimalTraining(training);
    } catch (error) {
      console.error("Error fetching optimal strategy:", error);
    } finally {
      setIsCalculatingOptimal(false);
    }
  };

  const bmiData = profile?.weight && profile?.height ? (() => {
    const numericValue = profile.weight / Math.pow(profile.height / 100, 2);
    const status = (() => {
      if (numericValue < 18.5) {
        return {
          name: 'Underweight',
          textClass: 'text-blue-600',
          borderClass: 'border-blue-200',
          iconSurfaceClass: 'bg-blue-50',
          indicatorColor: '#2563eb',
          advice: 'Focus on nutrient-dense foods and progressive strength training to build healthy mass.',
        };
      }

      if (numericValue < 25) {
        return {
          name: 'Normal',
          textClass: 'text-green-600',
          borderClass: 'border-green-200',
          iconSurfaceClass: 'bg-green-50',
          indicatorColor: '#16a34a',
          advice: 'You are in the ideal range. Maintain your routine and keep prioritizing recovery, sleep, and consistent training quality.',
        };
      }

      if (numericValue < 30) {
        return {
          name: 'Overweight',
          textClass: 'text-orange-600',
          borderClass: 'border-orange-200',
          iconSurfaceClass: 'bg-orange-50',
          indicatorColor: '#f97316',
          advice: 'A slight calorie deficit and steady cardio volume can help you move back toward the ideal range without sacrificing performance.',
        };
      }

      return {
        name: 'Obese',
        textClass: 'text-red-600',
        borderClass: 'border-red-200',
        iconSurfaceClass: 'bg-red-50',
        indicatorColor: '#dc2626',
        advice: 'Prioritize a structured, sustainable fat-loss plan and pair it with low-impact movement and professional guidance when possible.',
      };
    })();

    return {
      value: numericValue.toFixed(1),
      numericValue,
      status,
      idealRange: {
        min: (18.5 * Math.pow(profile.height / 100, 2)).toFixed(1),
        max: (25 * Math.pow(profile.height / 100, 2)).toFixed(1),
      },
    };
  })() : null;

  const bmiStatus = bmiData?.status ?? null;
  const bmiMarkerLeft = bmiData
    ? `${Math.min(Math.max(((bmiData.numericValue - BMI_MIN) / BMI_RANGE) * 100, 0), 100)}%`
    : '0%';

  const chartData = weightHistory.map(log => ({
    date: new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: log.weight
  }));

  const stepChartData = stepHistory.reduce((acc: any[], log) => {
    const date = new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.steps += log.steps;
    } else {
      acc.push({ date, steps: log.steps });
    }
    return acc;
  }, []).slice(-7);

  const muscleDistribution = exerciseHistory.reduce((acc: any, ex) => {
    const muscle = ex.muscleGroup || 'Other';
    acc[muscle] = (acc[muscle] || 0) + 1;
    return acc;
  }, {});

  const muscleChartData = Object.entries(muscleDistribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  })).sort((a: any, b: any) => b.value - a.value).slice(0, 5);

  const personalBests = exerciseHistory.reduce((acc: Record<string, number>, curr: any) => {
    const weight = Number(curr.weight) || 0;
    if (!acc[curr.name] || weight > acc[curr.name]) {
      acc[curr.name] = weight;
    }
    return acc;
  }, {});

  const pbList = Object.entries(personalBests)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 4);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weeklyWorkouts = exerciseHistory.filter((ex: any) => new Date(ex.timestamp) > weekAgo);

  const weeklyStats = {
    totalWorkouts: weeklyWorkouts.length,
    totalVolume: weeklyWorkouts.reduce((acc, curr: any) => acc + (curr.volume || 0), 0),
    avgIntensity: 'Moderate'
  };

  const COLORS = ['#0d631b', '#964900', '#707a6c', '#2e4a31', '#4a4a4a'];

  const displayMacroData = profile ? [
    { name: 'Protein', value: Math.round((((profile.dailyProteinGoal || 0) * 4) / (profile.dailyCalorieGoal || 1)) * 100) || 0, color: '#0d631b' },
    { name: 'Carbs', value: Math.round((((profile.dailyCarbsGoal || 0) * 4) / (profile.dailyCalorieGoal || 1)) * 100) || 0, color: '#964900' },
    { name: 'Fats', value: Math.round((((profile.dailyFatsGoal || 0) * 9) / (profile.dailyCalorieGoal || 1)) * 100) || 0, color: '#707a6c' },
  ] : macroData;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      <section className="flex justify-between items-end">
        <div className="space-y-2">
          <span className="font-label text-secondary text-[10px] uppercase tracking-[0.2em] font-bold">Performance Analytics</span>
          <h2 className="font-headline text-4xl font-black text-on-surface tracking-tighter italic">Athlete <span className="text-primary">Progress.</span></h2>
        </div>
        <button 
          onClick={() => setIsLoggingWeight(true)}
          className="p-4 bg-primary text-on-primary rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </section>

      {/* Weekly Achievements */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-surface-container-low p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-surface-container space-y-4">
          <div className="p-3 bg-primary/10 rounded-2xl w-fit text-primary">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Weekly Workouts</p>
            <h3 className="font-headline text-3xl font-black">{weeklyStats.totalWorkouts}</h3>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-surface-container space-y-4">
          <div className="p-3 bg-secondary/10 rounded-2xl w-fit text-secondary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Weekly Volume</p>
            <h3 className="font-headline text-3xl font-black">{weeklyStats.totalVolume.toLocaleString()} <span className="text-sm font-normal">kg</span></h3>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-surface-container space-y-4">
          <div className="p-3 bg-purple-500/10 rounded-2xl w-fit text-purple-500">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Avg Intensity</p>
            <h3 className="font-headline text-3xl font-black">{weeklyStats.avgIntensity}</h3>
          </div>
        </div>
      </section>

      {/* Personal Bests */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-black italic tracking-tight">Personal Bests</h3>
              <p className="font-body text-sm text-outline">Your all-time heaviest lifts.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pbList.length > 0 ? pbList.map(([name, weight], i) => (
              <div key={i} className="p-6 bg-surface rounded-3xl border border-surface-container text-center space-y-2 group hover:border-primary/30 transition-all">
                <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold truncate">{name}</p>
                <p className="font-headline text-3xl font-black text-primary">{weight}<span className="text-sm font-normal ml-1">kg</span></p>
                <div className="flex justify-center">
                  <Sparkles className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )) : (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-surface-container rounded-3xl">
                <p className="text-outline font-body text-sm italic">Log more workouts to see your PBs!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Step History Chart */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container shadow-sm space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Footprints className="w-5 h-5" />
              <h3 className="font-headline text-xl font-bold">Step History</h3>
            </div>
            <p className="font-body text-sm text-outline">Your daily movement trends.</p>
          </div>
          <button 
            onClick={() => setIsLoggingSteps(true)}
            className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-label text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all"
          >
            Log Steps
          </button>
        </div>

        <div className="h-64 w-full">
          {stepChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stepChartData}>
                <defs>
                  <linearGradient id="colorSteps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d631b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0d631b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3ebdc" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#707a6c', fontFamily: 'Lexend', fontWeight: 600 }} 
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="steps" 
                  stroke="#0d631b" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSteps)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-outline border-2 border-dashed border-surface-container rounded-3xl">
              <Footprints className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm font-body italic">Walk with auto tracking on, or add a manual correction, to see the trend.</p>
            </div>
          )}
        </div>
      </section>

      {/* Weight History Chart */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container shadow-sm space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <History className="w-5 h-5" />
              <h3 className="font-headline text-xl font-bold">Weight History</h3>
            </div>
            <p className="font-body text-sm text-outline">Tracking your body composition over time.</p>
          </div>
          {profile?.weight && (
            <div className="text-right">
              <p className="font-label text-[10px] uppercase text-outline">Current</p>
              <p className="font-headline text-2xl font-black italic text-primary">{profile.weight}kg</p>
            </div>
          )}
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d631b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0d631b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3ebdc" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#707a6c', fontFamily: 'Lexend', fontWeight: 600 }} 
                  dy={10}
                />
                <YAxis 
                  hide 
                  domain={['dataMin - 2', 'dataMax + 2']} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#0d631b" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorWeight)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-outline border-2 border-dashed border-surface-container rounded-3xl">
              <Scale className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm font-body italic">Log your first weight to see the trend.</p>
            </div>
          )}
        </div>
      </section>

      {/* AI Optimal Strategy Section */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container shadow-sm space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-32 h-32 text-primary" />
        </div>
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-headline text-xl font-bold">Optimal Strategy Finder</h3>
          </div>
          <p className="font-body text-sm text-outline">Not sure what to aim for? Let AI determine your peak performance strategy.</p>
        </div>

        {!optimalNutrition && !optimalTraining ? (
          <button 
            onClick={fetchOptimalStrategy}
            disabled={isCalculatingOptimal}
            className="w-full py-6 bg-primary text-on-primary rounded-3xl font-headline font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            {isCalculatingOptimal ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Analyzing Profile...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                <span>Find My Optimal Stuff</span>
              </>
            )}
          </button>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 bg-surface rounded-3xl border border-surface-container space-y-4"
            >
              <div className="flex items-center gap-2 text-primary">
                <Utensils className="w-4 h-4" />
                <h4 className="font-headline font-bold">Optimal Nutrition</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-label text-outline">Calories</p>
                  <p className="font-headline font-bold text-xl">{optimalNutrition?.calories} kcal</p>
                </div>
                <div className="bg-surface-container-low p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-label text-outline">Protein</p>
                  <p className="font-headline font-bold text-xl">{optimalNutrition?.protein}g</p>
                </div>
                <div className="bg-surface-container-low p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-label text-outline">Carbs</p>
                  <p className="font-headline font-bold text-xl">{optimalNutrition?.carbs}g</p>
                </div>
                <div className="bg-surface-container-low p-3 rounded-2xl">
                  <p className="text-[10px] uppercase font-label text-outline">Fats</p>
                  <p className="font-headline font-bold text-xl">{optimalNutrition?.fats}g</p>
                </div>
              </div>
              <p className="text-xs text-outline font-body italic leading-relaxed">
                "{optimalNutrition?.reasoning}"
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 bg-surface rounded-3xl border border-surface-container space-y-4"
            >
              <div className="flex items-center gap-2 text-secondary">
                <Dumbbell className="w-4 h-4" />
                <h4 className="font-headline font-bold">Optimal Training</h4>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl space-y-3 min-h-[100px]">
                <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">
                  {optimalTraining?.frequency} days / week
                </p>
                <p className="font-body text-sm text-on-surface leading-relaxed italic">
                  "{optimalTraining?.reasoning}"
                </p>
                {optimalTraining?.focusAreas?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {optimalTraining.focusAreas.slice(0, 4).map((area) => (
                      <span
                        key={area}
                        className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-label uppercase tracking-widest font-bold"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="pt-2">
                <button 
                  onClick={() => navigate('/training')}
                  className="w-full py-3 border-2 border-secondary/20 text-secondary rounded-2xl font-label text-[10px] uppercase tracking-widest font-bold hover:bg-secondary/5 transition-colors"
                >
                  Go to Training
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </section>

      {/* Weight & BMI Analysis Section */}
      {profile && bmiData && (
        <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container shadow-sm space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="font-headline text-xl font-bold">Weight Analysis</h3>
              <p className="font-body text-sm text-outline">Your current weight vs. the medically ideal range for your height ({profile.height}cm).</p>
            </div>
            <div className="bg-primary/10 px-4 py-2 rounded-2xl">
              <span className="font-label text-[10px] uppercase font-bold text-primary tracking-widest">Current: {profile.weight}kg</span>
            </div>
          </div>

          {/* Ideal Range Graph (Horizontal Bar) */}
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-surface-container bg-surface p-4">
              <div className="relative px-1 pt-12">
                <div className="flex h-5 overflow-hidden rounded-full bg-surface-container-highest">
                  {BMI_ZONES.map((zone, index) => (
                    <div
                      key={zone.label}
                      className={`${zone.fill} ${index < BMI_ZONES.length - 1 ? 'border-r border-white/30' : ''}`}
                      style={{ width: `${((zone.end - zone.start) / BMI_RANGE) * 100}%` }}
                    />
                  ))}
                </div>

                <motion.div
                  initial={{ left: '0%' }}
                  animate={{ left: bmiMarkerLeft }}
                  transition={{ duration: 1.1, type: 'spring', stiffness: 130, damping: 16 }}
                  className="absolute top-0 z-10 -translate-x-1/2"
                >
                  <div
                    className="rounded-2xl px-3 py-2 text-xs font-bold text-white shadow-xl"
                    style={{ backgroundColor: bmiStatus?.indicatorColor }}
                  >
                    BMI {bmiData.value}
                  </div>
                  <div className="mx-auto h-9 w-1 rounded-full bg-on-surface" />
                  <div
                    className="mx-auto h-3 w-3 rotate-45 rounded-[2px]"
                    style={{ backgroundColor: bmiStatus?.indicatorColor }}
                  />
                </motion.div>
              </div>

              <div className="mt-6 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-outline">
                <span>10</span>
                <span>18.5</span>
                <span>25</span>
                <span>30</span>
                <span>40</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BMI_ZONES.map((zone) => (
                  <div key={zone.label} className="rounded-2xl bg-surface-container-highest px-3 py-2">
                    <p className={`font-label text-[10px] uppercase tracking-widest ${zone.text}`}>{zone.label}</p>
                    <p className="text-xs text-outline">
                      {zone.start}
                      {zone.label === 'Obese' ? '+' : ` - ${zone.end}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between font-label text-[10px] text-outline uppercase font-bold px-1">
              <span>Current: {profile.weight}kg</span>
              <span>Ideal: {bmiData.idealRange.min}kg - {bmiData.idealRange.max}kg</span>
            </div>
          </div>

          {/* Advice Card */}
          <div className={`p-6 rounded-3xl border-2 ${bmiStatus?.borderClass} bg-surface flex items-start gap-4`}>
            <div className={`p-3 rounded-2xl ${bmiStatus?.iconSurfaceClass} ${bmiStatus?.textClass}`}>
              <Brain className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className={`font-headline font-bold ${bmiStatus?.textClass}`}>Recommendation: {bmiStatus?.name}</h4>
              <p className="font-body text-sm text-on-surface leading-relaxed italic">
                "{bmiStatus?.advice}"
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Personal Records Section */}
      {profile?.personalRecords && Object.keys(profile.personalRecords).length > 0 && (
        <section className="bg-surface-container-low rounded-[2.5rem] p-8 border border-surface-container shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="w-5 h-5" />
            <h3 className="font-headline text-xl font-bold">Personal Records</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(profile.personalRecords).map(([exercise, weight]) => (
              <div key={exercise} className="p-4 bg-surface rounded-2xl border border-surface-container flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-label text-outline">{exercise}</p>
                  <p className="font-headline font-bold text-xl">{weight}kg</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Macro Distribution with Pie Chart */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container flex flex-col sm:flex-row items-center gap-8">
          <div className="w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayMacroData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {displayMacroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 flex-1 min-w-0 w-full">
            <h3 className="font-headline text-xl font-bold">Macro Split</h3>
            <div className="space-y-3">
              {displayMacroData.map((macro) => (
                <div key={macro.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: macro.color }} />
                    <span className="font-label text-xs font-bold text-outline uppercase tracking-wider truncate">{macro.name}</span>
                  </div>
                  <span className="font-headline font-bold text-on-surface flex-shrink-0">{macro.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container flex flex-col sm:flex-row items-center gap-8">
          <div className="w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={muscleChartData.length > 0 ? muscleChartData : [{ name: 'No Data', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {muscleChartData.length > 0 ? muscleChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  )) : <Cell fill="#e3ebdc" />}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 flex-1 min-w-0 w-full">
            <h3 className="font-headline text-xl font-bold">Training Focus</h3>
            <div className="space-y-3">
              {muscleChartData.length > 0 ? muscleChartData.map((muscle, index) => (
                <div key={muscle.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="font-label text-xs font-bold text-outline uppercase tracking-wider truncate">{muscle.name}</span>
                  </div>
                  <span className="font-headline font-bold text-on-surface flex-shrink-0">{muscle.value} logs</span>
                </div>
              )) : (
                <p className="text-xs text-outline italic">No training data yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container flex flex-col justify-center space-y-4">
        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <p className="font-label text-[10px] uppercase tracking-widest text-primary font-bold">AI Recommendation</p>
          </div>
          {aiAnalysis ? (
            <p className="font-body text-sm text-on-surface leading-relaxed italic">
              "{aiAnalysis}"
            </p>
          ) : (
            <button 
              onClick={fetchAnalysis}
              disabled={isLoading}
              className="w-full py-3 text-primary font-label text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Analysis"}
            </button>
          )}
        </div>
        <button className="w-full py-4 bg-on-surface text-surface rounded-2xl font-label text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity">
          Download Full Report
        </button>
      </section>

      {/* Log Weight Modal */}
      <AnimatePresence>
        {isLoggingWeight && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoggingWeight(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-2xl font-black italic tracking-tight text-primary">Log Weight</h3>
                <button 
                  onClick={() => setIsLoggingWeight(false)}
                  className="p-2 bg-surface-container rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-surface-container-low rounded-3xl border border-surface-container">
                  <label className="block font-label text-[10px] uppercase text-outline mb-2">Weight (kg)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    autoFocus
                    className="w-full bg-transparent font-headline text-4xl font-black text-primary focus:outline-none"
                    placeholder="00.0"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                  />
                </div>

                <button 
                  onClick={handleLogWeight}
                  disabled={isSavingWeight || !newWeight}
                  className="w-full py-4 bg-primary text-on-primary rounded-2xl font-headline font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingWeight ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scale className="w-5 h-5" />}
                  Save Progress
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Steps Modal */}
      <AnimatePresence>
        {isLoggingSteps && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoggingSteps(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-2xl font-black italic tracking-tight text-primary">Adjust Steps</h3>
                <button 
                  onClick={() => setIsLoggingSteps(false)}
                  className="p-2 bg-surface-container rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-surface-container-low rounded-3xl border border-surface-container">
                  <label className="block font-label text-[10px] uppercase text-outline mb-2">Manual Correction</label>
                  <input 
                    type="number" 
                    autoFocus
                    className="w-full bg-transparent font-headline text-4xl font-black text-primary focus:outline-none"
                    placeholder="0000"
                    value={newSteps}
                    onChange={(e) => setNewSteps(e.target.value)}
                  />
                </div>

                <button 
                  onClick={handleLogSteps}
                  disabled={isSavingSteps || !newSteps}
                  className="w-full py-4 bg-primary text-on-primary rounded-2xl font-headline font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingSteps ? <Loader2 className="w-5 h-5 animate-spin" /> : <Footprints className="w-5 h-5" />}
                  Save Progress
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
