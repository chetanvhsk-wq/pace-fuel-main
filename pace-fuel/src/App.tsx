import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, doc, onSnapshot } from './firebase';

const loadLayout = () => import('./components/Layout');
const loadDashboard = () => import('./pages/Dashboard');
const loadFoodLog = () => import('./pages/FoodLog');
const loadAddFood = () => import('./pages/AddFood');
const loadWellness = () => import('./pages/Wellness');
const loadProgress = () => import('./pages/Progress');
const loadTraining = () => import('./pages/Training');
const loadLogin = () => import('./pages/Login');
const loadProfileSetup = () => import('./pages/ProfileSetup');
const loadStrategy = () => import('./pages/Strategy');

const Layout = React.lazy(loadLayout);
const Dashboard = React.lazy(loadDashboard);
const FoodLog = React.lazy(loadFoodLog);
const AddFood = React.lazy(loadAddFood);
const Wellness = React.lazy(loadWellness);
const Progress = React.lazy(loadProgress);
const Training = React.lazy(loadTraining);
const Login = React.lazy(loadLogin);
const ProfileSetup = React.lazy(loadProfileSetup);
const Strategy = React.lazy(loadStrategy);

const AUTH_PRELOADERS = [loadLogin, loadProfileSetup];
const APP_PRELOADERS = [
  loadLayout,
  loadDashboard,
  loadFoodLog,
  loadAddFood,
  loadWellness,
  loadProgress,
  loadTraining,
  loadStrategy,
];

const MIN_BOOT_SCREEN_MS = 4000;
const AUTH_RESOLUTION_TIMEOUT_MS = 15000;

function schedulePrefetch(importers: Array<() => Promise<unknown>>) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const prefetchWindow = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

  const prefetch = () => {
    importers.forEach((loader) => {
      void loader();
    });
  };

  if (
    typeof prefetchWindow.requestIdleCallback === 'function' &&
    typeof prefetchWindow.cancelIdleCallback === 'function'
  ) {
    const idleId = prefetchWindow.requestIdleCallback(prefetch, { timeout: 1500 });
    return () => prefetchWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = globalThis.setTimeout(prefetch, 350);
  return () => globalThis.clearTimeout(timeoutId);
}

function AppLoadingScreen({ subtitle }: { subtitle: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute inset-5 rounded-full border-[3px] border-primary/15 border-t-primary animate-spin"></div>
        <img
          src="/app-logo.png"
          alt="Pace Fuel logo"
          className="relative h-24 w-24 object-contain drop-shadow-[0_18px_28px_rgba(13,99,27,0.18)]"
        />
      </div>
      <div className="space-y-1">
        <p className="font-headline font-black text-primary italic text-2xl animate-pulse">Pace Fuel</p>
        <p className="font-body text-sm text-outline">{subtitle}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [minimumBootElapsed, setMinimumBootElapsed] = useState(false);

  useEffect(() => {
    return schedulePrefetch(AUTH_PRELOADERS);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumBootElapsed(true), MIN_BOOT_SCREEN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let settled = false;

    const finishLoading = () => {
      if (settled) {
        return;
      }

      settled = true;
      setLoading(false);
      window.clearTimeout(timeout);
    };

    const timeout = window.setTimeout(() => {
      if (!settled) {
        console.warn('Auth check timed out, forcing load');
        finishLoading();
      }
    }, AUTH_RESOLUTION_TIMEOUT_MS);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      // Cleanup previous profile listener if any
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (user) {
        unsubProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          setHasProfile(doc.exists());
          finishLoading();
        }, (error) => {
          console.error('Error checking profile:', error);
          setHasProfile(false);
          finishLoading();
        });
      } else {
        setHasProfile(null);
        finishLoading();
      }
    });

    return () => {
      settled = true;
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    return schedulePrefetch(APP_PRELOADERS);
  }, [user]);

  if (loading || !minimumBootElapsed) {
    return (
      <AppLoadingScreen
        subtitle={
          loading
            ? 'Checking your performance profile...'
            : 'Finalizing your training workspace...'
        }
      />
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<AppLoadingScreen subtitle="Opening sign-in..." />}>
        <Login />
      </Suspense>
    );
  }

  return (
    <Router>
      <Suspense fallback={<AppLoadingScreen subtitle="Loading your training workspace..." />}>
        <Routes>
          <Route 
            path="/setup" 
            element={hasProfile ? <Navigate to="/" /> : <ProfileSetup />} 
          />
          <Route 
            path="/*" 
            element={
              hasProfile === false ? (
                <Navigate to="/setup" />
              ) : (
                <Layout user={user}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/food" element={<FoodLog />} />
                    <Route path="/food/add" element={<AddFood />} />
                    <Route path="/training" element={<Training />} />
                    <Route path="/wellness" element={<Wellness />} />
                    <Route path="/progress" element={<Progress />} />
                    <Route path="/strategy" element={<Strategy />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </Layout>
              )
            } 
          />
        </Routes>
      </Suspense>
    </Router>
  );
}
