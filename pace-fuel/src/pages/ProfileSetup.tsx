import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Zap, Target, Activity, ChevronRight, ChevronLeft, Check, Sparkles, Loader2 } from 'lucide-react';
import { auth, db, setDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { getOptimalNutritionStrategy, getOptimalTrainingStrategy, OptimalTraining } from '../services/aiService';

const steps = [
  {
    id: 'athleteType',
    title: 'Select Your Discipline',
    description: 'We tailor nutrition based on your metabolic demands.',
    options: [
      { value: 'endurance', label: 'Endurance', sub: 'Running, Cycling, Swimming', icon: Zap },
      { value: 'strength', label: 'Strength', sub: 'Powerlifting, Bodybuilding', icon: Target },
      { value: 'hybrid', label: 'Hybrid', sub: 'CrossFit, Combat Sports', icon: Activity },
      { value: 'general', label: 'General Fitness', sub: 'Active Lifestyle', icon: Check }
    ]
  },
  {
    id: 'dietPreference',
    title: 'Dietary Preference',
    description: 'We optimize for your regional and cultural diet.',
    options: [
      { value: 'north-indian', label: 'North Indian', sub: 'Wheat, Lentils, Dairy focus' },
      { value: 'south-indian', label: 'South Indian', sub: 'Rice, Coconut, Fermented focus' },
      { value: 'vegetarian', label: 'Pure Veg', sub: 'No meat or eggs' },
      { value: 'eggetarian', label: 'Eggetarian', sub: 'Vegetarian + Eggs' },
      { value: 'vegan', label: 'Vegan', sub: 'Plant-based only' },
      { value: 'non-vegetarian', label: 'Non-Veg', sub: 'Includes chicken, fish, eggs' }
    ]
  },
  {
    id: 'goal',
    title: 'What is your primary goal?',
    description: 'Your fuel strategy changes with your objective.',
    options: [
      { value: 'performance', label: 'Peak Performance', sub: 'Optimize for competition' },
      { value: 'weight-loss', label: 'Fat Loss', sub: 'Maintain muscle, lose weight' },
      { value: 'muscle-gain', label: 'Muscle Gain', sub: 'Hypertrophy & strength' },
      { value: 'maintenance', label: 'Maintenance', sub: 'Steady state wellness' }
    ]
  },
  {
    id: 'activityLevel',
    title: 'Current Activity Level',
    description: 'How many hours do you train per week?',
    options: [
      { value: 'sedentary', label: 'Sedentary', sub: '0-2 hours training' },
      { value: 'moderate', label: 'Moderate', sub: '3-5 hours training' },
      { value: 'active', label: 'Active', sub: '6-10 hours training' },
      { value: 'pro', label: 'Professional', sub: '12+ hours training' }
    ]
  },
  {
    id: 'metrics',
    title: 'Physical Metrics',
    description: 'Age, height, and weight help us calculate your BMI and BMR.',
    isInput: true
  },
  {
    id: 'equipment',
    title: 'Available Equipment',
    description: 'We will tailor your workouts based on what you have.',
    isMultiSelect: true,
    options: [
      { value: 'none', label: 'No Equipment', sub: 'Bodyweight only' },
      { value: 'dumbbells', label: 'Dumbbells', sub: 'Adjustable or fixed' },
      { value: 'barbell', label: 'Barbell', sub: 'Olympic or standard' },
      { value: 'bench', label: 'Bench', sub: 'Flat or adjustable' },
      { value: 'pullup-bar', label: 'Pull-up Bar', sub: 'Doorway or wall-mounted' },
      { value: 'resistance-bands', label: 'Resistance Bands', sub: 'Tube or loop' }
    ]
  },
  {
    id: 'trainingStrategy',
    title: 'Training Strategy',
    description: 'How often should you train for optimal results?',
    isTrainingInput: true
  },
  {
    id: 'nutritionGoals',
    title: 'Daily Nutrition Goals',
    description: 'We have calculated these based on your profile. Feel free to adjust them.',
    isNutritionInput: true
  }
];

export default function ProfileSetup() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    athleteType: '',
    dietPreference: '',
    goal: '',
    activityLevel: '',
    age: '',
    height: '',
    weight: '',
    equipment: [] as string[],
    dailyCalorieGoal: 2000,
    dailyProteinGoal: 150,
    dailyCarbsGoal: 200,
    dailyFatsGoal: 70,
    dailyStepGoal: 10000,
    trainingFrequency: 4,
    trainingFocus: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculatingAI, setIsCalculatingAI] = useState(false);
  const [isCalculatingTrainingAI, setIsCalculatingTrainingAI] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [trainingAiReasoning, setTrainingAiReasoning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const calculateDefaultGoals = () => {
    const age = parseInt(formData.age) || 25;
    const height = parseInt(formData.height) || 170;
    const weight = parseInt(formData.weight) || 70;

    let bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    const multipliers = { sedentary: 1.2, moderate: 1.5, active: 1.725, pro: 1.9 };
    let calories = bmr * (multipliers[formData.activityLevel as keyof typeof multipliers] || 1.2);

    let proteinMultiplier = 1.6;
    let carbsMultiplier = 3.0;

    if (formData.athleteType === 'endurance') {
      carbsMultiplier += 2.0;
      proteinMultiplier -= 0.2;
    } else if (formData.athleteType === 'strength') {
      proteinMultiplier += 0.6;
      carbsMultiplier -= 0.5;
    }

    if (formData.goal === 'muscle-gain') calories += 400;
    if (formData.goal === 'weight-loss') calories -= 400;

    const finalProtein = Math.round(weight * proteinMultiplier);
    const finalCarbs = Math.round(weight * carbsMultiplier);
    const finalFats = Math.round((calories - (finalProtein * 4 + finalCarbs * 4)) / 9);

    return {
      calories: Math.round(calories),
      protein: finalProtein,
      carbs: finalCarbs,
      fats: finalFats
    };
  };

  const handleNext = () => {
    if (currentStep === steps.findIndex(s => s.id === 'equipment')) {
      const defaults = calculateDefaultGoals();
      setFormData(prev => ({
        ...prev,
        dailyCalorieGoal: defaults.calories,
        dailyProteinGoal: defaults.protein,
        dailyCarbsGoal: defaults.carbs,
        dailyFatsGoal: defaults.fats
      }));
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleAIStrategy = async () => {
    setIsCalculatingAI(true);
    try {
      const strategy = await getOptimalNutritionStrategy(formData);
      if (strategy) {
        setFormData({
          ...formData,
          dailyCalorieGoal: strategy.calories,
          dailyProteinGoal: strategy.protein,
          dailyCarbsGoal: strategy.carbs,
          dailyFatsGoal: strategy.fats
        });
        setAiReasoning(strategy.reasoning);
      }
    } catch (error) {
      console.error("AI Strategy error:", error);
    } finally {
      setIsCalculatingAI(false);
    }
  };

  const handleTrainingAIStrategy = async () => {
    setIsCalculatingTrainingAI(true);
    try {
      const strategy = await getOptimalTrainingStrategy(formData);
      if (strategy) {
        setFormData({
          ...formData,
          trainingFrequency: strategy.frequency,
          trainingFocus: strategy.focusAreas
        });
        setTrainingAiReasoning(strategy.reasoning);
      }
    } catch (error) {
      console.error("AI Training Strategy error:", error);
    } finally {
      setIsCalculatingTrainingAI(false);
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);

    const profile = {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL,
      athleteType: formData.athleteType,
      dietPreference: formData.dietPreference,
      goal: formData.goal,
      activityLevel: formData.activityLevel,
      age: parseInt(formData.age),
      height: parseInt(formData.height),
      weight: parseInt(formData.weight),
      equipment: formData.equipment,
      muscleRecovery: {
        chest: 100,
        back: 100,
        quads: 100,
        hamstrings: 100,
        glutes: 100,
        calves: 100,
        shoulders: 100,
        arms: 100,
        abs: 100,
        traps: 100
      },
      dailyCalorieGoal: formData.dailyCalorieGoal,
      dailyWaterGoal: formData.activityLevel === 'pro' ? 4500 : 3500,
      dailyProteinGoal: formData.dailyProteinGoal,
      dailyCarbsGoal: formData.dailyCarbsGoal,
      dailyFatsGoal: formData.dailyFatsGoal,
      dailyStepGoal: formData.dailyStepGoal,
      trainingFrequency: formData.trainingFrequency,
      trainingFocus: formData.trainingFocus,
      createdAt: new Date().toISOString()
    };

    try {
      setError(null);
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile);
      navigate('/');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'users');
      } catch (handledErr: any) {
        setError(handledErr.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-12">
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 w-8 rounded-full transition-all duration-500 ${i <= currentStep ? 'bg-primary' : 'bg-surface-container'}`}
            />
          ))}
        </div>
        <span className="text-[10px] font-label font-bold uppercase tracking-widest text-outline">
          Step {currentStep + 1} of {steps.length}
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-1 space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-primary italic font-headline leading-tight">
              {step.title}
            </h1>
            <p className="text-outline font-body">
              {step.description}
            </p>
          </div>

          <div className="grid gap-4">
            {step.isInput ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="font-label text-xs uppercase tracking-widest text-outline font-bold">Age (Years)</label>
                  <input 
                    type="number" 
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="e.g. 25"
                    className="w-full p-6 rounded-3xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label text-xs uppercase tracking-widest text-outline font-bold">Height (cm)</label>
                  <input 
                    type="number" 
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    placeholder="e.g. 175"
                    className="w-full p-6 rounded-3xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label text-xs uppercase tracking-widest text-outline font-bold">Weight (kg)</label>
                  <input 
                    type="number" 
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="e.g. 70"
                    className="w-full p-6 rounded-3xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-xl font-bold"
                  />
                </div>

                {formData.height && formData.weight && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-primary/5 rounded-[2rem] border border-primary/20 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-widest text-primary font-bold">Estimated BMI</p>
                      <p className="font-headline text-3xl font-black italic text-primary">
                        {(parseFloat(formData.weight) / Math.pow(parseFloat(formData.height) / 100, 2)).toFixed(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Status</p>
                      <p className="font-headline font-bold text-on-surface italic">
                        {(() => {
                          const bmi = parseFloat(formData.weight) / Math.pow(parseFloat(formData.height) / 100, 2);
                          if (bmi < 18.5) return "Underweight";
                          if (bmi < 25) return "Normal";
                          if (bmi < 30) return "Overweight";
                          return "Obese";
                        })()}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : step.isNutritionInput ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Daily Targets</label>
                  <button 
                    onClick={handleAIStrategy}
                    disabled={isCalculatingAI}
                    className="flex items-center gap-2 text-[10px] font-label uppercase tracking-widest text-primary font-bold hover:underline disabled:opacity-50"
                  >
                    {isCalculatingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Help me decide with AI
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Calories (kcal)</label>
                    <input 
                      type="number" 
                      value={formData.dailyCalorieGoal}
                      onChange={(e) => setFormData({ ...formData, dailyCalorieGoal: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 rounded-2xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-lg font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Protein (g)</label>
                    <input 
                      type="number" 
                      value={formData.dailyProteinGoal}
                      onChange={(e) => setFormData({ ...formData, dailyProteinGoal: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 rounded-2xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-lg font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Carbs (g)</label>
                    <input 
                      type="number" 
                      value={formData.dailyCarbsGoal}
                      onChange={(e) => setFormData({ ...formData, dailyCarbsGoal: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 rounded-2xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-lg font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Fats (g)</label>
                    <input 
                      type="number" 
                      value={formData.dailyFatsGoal}
                      onChange={(e) => setFormData({ ...formData, dailyFatsGoal: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 rounded-2xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-lg font-bold"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Daily Step Goal</label>
                    <input 
                      type="number" 
                      value={formData.dailyStepGoal}
                      onChange={(e) => setFormData({ ...formData, dailyStepGoal: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 rounded-2xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-lg font-bold"
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
                      AI Suggestion: {aiReasoning}
                    </p>
                  </motion.div>
                )}
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                  <p className="text-[10px] text-outline leading-relaxed italic">
                    * These values are estimates based on your physical metrics and athlete profile. Adjust them if you have specific requirements from a nutritionist.
                  </p>
                </div>
              </div>
            ) : step.isTrainingInput ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Training Plan</label>
                  <button 
                    onClick={handleTrainingAIStrategy}
                    disabled={isCalculatingTrainingAI}
                    className="flex items-center gap-2 text-[10px] font-label uppercase tracking-widest text-primary font-bold hover:underline disabled:opacity-50"
                  >
                    {isCalculatingTrainingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Help me find my optimal stuff
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Frequency (Days/Week)</label>
                    <input 
                      type="number" 
                      value={formData.trainingFrequency}
                      onChange={(e) => setFormData({ ...formData, trainingFrequency: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 rounded-2xl bg-surface-container-low border-2 border-surface-container focus:border-primary focus:ring-0 font-headline text-lg font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-[10px] uppercase tracking-widest text-outline font-bold">Focus Areas</label>
                    <div className="flex flex-wrap gap-2">
                      {['Strength', 'Hypertrophy', 'Endurance', 'Mobility', 'Conditioning', 'Power'].map(area => (
                        <button
                          key={area}
                          onClick={() => {
                            const current = formData.trainingFocus;
                            const updated = current.includes(area)
                              ? current.filter(v => v !== area)
                              : [...current, area];
                            setFormData({ ...formData, trainingFocus: updated });
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${formData.trainingFocus.includes(area) ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline'}`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {trainingAiReasoning && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-primary/5 rounded-2xl border border-primary/20"
                  >
                    <p className="text-[10px] text-primary leading-relaxed font-medium italic">
                      AI Suggestion: {trainingAiReasoning}
                    </p>
                  </motion.div>
                )}
              </div>
            ) : (
              step.options?.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    if (step.isMultiSelect) {
                      const current = formData.equipment;
                      const updated = current.includes(option.value)
                        ? current.filter(v => v !== option.value)
                        : [...current, option.value];
                      setFormData({ ...formData, equipment: updated });
                    } else {
                      setFormData({ ...formData, [step.id]: option.value });
                    }
                  }}
                  className={`p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden group ${
                    (step.isMultiSelect ? formData.equipment.includes(option.value) : formData[step.id as keyof typeof formData] === option.value)
                      ? 'border-primary bg-primary/5' 
                      : 'border-surface-container hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-4 relative z-10">
                    {option.icon && (
                      <div className={`p-3 rounded-2xl ${(step.isMultiSelect ? formData.equipment.includes(option.value) : formData[step.id as keyof typeof formData] === option.value) ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline'}`}>
                        <option.icon className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <p className="font-headline font-bold text-xl">{option.label}</p>
                      <p className="text-sm text-outline font-body">{option.sub}</p>
                    </div>
                  </div>
                  {(step.isMultiSelect ? formData.equipment.includes(option.value) : formData[step.id as keyof typeof formData] === option.value) && (
                    <motion.div 
                      layoutId={`active-bg-${step.id}`}
                      className="absolute inset-0 bg-primary/5 z-0"
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-12 flex gap-4">
        {currentStep > 0 && (
          <button
            onClick={handleBack}
            className="p-5 rounded-full border-2 border-surface-container text-outline hover:bg-surface-container transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={
            (step.isInput ? (!formData.age || !formData.height || !formData.weight) : 
             step.isTrainingInput ? false :
             step.isNutritionInput ? false :
             step.isMultiSelect ? formData.equipment.length === 0 : 
             !formData[step.id as keyof typeof formData]) || isSubmitting
          }
          className="flex-1 bg-primary text-on-primary font-headline font-bold py-5 rounded-full flex items-center justify-center gap-3 shadow-xl shadow-primary/20 disabled:opacity-50 disabled:grayscale"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{currentStep === steps.length - 1 ? 'Finish Setup' : 'Continue'}</span>
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
