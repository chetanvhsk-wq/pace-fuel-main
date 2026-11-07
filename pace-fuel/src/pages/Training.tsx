import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dumbbell, Timer, Flame, PlusCircle, Loader2, Brain, Zap, CheckCircle2, History, Info, Activity } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, ExerciseEntry } from '../types';
import { generateExercisePlan, ExercisePlan } from '../services/aiService';
import MuscleMap from '../components/MuscleMap';
import { cn } from '../lib/utils';
import { filterEntriesForToday, sortEntriesByTimestamp } from '../lib/logUtils';

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

export default function Training() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [newExercise, setNewExercise] = useState({ 
    name: '', 
    duration: 30, 
    intensity: 'moderate' as const,
    sets: 3,
    reps: 12,
    weight: 0,
    muscleGroup: ''
  });

  const commonExercises = [
    { name: 'Bench Press', muscle: 'chest' },
    { name: 'Squat', muscle: 'quads' },
    { name: 'Deadlift', muscle: 'lower-back' },
    { name: 'Overhead Press', muscle: 'shoulders' },
    { name: 'Barbell Row', muscle: 'upper-back' },
    { name: 'Pull Ups', muscle: 'upper-back' },
    { name: 'Push Ups', muscle: 'chest' },
    { name: 'Bicep Curls', muscle: 'biceps' },
    { name: 'Tricep Extensions', muscle: 'triceps' },
    { name: 'Plank', muscle: 'abs' },
    { name: 'Lunges', muscle: 'glutes' },
    { name: 'Leg Press', muscle: 'quads' },
  ];

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);
  const [exercisePlan, setExercisePlan] = useState<ExercisePlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string | undefined>();
  const [isLoggingWorkout, setIsLoggingWorkout] = useState(false);
  const [history, setHistory] = useState<ExerciseEntry[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));

    const eq = query(
      collection(db, 'exercises'),
      where('userId', '==', user.uid)
    );

    const unsubEx = onSnapshot(eq, (snapshot) => {
      const data = sortEntriesByTimestamp(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseEntry))
      );
      setHistory(data);
      setExercises(filterEntriesForToday(data));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'exercises'));

    return () => {
      unsubProfile();
      unsubEx();
    };
  }, []);

  const logExercise = async (
    name?: string, 
    duration?: number, 
    intensity?: string,
    sets?: number,
    reps?: number,
    weight?: number,
    muscleGroup?: string
  ) => {
    const user = auth.currentUser;
    if (!user || !profile) return;

    const exName = name || newExercise.name;
    const exDuration = duration || newExercise.duration;
    const exIntensity = (intensity || newExercise.intensity) as 'low' | 'moderate' | 'high';
    const exSets = sets !== undefined ? sets : newExercise.sets;
    const exReps = reps !== undefined ? reps : newExercise.reps;
    const exWeight = weight !== undefined ? weight : newExercise.weight;
    const exMuscleGroup = muscleGroup || selectedMuscle || newExercise.muscleGroup || 'Full Body';

    const exerciseKey = exName.toLowerCase();
    const met = Object.keys(MET_VALUES).find(k => exerciseKey.includes(k)) 
      ? MET_VALUES[Object.keys(MET_VALUES).find(k => exerciseKey.includes(k))!] 
      : MET_VALUES.default;
    
    const intensityMultiplier = exIntensity === 'high' ? 1.3 : exIntensity === 'low' ? 0.7 : 1.0;
    const userWeight = profile.weight || 70;
    const caloriesBurned = Math.round((met * userWeight * (exDuration / 60)) * intensityMultiplier);
    const volume = exSets * exReps * exWeight;

    try {
      await addDoc(collection(db, 'exercises'), {
        userId: user.uid,
        name: exName,
        duration: exDuration,
        intensity: exIntensity,
        sets: exSets,
        reps: exReps,
        weight: exWeight,
        volume: volume,
        muscleGroup: exMuscleGroup,
        caloriesBurned,
        timestamp: new Date().toISOString()
      });

      // Update muscle recovery if it was a targeted workout
      const target = muscleGroup || selectedMuscle;
      if (target && profile.muscleRecovery) {
        const currentRecovery = profile.muscleRecovery[target] || 100;
        const newRecovery = Math.max(0, currentRecovery - 25);
        await updateDoc(doc(db, 'users', user.uid), {
          [`muscleRecovery.${target}`]: newRecovery
        });
      }

      setShowExerciseForm(false);
      setNewExercise({ 
        name: '', 
        duration: 30, 
        intensity: 'moderate',
        sets: 3,
        reps: 12,
        weight: 0,
        muscleGroup: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'exercises');
    }
  };

  const getAIPlan = async () => {
    if (!profile) return;
    setIsGeneratingPlan(true);
    const plan = await generateExercisePlan(profile, selectedMuscle);
    setExercisePlan(plan);
    setIsGeneratingPlan(false);
  };

  const logEntireWorkout = async () => {
    if (!exercisePlan) return;
    setIsLoggingWorkout(true);
    for (const ex of exercisePlan.exercises) {
      await logExercise(
        ex.name, 
        parseInt(ex.duration) || 30, 
        ex.intensity.toLowerCase(),
        ex.sets,
        ex.reps,
        ex.weightSuggestion?.includes('kg') ? parseInt(ex.weightSuggestion) : 0,
        ex.targetMuscles[0]
      );
    }
    setIsLoggingWorkout(false);
    setExercisePlan(null);
  };

  const calculateTotalVolume = () => {
    return exercises.reduce((acc, curr) => acc + (curr.volume || 0), 0);
  };

  const caloriesBurnedTotal = exercises.reduce((acc, ex) => acc + ex.caloriesBurned, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8 pb-20"
    >
      {/* Hero: Training Summary */}
      <section className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-gradient-to-br from-secondary to-secondary-container p-6 md:p-8 text-on-secondary shadow-2xl">
        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="font-label text-[10px] uppercase tracking-[0.3em] opacity-80 mb-2 font-bold">Today's Burn</span>
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter mb-6">
            {caloriesBurnedTotal.toLocaleString()}
          </h1>
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
            <Flame className="w-4 h-4" />
            <span className="font-label text-xs uppercase tracking-widest font-bold">Calories Expended</span>
          </div>
        </div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-secondary-container/30 rounded-full blur-3xl"></div>
      </section>

      {/* Rest Timer */}
      <section className="bg-surface-container-low rounded-3xl p-6 border border-surface-container flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-headline font-bold text-lg italic">Rest Timer</h3>
            <p className="font-body text-[10px] text-outline uppercase tracking-widest font-bold">
              {timer > 0 ? `${Math.floor(timer / 60)}:${(timer % 60).toString().padStart(2, '0')}` : 'Ready'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[30, 60, 90].map(s => (
            <button 
              key={s}
              onClick={() => { setTimer(s); setIsTimerRunning(true); }}
              className="px-3 py-2 bg-surface border border-surface-container rounded-xl font-label text-[10px] font-bold hover:border-primary transition-all"
            >
              {s}s
            </button>
          ))}
          <button 
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className={cn(
              "p-3 rounded-xl transition-all",
              isTimerRunning ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
            )}
          >
            {isTimerRunning ? <Zap className="w-5 h-5 fill-current" /> : <PlusCircle className="w-5 h-5" />}
          </button>
        </div>
      </section>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container shadow-sm">
          <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Today's Volume</p>
          <div className="flex items-baseline gap-1">
            <span className="font-headline text-3xl font-black">{calculateTotalVolume().toLocaleString()}</span>
            <span className="text-xs text-outline font-bold uppercase">kg</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container shadow-sm">
          <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold mb-1">Calories Burned</p>
          <div className="flex items-baseline gap-1">
            <span className="font-headline text-3xl font-black">{caloriesBurnedTotal.toLocaleString()}</span>
            <span className="text-xs text-outline font-bold uppercase">kcal</span>
          </div>
        </div>
      </div>

      {/* Muscle Recovery & Targeting */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-2xl font-extrabold tracking-tight">Muscle Status</h2>
            <p className="text-sm text-outline font-body">Select a muscle to target your workout</p>
          </div>
          <div className="flex items-center gap-2 text-primary">
            <Activity className="w-5 h-5" />
            <span className="font-label text-[10px] uppercase font-bold tracking-widest">Live Recovery</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MuscleMap 
            recovery={profile?.muscleRecovery || {}} 
            onMuscleClick={(m) => setSelectedMuscle(m === selectedMuscle ? undefined : m)}
            selectedMuscle={selectedMuscle}
          />
          
          <div className="bg-surface-container-low rounded-3xl p-6 border border-surface-container space-y-4">
            <h3 className="font-headline font-bold text-lg italic">Recovery Breakdown</h3>
            <div className="space-y-3">
              {(Object.entries(profile?.muscleRecovery || {}) as [string, number][]).map(([muscle, score]) => (
                <div key={muscle} className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                    <span className="text-outline">{muscle}</span>
                    <span className={score > 80 ? 'text-green-500' : score > 50 ? 'text-yellow-500' : 'text-red-500'}>
                      {score}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      className={`h-full rounded-full ${score > 80 ? 'bg-green-500' : score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-surface-container flex items-start gap-3">
              <Info className="w-4 h-4 text-outline mt-0.5" />
              <p className="text-[10px] text-outline leading-relaxed">
                Muscles with lower recovery scores indicate higher fatigue. Target recovered muscles for optimal performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Plan Generator */}
      <section className="bg-surface-container-low rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-surface-container relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-black italic tracking-tight">
                {selectedMuscle ? `${selectedMuscle.charAt(0).toUpperCase() + selectedMuscle.slice(1)} Focus` : 'AI Training Plan'}
              </h3>
              <p className="font-body text-sm text-outline">
                {selectedMuscle 
                  ? `Targeted routine for your ${selectedMuscle}.` 
                  : `Personalized for your ${profile?.athleteType} profile.`}
              </p>
            </div>
          </div>

          {!exercisePlan ? (
            <button 
              onClick={getAIPlan}
              disabled={isGeneratingPlan}
              className="w-full py-5 bg-primary text-on-primary rounded-2xl font-headline font-bold flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isGeneratingPlan ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>{selectedMuscle ? `Generate ${selectedMuscle} Workout` : 'Generate Daily Plan'}</span>
                  <Zap className="w-5 h-5" />
                </>
              )}
            </button>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="font-body text-sm text-on-surface leading-relaxed italic">
                  "{exercisePlan.summary}"
                </p>
              </div>
              <div className="space-y-4">
                {exercisePlan.exercises.map((ex, i) => (
                  <div key={i} className="p-5 bg-surface rounded-2xl border border-surface-container space-y-4 group hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                          <Dumbbell className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-headline font-bold text-on-surface">{ex.name}</h4>
                          <p className="text-[10px] text-outline uppercase font-label tracking-widest">
                            {ex.sets} Sets • {ex.reps} Reps • {ex.weightSuggestion}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => logExercise(
                          ex.name, 
                          parseInt(ex.duration) || 30, 
                          ex.intensity.toLowerCase(),
                          ex.sets,
                          ex.reps,
                          ex.weightSuggestion?.includes('kg') ? parseInt(ex.weightSuggestion) : 0,
                          ex.targetMuscles[0]
                        )}
                        className="p-2 bg-primary/10 text-primary rounded-full opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-outline leading-relaxed">{ex.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {ex.targetMuscles.map((muscle, j) => (
                          <span key={j} className="px-2 py-1 bg-secondary/10 text-secondary text-[8px] font-label uppercase tracking-widest rounded-full font-bold">
                            {muscle}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setExercisePlan(null)}
                  className="flex-1 py-4 bg-surface-container rounded-2xl font-headline font-bold text-outline hover:text-primary transition-all"
                >
                  Reset Plan
                </button>
                <button 
                  onClick={logEntireWorkout}
                  disabled={isLoggingWorkout}
                  className="flex-[2] py-4 bg-primary text-on-primary rounded-2xl font-headline font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                >
                  {isLoggingWorkout ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Log Entire Workout <CheckCircle2 className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Manual Exercise Log */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight">Fitness Activity</h2>
          <button 
            onClick={() => setShowExerciseForm(!showExerciseForm)}
            className="text-primary font-label text-sm font-semibold flex items-center gap-1"
          >
            <PlusCircle className="w-4 h-4" /> Log Exercise
          </button>
        </div>

        <AnimatePresence>
          {showExerciseForm && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-surface-container-low p-6 rounded-3xl border border-primary/10 space-y-4 overflow-hidden shadow-lg"
            >
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Common Exercises</label>
                <div className="flex flex-wrap gap-2">
                  {commonExercises.map(ex => (
                    <button 
                      key={ex.name}
                      onClick={() => setNewExercise({...newExercise, name: ex.name, muscleGroup: ex.muscle})}
                      className={cn(
                        "px-3 py-2 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest transition-all border-2",
                        newExercise.name === ex.name 
                          ? "bg-primary text-on-primary border-primary" 
                          : "bg-surface border-surface-container text-outline hover:border-primary/20"
                      )}
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Exercise Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Bench Press, Squat, Deadlift"
                  className="w-full p-4 bg-surface rounded-xl border-none focus:ring-2 focus:ring-primary shadow-sm"
                  value={newExercise.name}
                  onChange={(e) => setNewExercise({...newExercise, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Sets</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-surface rounded-xl border-none focus:ring-2 focus:ring-primary shadow-sm text-center"
                    value={newExercise.sets}
                    onChange={(e) => setNewExercise({...newExercise, sets: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Reps</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-surface rounded-xl border-none focus:ring-2 focus:ring-primary shadow-sm text-center"
                    value={newExercise.reps}
                    onChange={(e) => setNewExercise({...newExercise, reps: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Weight (kg)</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-surface rounded-xl border-none focus:ring-2 focus:ring-primary shadow-sm text-center"
                    value={newExercise.weight}
                    onChange={(e) => setNewExercise({...newExercise, weight: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Duration (min)</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-surface rounded-xl border-none focus:ring-2 focus:ring-primary shadow-sm"
                    value={newExercise.duration}
                    onChange={(e) => setNewExercise({...newExercise, duration: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Intensity</label>
                  <select 
                    className="w-full p-4 bg-surface rounded-xl border-none focus:ring-2 focus:ring-primary shadow-sm"
                    value={newExercise.intensity}
                    onChange={(e) => setNewExercise({...newExercise, intensity: e.target.value as any})}
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Target Muscle Group</label>
                <select 
                  className="w-full p-4 bg-surface rounded-xl border-none focus:ring-2 focus:ring-primary shadow-sm"
                  value={newExercise.muscleGroup}
                  onChange={(e) => setNewExercise({...newExercise, muscleGroup: e.target.value})}
                >
                  <option value="">Select Muscle Group (Optional)</option>
                  <option value="chest">Chest</option>
                  <option value="abs">Abs</option>
                  <option value="quads">Quads</option>
                  <option value="shoulders">Shoulders</option>
                  <option value="biceps">Biceps</option>
                  <option value="triceps">Triceps</option>
                  <option value="forearms">Forearms</option>
                  <option value="traps">Traps</option>
                  <option value="upper-back">Upper Back</option>
                  <option value="lower-back">Lower Back</option>
                  <option value="glutes">Glutes</option>
                  <option value="hamstrings">Hamstrings</option>
                  <option value="calves">Calves</option>
                  <option value="full-body">Full Body</option>
                </select>
              </div>
              <button 
                onClick={() => logExercise()}
                disabled={!newExercise.name}
                className="w-full py-4 bg-primary text-on-primary rounded-xl font-headline font-bold uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                Log Activity
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {exercises.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low rounded-3xl border border-dashed border-outline-variant">
              <Dumbbell className="w-12 h-12 text-outline/30 mx-auto mb-3" />
              <p className="text-sm text-outline font-body">No activities logged today</p>
            </div>
          ) : (
            exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-surface-container shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-on-surface">{ex.name}</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-outline uppercase font-label tracking-widest">
                        {ex.sets} × {ex.reps} @ {ex.weight}kg • {ex.duration}m
                      </p>
                      {ex.muscleGroup && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-label uppercase tracking-widest rounded-full font-bold">
                          {ex.muscleGroup}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-headline font-bold text-secondary">-{ex.caloriesBurned}</span>
                  <p className="font-label text-[10px] uppercase text-outline">kcal</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Volume History Chart */}
      <section className="space-y-6">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Volume History</h2>
        <div className="bg-surface-container-low p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-surface-container">
          <div className="h-32 flex items-end justify-between gap-2">
            {[...Array(7)].map((_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - i));
              const dayVolume = history
                .filter(ex => new Date(ex.timestamp).toDateString() === date.toDateString())
                .reduce((acc, curr) => acc + (curr.volume || 0), 0);
              
              const maxVolume = Math.max(...[...Array(7)].map((_, j) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - j));
                return history
                  .filter(ex => new Date(ex.timestamp).toDateString() === d.toDateString())
                  .reduce((acc, curr) => acc + (curr.volume || 0), 0);
              }), 1000);

              const height = (dayVolume / maxVolume) * 100;

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-full bg-surface-container rounded-t-lg relative overflow-hidden h-full">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      className="absolute bottom-0 left-0 right-0 bg-primary"
                    />
                  </div>
                  <span className="text-[8px] text-outline font-bold uppercase tracking-widest">
                    {date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
