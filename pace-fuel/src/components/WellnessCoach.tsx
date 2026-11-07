import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Loader2, Sparkles, Brain, User, Footprints } from 'lucide-react';
import { chatWithCoach } from '../services/aiService';
import { auth, db, OperationType, handleFirestoreError } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserProfile, StepLogEntry } from '../types';
import { cn } from '../lib/utils';
import { filterEntriesForToday } from '../lib/logUtils';

type CoachMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

function createMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCoachFirstName(profile: UserProfile | null) {
  const rawName = profile?.displayName || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Athlete';
  return rawName.trim().split(/\s+/)[0] || 'Athlete';
}

function getDayPeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getCoachGreeting(profile: UserProfile | null, steps: number) {
  const name = getCoachFirstName(profile);
  const period = getDayPeriod();
  const stepGoal = profile?.dailyStepGoal || 10000;
  const stepsLeft = Math.max(stepGoal - steps, 0);

  if (period === 'morning') {
    return {
      title: `Good morning, ${name}.`,
      body: `I can help you plan breakfast, set your training focus, and map out your step goal for the day.`,
      suggestions: [
        'Plan my breakfast and protein target',
        'Give me a quick morning workout',
        stepsLeft > 0 ? `How do I reach my last ${stepsLeft.toLocaleString()} steps today?` : 'How should I recover after hitting my step goal?',
      ],
    };
  }

  if (period === 'afternoon') {
    return {
      title: `Good afternoon, ${name}.`,
      body: `I can tighten up lunch, adjust your workout, or help you recover without derailing the rest of the day.`,
      suggestions: [
        'Suggest a smart lunch for today',
        'How can I hit my protein goal today?',
        'Give me a 20-minute workout plan',
      ],
    };
  }

  return {
    title: `Good evening, ${name}.`,
    body: `I can help you finish strong with dinner, recovery, steps, or a better wind-down before sleep.`,
    suggestions: [
      'What should I eat for dinner tonight?',
      'How should I recover tonight?',
      'Help me wind down for better sleep',
    ],
  };
}

export default function WellnessCoach() {
  const [isOpen, setIsOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [steps, setSteps] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      });

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

      return () => unsubSteps();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  const coachGreeting = useMemo(() => getCoachGreeting(profile, steps), [profile, steps]);

  const coachHistory = useMemo(
    () => messages.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] })),
    [messages],
  );

  const handleSend = async (prefilledMessage?: string) => {
    const outgoingMessage = (prefilledMessage ?? draftMessage).trim();
    if (!outgoingMessage || isLoading) return;

    const effectiveProfile = profile || {
      displayName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Athlete',
      dailyStepGoal: 10000,
    };

    const userMessage: CoachMessage = {
      id: createMessageId(),
      role: 'user',
      text: outgoingMessage,
    };

    setDraftMessage('');
    setErrorMessage(null);
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatWithCoach(outgoingMessage, effectiveProfile, coachHistory, steps);
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: 'model',
          text: response,
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setErrorMessage('Coach hit a connection issue. Try again and I’ll keep it practical.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-20 right-0 w-[90vw] md:w-[400px] h-[500px] bg-surface rounded-[2.5rem] shadow-2xl border border-surface-container overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline font-bold">Pace Fuel Coach</h3>
                  <p className="text-[10px] uppercase tracking-widest opacity-70">AI Wellness Coach</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
              {messages.length === 0 && (
                <div className="space-y-4 rounded-[2rem] border border-primary/10 bg-primary/5 p-5">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-2 text-center">
                    <p className="font-headline text-xl font-black tracking-tight text-on-surface">
                      {coachGreeting.title}
                    </p>
                    <p className="text-sm text-outline font-body px-4">
                      {coachGreeting.body}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 rounded-full bg-white/70 px-4 py-2 text-[11px] font-semibold text-outline">
                    <Footprints className="h-4 w-4 text-primary" />
                    <span>{steps.toLocaleString()} steps today</span>
                  </div>
                  <div className="grid gap-2">
                    {coachGreeting.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void handleSend(suggestion)}
                        className="rounded-2xl border border-surface-container bg-surface px-4 py-3 text-left text-sm font-medium text-on-surface transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === 'user' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                  )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-secondary text-on-secondary rounded-tr-none" 
                      : "bg-surface-container-low text-on-surface border border-surface-container rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 mr-auto">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-2xl rounded-tl-none border border-surface-container">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
              {errorMessage && (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-surface-container-low border-t border-surface-container">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask about meals, workouts, recovery, or steps..."
                  className="w-full pl-6 pr-14 py-4 bg-surface rounded-full border-none focus:ring-2 focus:ring-primary shadow-sm font-body text-sm"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!draftMessage.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-primary text-on-primary rounded-full shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-90"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all",
          isOpen ? "bg-surface text-primary border border-primary/20" : "bg-primary text-on-primary"
        )}
      >
        {isOpen ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
        {!isOpen && messages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-secondary text-on-secondary text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
            1
          </span>
        )}
      </motion.button>
    </div>
  );
}
