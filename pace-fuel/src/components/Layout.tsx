import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Utensils, Heart, BarChart3, Settings, X, LogOut, User, ChevronRight, Shield, Bell, Dumbbell, Sparkles, Loader2, KeyRound, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { auth, signOut, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import WellnessCoach from './WellnessCoach';
import AutoStepTracker from './AutoStepTracker';
import { getOptimalNutritionStrategy } from '../services/aiService';
import { clearGeminiApiKey, getConfiguredGeminiApiKey, getGeminiApiKeyValidationError, getGeminiKeySource, saveGeminiApiKey } from '../lib/runtimeConfig';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
}

export default function Layout({ children, user }: LayoutProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCalculatingAI, setIsCalculatingAI] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<string | null>(null);
  const [geminiKeySource, setGeminiKeySource] = useState(getGeminiKeySource());
  const navigate = useNavigate();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      });
    }
  }, [user]);

  useEffect(() => {
    if (geminiKeySource === 'stored') {
      setGeminiKeyInput(getConfiguredGeminiApiKey());
    }
  }, [geminiKeySource]);

  const refreshGeminiKeyState = () => {
    const source = getGeminiKeySource();
    setGeminiKeySource(source);
    if (source !== 'stored') {
      setGeminiKeyInput('');
    }
  };

  const handleSaveGeminiKey = () => {
    const validationError = getGeminiApiKeyValidationError(geminiKeyInput);
    if (validationError) {
      setGeminiStatus(validationError);
      return;
    }

    saveGeminiApiKey(geminiKeyInput);
    refreshGeminiKeyState();
    setGeminiStatus(geminiKeyInput.trim() ? 'Gemini key saved on this device. Search, coach, and AI strategy screens can use live responses now.' : 'Stored Gemini key removed. The app will use bundled config or offline mode.');
  };

  const handleClearGeminiKey = () => {
    clearGeminiApiKey();
    refreshGeminiKeyState();
    setGeminiStatus('Stored Gemini key removed. The app will use bundled config or offline mode.');
  };

  const updateProfileField = async (field: keyof UserProfile, value: string | number) => {
    if (!user?.uid) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { [field]: value });
      setProfile(prev => prev ? { ...prev, [field]: value } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAIStrategy = async () => {
    if (!profile) return;
    setIsCalculatingAI(true);
    try {
      const strategy = await getOptimalNutritionStrategy(profile);
      if (strategy && user?.uid) {
        const updates = {
          dailyCalorieGoal: strategy.calories,
          dailyProteinGoal: strategy.protein,
          dailyCarbsGoal: strategy.carbs,
          dailyFatsGoal: strategy.fats
        };
        await updateDoc(doc(db, 'users', user.uid), updates);
        setProfile(prev => prev ? { ...prev, ...updates } : null);
        setAiReasoning(strategy.reasoning);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsCalculatingAI(false);
    }
  };

  const bmi = profile?.weight && profile?.height 
    ? (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1) 
    : null;

  return (
    <div className="min-h-screen bg-background text-on-surface font-body pb-32">
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-error text-on-error text-center py-1 text-xs font-bold uppercase tracking-widest">
          You are offline. Some features may not work.
        </div>
      )}
      {/* Top App Bar */}
      <header className={cn("fixed w-full z-50 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl flex justify-between items-center px-6 py-4 border-b border-outline/10", isOffline ? "top-6" : "top-0")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden border border-outline/20 flex-shrink-0">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary text-white font-bold">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <img
            src="/app-logo.png"
            alt="Pace Fuel logo"
            className="h-10 w-10 rounded-2xl object-cover border border-outline/20 shadow-sm flex-shrink-0"
          />
          <span className="text-2xl font-black text-primary italic font-headline tracking-tight truncate">Pace Fuel</span>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-stone-500 hover:bg-surface-container rounded-full transition-all flex-shrink-0"
        >
          <Settings className="w-6 h-6" />
        </button>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto">
        {children}
      </main>

      <WellnessCoach />
      <AutoStepTracker user={user} />

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-surface rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="font-headline text-3xl font-black italic tracking-tight text-primary">Settings</h2>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 bg-surface-container rounded-full hover:bg-surface-container-high transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-8 no-scrollbar pb-10">
                {/* Profile Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 text-outline mb-2">
                    <User className="w-4 h-4" />
                    <span className="font-label text-[10px] uppercase tracking-widest font-bold">Athlete Profile</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase font-label text-outline">Athlete Type</p>
                        <p className="font-headline font-bold capitalize">{profile?.athleteType || 'General'}</p>
                      </div>
                      <select 
                        className="bg-transparent font-label text-xs text-primary font-bold focus:outline-none"
                        value={profile?.athleteType || ''}
                        onChange={(e) => updateProfileField('athleteType', e.target.value)}
                        disabled={isUpdating}
                      >
                        <option value="endurance">Endurance</option>
                        <option value="strength">Strength</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="general">General</option>
                      </select>
                    </div>

                    <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase font-label text-outline">Dietary Preference</p>
                        <p className="font-headline font-bold capitalize">{profile?.dietPreference?.replace('-', ' ') || 'None'}</p>
                      </div>
                      <select 
                        className="bg-transparent font-label text-xs text-primary font-bold focus:outline-none"
                        value={profile?.dietPreference || ''}
                        onChange={(e) => updateProfileField('dietPreference', e.target.value)}
                        disabled={isUpdating}
                      >
                        <option value="north-indian">North Indian</option>
                        <option value="south-indian">South Indian</option>
                        <option value="vegetarian">Pure Veg</option>
                        <option value="eggetarian">Eggetarian</option>
                        <option value="vegan">Vegan</option>
                        <option value="non-vegetarian">Non-Veg</option>
                      </select>
                    </div>

                    <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase font-label text-outline">Primary Goal</p>
                        <p className="font-headline font-bold capitalize">{profile?.goal?.replace('-', ' ') || 'Maintenance'}</p>
                      </div>
                      <select 
                        className="bg-transparent font-label text-xs text-primary font-bold focus:outline-none"
                        value={profile?.goal || ''}
                        onChange={(e) => updateProfileField('goal', e.target.value)}
                        disabled={isUpdating}
                      >
                        <option value="performance">Performance</option>
                        <option value="weight-loss">Fat Loss</option>
                        <option value="muscle-gain">Muscle Gain</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                        <p className="text-[10px] uppercase font-label text-outline mb-1">Age</p>
                        <input 
                          type="number" 
                          className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                          value={profile?.age || ''}
                          onChange={(e) => updateProfileField('age', parseInt(e.target.value) || 0)}
                          disabled={isUpdating}
                        />
                      </div>
                      <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                        <p className="text-[10px] uppercase font-label text-outline mb-1">Step Goal</p>
                        <input 
                          type="number" 
                          className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                          value={profile?.dailyStepGoal || ''}
                          onChange={(e) => updateProfileField('dailyStepGoal', parseInt(e.target.value) || 0)}
                          disabled={isUpdating}
                        />
                      </div>
                      <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                        <p className="text-[10px] uppercase font-label text-outline mb-1">Height (cm)</p>
                        <input 
                          type="number" 
                          className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                          value={profile?.height || ''}
                          onChange={(e) => updateProfileField('height', parseInt(e.target.value) || 0)}
                          disabled={isUpdating}
                        />
                      </div>
                      <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                        <p className="text-[10px] uppercase font-label text-outline mb-1">Weight (kg)</p>
                        <input 
                          type="number" 
                          className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                          value={profile?.weight || ''}
                          onChange={(e) => updateProfileField('weight', parseInt(e.target.value) || 0)}
                          disabled={isUpdating}
                        />
                      </div>
                    </div>

                    {bmi && (
                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex items-center justify-between">
                        <span className="font-label text-xs uppercase tracking-widest text-primary font-bold">Calculated BMI</span>
                        <span className="font-headline text-2xl font-black italic text-primary">{bmi}</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-[10px] uppercase font-label text-outline">Available Equipment</p>
                      <div className="flex flex-wrap gap-2">
                        {['none', 'dumbbells', 'barbell', 'bench', 'pullup-bar', 'resistance-bands'].map(eq => (
                          <button
                            key={eq}
                            onClick={() => {
                              const current = profile?.equipment || [];
                              const updated = current.includes(eq)
                                ? current.filter(v => v !== eq)
                                : [...current, eq];
                              updateProfileField('equipment', updated);
                            }}
                            className={`px-3 py-2 rounded-xl border text-[10px] uppercase font-bold tracking-widest transition-all ${
                              profile?.equipment?.includes(eq)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-surface-container text-outline hover:border-primary/50'
                            }`}
                          >
                            {eq.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-3 text-outline mb-2">
                    <Wifi className="w-4 h-4" />
                    <span className="font-label text-[10px] uppercase tracking-widest font-bold">Online AI</span>
                  </div>

                  <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container space-y-4">
                    <div className="space-y-1">
                      <p className="font-headline font-bold text-on-surface">Gemini Access</p>
                      <p className="text-xs text-outline font-body leading-relaxed">
                        Save a real Gemini API key on this device to enable live AI replies for coach chat, food search, and strategy generation in the APK. `APP_URL` is not needed here, and example values like `MY_GEMINI_API_KEY` will be ignored.
                      </p>
                    </div>

                    <div className="text-[10px] uppercase tracking-widest font-bold text-primary">
                      Status: {geminiKeySource === 'stored' ? 'Stored On Device' : geminiKeySource === 'bundled' ? 'Bundled In Build' : 'Offline Fallback'}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Paste Gemini API key"
                        value={geminiKeyInput}
                        onChange={(e) => setGeminiKeyInput(e.target.value)}
                        className="flex-1 p-4 rounded-2xl bg-surface border border-surface-container focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body text-on-surface"
                      />
                      <button
                        type="button"
                        onClick={handleSaveGeminiKey}
                        className="px-4 py-3 rounded-2xl bg-primary text-on-primary font-headline font-bold shadow-sm"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-outline font-body leading-relaxed">
                        {geminiStatus || 'Stored only on this device. Clear it anytime.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleClearGeminiKey}
                        className="text-[10px] text-outline hover:text-primary transition-colors font-bold uppercase tracking-wider"
                      >
                        Clear Key
                      </button>
                    </div>
                  </div>
                </section>

                {/* Nutrition Goals Section */}
                <section className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3 text-outline">
                      <Utensils className="w-4 h-4" />
                      <span className="font-label text-[10px] uppercase tracking-widest font-bold">Nutrition Goals</span>
                    </div>
                    <button 
                      onClick={handleAIStrategy}
                      disabled={isCalculatingAI}
                      className="flex items-center gap-2 text-[10px] font-label uppercase tracking-widest text-primary font-bold hover:underline disabled:opacity-50"
                    >
                      {isCalculatingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI Suggest
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                      <p className="text-[10px] uppercase font-label text-outline mb-1">Calories (kcal)</p>
                      <input 
                        type="number" 
                        className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                        value={profile?.dailyCalorieGoal || ''}
                        onChange={(e) => updateProfileField('dailyCalorieGoal', parseInt(e.target.value) || 0)}
                        disabled={isUpdating}
                      />
                    </div>
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                      <p className="text-[10px] uppercase font-label text-outline mb-1">Protein (g)</p>
                      <input 
                        type="number" 
                        className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                        value={profile?.dailyProteinGoal || ''}
                        onChange={(e) => updateProfileField('dailyProteinGoal', parseInt(e.target.value) || 0)}
                        disabled={isUpdating}
                      />
                    </div>
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                      <p className="text-[10px] uppercase font-label text-outline mb-1">Carbs (g)</p>
                      <input 
                        type="number" 
                        className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                        value={profile?.dailyCarbsGoal || ''}
                        onChange={(e) => updateProfileField('dailyCarbsGoal', parseInt(e.target.value) || 0)}
                        disabled={isUpdating}
                      />
                    </div>
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                      <p className="text-[10px] uppercase font-label text-outline mb-1">Fats (g)</p>
                      <input 
                        type="number" 
                        className="w-full bg-transparent font-headline font-bold text-primary focus:outline-none"
                        value={profile?.dailyFatsGoal || ''}
                        onChange={(e) => updateProfileField('dailyFatsGoal', parseInt(e.target.value) || 0)}
                        disabled={isUpdating}
                      />
                    </div>
                  </div>
                  {aiReasoning && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-primary/5 rounded-2xl border border-primary/20"
                    >
                      <p className="text-[10px] text-primary leading-relaxed font-medium italic">
                        AI Strategy: {aiReasoning}
                      </p>
                    </motion.div>
                  )}
                </section>

                {/* Account Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 text-outline mb-2">
                    <Shield className="w-4 h-4" />
                    <span className="font-label text-[10px] uppercase tracking-widest font-bold">Account & Security</span>
                  </div>
                  <div className="space-y-3">
                    <button className="w-full p-4 bg-surface-container-low rounded-2xl border border-surface-container flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-outline" />
                        <span className="font-body font-medium">Notifications</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-outline group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button 
                      onClick={() => {
                        signOut(auth);
                        setIsSettingsOpen(false);
                      }}
                      className="w-full p-4 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 text-red-500">
                        <LogOut className="w-5 h-5" />
                        <span className="font-body font-bold">Sign Out</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-red-500 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </section>
              </div>

              <div className="pt-6 border-t border-outline/10 text-center">
                <p className="text-[10px] font-label text-outline uppercase tracking-[0.2em]">Pace Fuel v1.2.0</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div className="fixed bottom-6 left-0 w-full px-4 z-50 pointer-events-none">
        <nav className="max-w-md mx-auto flex justify-around items-center p-2 bg-white/20 dark:bg-stone-900/20 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/30 dark:border-white/10 pointer-events-auto">
          <NavLink 
            to="/" 
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all duration-300",
              isActive ? "bg-white/40 dark:bg-white/10 text-primary shadow-sm" : "text-stone-500 hover:bg-white/10"
            )}
          >
            {({ isActive }) => (
              <>
                <Home className={cn("w-5 h-5", isActive && "fill-current")} />
                <span className="font-label text-[9px] uppercase tracking-wider mt-1 font-bold">Home</span>
              </>
            )}
          </NavLink>
          
          <NavLink 
            to="/food" 
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all duration-300",
              isActive ? "bg-white/40 dark:bg-white/10 text-primary shadow-sm" : "text-stone-500 hover:bg-white/10"
            )}
          >
            <Utensils className="w-5 h-5" />
            <span className="font-label text-[9px] uppercase tracking-wider mt-1 font-bold">Food</span>
          </NavLink>

          <NavLink 
            to="/training" 
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all duration-300",
              isActive ? "bg-white/40 dark:bg-white/10 text-primary shadow-sm" : "text-stone-500 hover:bg-white/10"
            )}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="font-label text-[9px] uppercase tracking-wider mt-1 font-bold">Train</span>
          </NavLink>

          <NavLink 
            to="/wellness" 
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all duration-300",
              isActive ? "bg-white/40 dark:bg-white/10 text-primary shadow-sm" : "text-stone-500 hover:bg-white/10"
            )}
          >
            <Heart className="w-5 h-5" />
            <span className="font-label text-[9px] uppercase tracking-wider mt-1 font-bold">Wellness</span>
          </NavLink>

          <NavLink 
            to="/progress" 
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all duration-300",
              isActive ? "bg-white/40 dark:bg-white/10 text-primary shadow-sm" : "text-stone-500 hover:bg-white/10"
            )}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-label text-[9px] uppercase tracking-wider mt-1 font-bold">Progress</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
