import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Play, Droplets, Moon, Zap, Plus, Coffee, GlassWater, Pill, CheckCircle2, Circle, Loader2, Brain, Footprints, AlertTriangle, Radar, PauseCircle, PlayCircle } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError, collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, getDoc } from '../firebase';
import { WellnessSession, WaterLogEntry, SupplementLogEntry, StepLogEntry, UserProfile } from '../types';
import { generateMeditationScript } from '../services/aiService';
import { cn } from '../lib/utils';
import { getStepTrackingSnapshot, isStepTrackingSupported, requestStepTrackingPermission, setStepTrackingEnabled, subscribeToStepTracking, updateStepTrackingSnapshot } from '../lib/stepTracking';

const MAX_DAILY_WATER_LITERS = 10;
const HIGH_WATER_WARNING_THRESHOLD_LITERS = 4;

export default function Wellness() {
  const [water, setWater] = useState(0);
  const [sessions, setSessions] = useState<WellnessSession[]>([]);
  const [supplements, setSupplements] = useState<SupplementLogEntry[]>([]);
  const [selectedMins, setSelectedMins] = useState(10);
  const [newSupp, setNewSupp] = useState('');
  const [mood, setMood] = useState('');
  const [aiScript, setAiScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(10000);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newSteps, setNewSteps] = useState('');
  const [waterAlert, setWaterAlert] = useState<string | null>(null);
  const [stepTracking, setStepTracking] = useState(getStepTrackingSnapshot());

  const waterGoal = Math.min((profile?.dailyWaterGoal || 3000) / 1000, MAX_DAILY_WATER_LITERS);

  useEffect(() => {
    if (water >= MAX_DAILY_WATER_LITERS) {
      setWaterAlert(`You have reached the ${MAX_DAILY_WATER_LITERS}L daily hydration limit for today.`);
      return;
    }

    if (water >= HIGH_WATER_WARNING_THRESHOLD_LITERS) {
      setWaterAlert(`Warning: you have logged ${water.toFixed(1)}L today. Intake above ${HIGH_WATER_WARNING_THRESHOLD_LITERS}L should match your training load, weather, and recovery needs.`);
      return;
    }

    setWaterAlert(null);
  }, [water]);

  useEffect(() => {
    const unsubscribe = subscribeToStepTracking((snapshot) => {
      setStepTracking(snapshot);
    });

    setStepTracking(getStepTrackingSnapshot());
    return unsubscribe;
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const today = new Date().toDateString();

    // Profile for Step Goal
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const profileData = snap.data() as UserProfile;
        setProfile(profileData);
        if (profileData.dailyStepGoal) setStepGoal(profileData.dailyStepGoal);
      }
    });

    // Water
    const waterQ = query(collection(db, 'waterLogs'), where('userId', '==', user.uid));
    const unsubWater = onSnapshot(waterQ, (snapshot) => {
      const todayWater = snapshot.docs
        .map(doc => doc.data() as WaterLogEntry)
        .filter(l => new Date(l.timestamp).toDateString() === today)
        .reduce((acc, l) => acc + l.amount, 0);
      setWater(todayWater);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'waterLogs'));

    // Sessions
    const sessionQ = query(collection(db, 'wellnessSessions'), where('userId', '==', user.uid));
    const unsubSessions = onSnapshot(sessionQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WellnessSession));
      setSessions(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'wellnessSessions'));

    // Supplements
    const suppQ = query(collection(db, 'supplementLogs'), where('userId', '==', user.uid));
    const unsubSupps = onSnapshot(suppQ, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as SupplementLogEntry))
        .filter(s => new Date(s.timestamp).toDateString() === today);
      setSupplements(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'supplementLogs'));

    // Steps
    const stepsQ = query(collection(db, 'stepLogs'), where('userId', '==', user.uid));
    const unsubSteps = onSnapshot(stepsQ, (snapshot) => {
      const todaySteps = snapshot.docs
        .map(doc => doc.data() as StepLogEntry)
        .filter(l => new Date(l.timestamp).toDateString() === today)
        .reduce((acc, l) => acc + l.steps, 0);
      setSteps(todaySteps);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'stepLogs'));

    return () => {
      unsubWater();
      unsubSessions();
      unsubSupps();
      unsubSteps();
    };
  }, []);

  const addWater = async (amount: number) => {
    const user = auth.currentUser;
    if (!user) return;

    const projectedWater = Number((water + amount).toFixed(1));
    if (projectedWater > MAX_DAILY_WATER_LITERS) {
      setWaterAlert(`Daily hydration is capped at ${MAX_DAILY_WATER_LITERS}L. You are already at ${water.toFixed(1)}L today.`);
      return;
    }

    try {
      await addDoc(collection(db, 'waterLogs'), {
        userId: user.uid,
        amount,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'waterLogs');
    }
  };

  const startSession = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'wellnessSessions'), {
        userId: user.uid,
        type: 'meditation',
        duration: selectedMins,
        mood: mood || 'General',
        timestamp: new Date().toISOString()
      });
      setAiScript(null);
      setMood('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'wellnessSessions');
    }
  };

  const getAIScript = async () => {
    if (!mood.trim()) return;
    setIsGeneratingScript(true);
    const script = await generateMeditationScript(mood, selectedMins);
    setAiScript(script);
    setIsGeneratingScript(false);
  };

  const addSupplement = async () => {
    if (!newSupp.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'supplementLogs'), {
        userId: user.uid,
        name: newSupp,
        taken: false,
        timestamp: new Date().toISOString()
      });
      setNewSupp('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'supplementLogs');
    }
  };

  const toggleSupplement = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'supplementLogs', id), { taken: !current });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'supplementLogs');
    }
  };

  const addSteps = async () => {
    if (!newSteps.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'stepLogs'), {
        userId: user.uid,
        steps: parseInt(newSteps),
        source: 'manual',
        timestamp: new Date().toISOString()
      });
      setNewSteps('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'stepLogs');
    }
  };

  const handleToggleAutoSteps = async () => {
    if (stepTracking.enabled) {
      setStepTrackingEnabled(false);
      setStepTracking(getStepTrackingSnapshot());
      return;
    }

    if (!isStepTrackingSupported()) {
      updateStepTrackingSnapshot({
        enabled: false,
        status: 'unsupported',
        message: 'This device does not expose motion sensors for pedometer tracking.',
      });
      setStepTracking(getStepTrackingSnapshot());
      return;
    }

    const permissionGranted = await requestStepTrackingPermission();
    if (!permissionGranted) {
      updateStepTrackingSnapshot({
        enabled: false,
        status: 'permission-denied',
        message: 'Motion permission is required before the app can count your steps.',
      });
      setStepTracking(getStepTrackingSnapshot());
      return;
    }

    setStepTrackingEnabled(true);
    setStepTracking(getStepTrackingSnapshot());
  };

  const autoStepTone =
    stepTracking.status === 'active'
      ? 'border-primary/20 bg-primary/5 text-primary'
      : stepTracking.status === 'error' ||
          stepTracking.status === 'permission-denied' ||
          stepTracking.status === 'unsupported'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700'
        : 'border-surface-container bg-surface text-outline';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-12 pb-20"
    >
      {/* Hero Section */}
      <section className="space-y-2">
        <span className="font-label text-secondary uppercase tracking-widest text-[10px] font-bold">Daily Rituals</span>
        <h2 className="font-headline text-5xl font-black text-on-surface leading-none tracking-tighter">
          Your Inner<br/><span className="text-primary italic">Sanctuary.</span>
        </h2>
      </section>

      {/* Meditation Section */}
      <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 space-y-8 relative overflow-hidden border border-surface-container">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-surface rounded-2xl shadow-sm border border-surface-container">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-bold tracking-tight">Mindful Session</h3>
              <p className="font-body text-outline text-sm">Quiet the noise, find your flow.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="space-y-4">
            <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">How are you feeling?</label>
            <div className="flex gap-2">
              <input 
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. Stressed, Tired, Need focus"
                className="flex-1 bg-surface border-2 border-surface-container rounded-2xl px-5 py-4 font-body focus:border-primary transition-all outline-none"
              />
              <button 
                onClick={getAIScript}
                disabled={!mood.trim() || isGeneratingScript}
                className="bg-primary/10 text-primary p-4 rounded-2xl hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                {isGeneratingScript ? <Loader2 className="w-6 h-6 animate-spin" /> : <Brain className="w-6 h-6" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {aiScript && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 bg-primary/5 rounded-2xl border border-primary/10 overflow-hidden"
              >
                <p className="font-body text-sm text-on-surface leading-relaxed italic">
                  "{aiScript}"
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 20, 30].map(m => (
              <button 
                key={m}
                onClick={() => setSelectedMins(m)}
                className={cn(
                  "px-5 py-3 rounded-2xl font-label text-xs transition-all border-2",
                  selectedMins === m 
                    ? "bg-primary text-on-primary font-bold border-primary shadow-lg shadow-primary/20 scale-105" 
                    : "bg-surface font-semibold border-surface-container text-outline hover:border-primary/20"
                )}
              >
                {m} MIN
              </button>
            ))}
          </div>

          <div className="w-full h-48 rounded-3xl overflow-hidden relative group border border-surface-container">
            <img 
              alt="Meditation" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
              src="https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&q=60&w=800" 
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
              <button 
                onClick={startSession}
                className="w-full bg-primary text-on-primary font-headline font-bold py-5 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all scale-100 active:scale-95 shadow-xl shadow-primary/20"
              >
                <Play className="w-5 h-5 fill-current" />
                Start {selectedMins} Min Session
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Supplement Tracker */}
      <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 space-y-8 border border-surface-container">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-surface rounded-2xl shadow-sm border border-surface-container">
            <Pill className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h3 className="font-headline text-2xl font-bold tracking-tight">Supplements</h3>
            <p className="font-body text-outline text-sm">Fuel your recovery & performance.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input 
              type="text"
              value={newSupp}
              onChange={(e) => setNewSupp(e.target.value)}
              placeholder="Add supplement (e.g. Creatine)"
              className="flex-1 bg-surface border-2 border-surface-container rounded-2xl px-5 py-4 font-body focus:border-primary transition-all outline-none"
            />
            <button 
              onClick={addSupplement}
              className="bg-primary text-on-primary p-4 rounded-2xl shadow-lg shadow-primary/20"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {supplements.map((supp) => (
                <motion.div
                  key={supp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border-2 transition-all",
                    supp.taken ? "bg-surface-container-highest border-transparent opacity-60" : "bg-surface border-surface-container"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <button onClick={() => supp.id && toggleSupplement(supp.id, !!supp.taken)}>
                      {supp.taken ? (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      ) : (
                        <Circle className="w-6 h-6 text-outline" />
                      )}
                    </button>
                    <span className={cn("font-headline font-bold text-lg break-words line-clamp-2", supp.taken && "line-through")}>
                      {supp.name}
                    </span>
                  </div>
                  <Zap className={cn("w-5 h-5", supp.taken ? "text-primary" : "text-outline")} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Sleep Log Section */}
      <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 space-y-8 border border-surface-container">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-surface rounded-2xl shadow-sm border border-surface-container">
            <Moon className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="font-headline text-2xl font-bold tracking-tight">Sleep Quality</h3>
            <p className="font-body text-outline text-sm">Recovery happens while you sleep.</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Poor', icon: '😫', score: 20 },
            { label: 'Fair', icon: '😐', score: 50 },
            { label: 'Good', icon: '😊', score: 80 },
            { label: 'Elite', icon: '🚀', score: 100 }
          ].map((item, i) => (
            <button 
              key={i}
              onClick={async () => {
                const user = auth.currentUser;
                if (!user) return;
                try {
                  await addDoc(collection(db, 'wellnessSessions'), {
                    userId: user.uid,
                    type: 'sleep',
                    duration: 8, // Assumed 8 hours for simplicity
                    score: item.score,
                    timestamp: new Date().toISOString()
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, 'wellnessSessions');
                }
              }}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface hover:bg-white transition-all border-2 border-surface-container active:border-blue-400/50 scale-100 active:scale-95 shadow-sm group"
            >
              <span className="text-3xl group-hover:scale-125 transition-transform">{item.icon}</span>
              <span className="font-label text-[10px] font-bold tracking-widest text-outline">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Steps Section */}
      <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 space-y-8 border border-surface-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-surface rounded-2xl shadow-sm border border-surface-container">
              <Footprints className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-bold tracking-tight">Daily Steps</h3>
              <p className="font-body text-outline text-sm">Goal: {stepGoal.toLocaleString()} steps</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-headline text-4xl font-black text-primary tracking-tighter">{steps.toLocaleString()}</span>
            <span className="font-label text-outline text-[10px] uppercase tracking-widest ml-1 font-bold">Steps</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="w-full h-5 bg-surface-container-highest rounded-full overflow-hidden border border-surface-container">
            <motion.div 
              className="h-full bg-primary rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((steps / stepGoal) * 100, 100)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between font-label text-[10px] text-outline uppercase tracking-[0.2em] font-bold">
            <span>0</span>
            <span className="text-primary">{Math.round((steps / stepGoal) * 100)}% Achieved</span>
            <span>{stepGoal.toLocaleString()}</span>
          </div>
        </div>

        <div className={cn("rounded-3xl border p-5 space-y-4 transition-colors", autoStepTone)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/70 p-3 shadow-sm">
                <Radar className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="font-headline text-lg font-bold text-on-surface">Auto Pedometer</p>
                <p className="text-sm leading-relaxed text-outline">
                  {stepTracking.message}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleAutoSteps}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-label text-[10px] font-bold uppercase tracking-widest transition-all",
                stepTracking.enabled
                  ? "bg-on-surface text-surface"
                  : "bg-primary text-on-primary shadow-lg shadow-primary/20"
              )}
            >
              {stepTracking.enabled ? (
                <PauseCircle className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {stepTracking.enabled ? 'Stop Auto Steps' : 'Start Auto Steps'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-label font-bold uppercase tracking-widest">
            <span className="rounded-full bg-white/70 px-3 py-1 text-outline">
              Status: {stepTracking.status.replace('-', ' ')}
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1 text-outline">
              Session Auto Steps: {stepTracking.sessionSteps.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-outline">
            This uses your phone&apos;s motion sensor like a lightweight pedometer while the app stays open. Use manual add only to correct missed steps.
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">
            Manual Step Adjustment
          </p>
          <div className="flex gap-2">
            <input 
              type="number"
              value={newSteps}
              onChange={(e) => setNewSteps(e.target.value)}
              placeholder="Add correction (e.g. 2000)"
              className="flex-1 bg-surface border-2 border-surface-container rounded-2xl px-5 py-4 font-body focus:border-primary transition-all outline-none"
            />
            <button 
              onClick={addSteps}
              className="bg-primary text-on-primary p-4 rounded-2xl shadow-lg shadow-primary/20"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Hydration Section */}
      <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 space-y-8 border border-surface-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-surface rounded-2xl shadow-sm border border-surface-container">
              <Droplets className="w-6 h-6 text-blue-500 fill-current" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-bold tracking-tight">Hydration</h3>
              <p className="font-body text-outline text-sm">Goal: {waterGoal}L daily • Max {MAX_DAILY_WATER_LITERS}L</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-headline text-4xl font-black text-blue-500 tracking-tighter">{water.toFixed(1)}</span>
            <span className="font-label text-outline text-[10px] uppercase tracking-widest ml-1 font-bold">Liters</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="w-full h-5 bg-surface-container-highest rounded-full overflow-hidden border border-surface-container">
            <motion.div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((water / waterGoal) * 100, 100)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between font-label text-[10px] text-outline uppercase tracking-[0.2em] font-bold">
            <span>0L</span>
            <span className="text-blue-500">{Math.round((water / waterGoal) * 100)}% Achieved</span>
            <span>{waterGoal}L Goal</span>
          </div>
        </div>

        {waterAlert && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-body",
              water >= MAX_DAILY_WATER_LITERS
                ? "border-red-500/30 bg-red-500/10 text-red-600"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700"
            )}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{waterAlert}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '500ML', amount: 0.5, icon: GlassWater },
            { label: '1L', amount: 1, icon: Droplets }
          ].map((item, i) => (
            <button 
              key={i}
              onClick={() => addWater(item.amount)}
              disabled={water >= MAX_DAILY_WATER_LITERS}
              className={cn(
                "flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-surface transition-all border-2 border-surface-container shadow-sm",
                water >= MAX_DAILY_WATER_LITERS
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-white active:border-blue-500/50 scale-100 active:scale-95"
              )}
            >
              <item.icon className="w-6 h-6 text-blue-500" />
              <span className="font-label text-[10px] font-bold tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
