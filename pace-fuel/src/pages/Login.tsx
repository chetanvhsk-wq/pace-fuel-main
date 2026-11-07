import React from 'react';
import { motion } from 'motion/react';
import { LogIn, Zap, Target, Activity, Trophy, UserCircle, Mail, KeyRound, Wifi } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, isNativePlatform } from '../firebase';
import { signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { clearGeminiApiKey, getConfiguredGeminiApiKey, getGeminiApiKeyValidationError, getGeminiKeySource, saveGeminiApiKey } from '../lib/runtimeConfig';

const features = [
  { icon: Zap, text: "Metabolic Precision", sub: "Fueling tailored to your specific training load." },
  { icon: Target, text: "Macro Optimization", sub: "Dynamic targets that shift with your goals." },
  { icon: Activity, text: "Real-time Recovery", sub: "Track hydration and mindset for peak output." }
];

export default function Login() {
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = React.useState('');
  const [geminiStatus, setGeminiStatus] = React.useState<string | null>(null);
  const [geminiKeySource, setGeminiKeySource] = React.useState(getGeminiKeySource());

  React.useEffect(() => {
    if (getGeminiKeySource() === 'stored') {
      setGeminiKeyInput(getConfiguredGeminiApiKey());
    }
  }, []);

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
    setGeminiStatus(geminiKeyInput.trim() ? 'Gemini key saved on this device. AI search and chat can use live responses now.' : 'Stored Gemini key removed. The app will use bundled config or offline mode.');
  };

  const handleClearGeminiKey = () => {
    clearGeminiApiKey();
    refreshGeminiKeyState();
    setGeminiStatus('Stored Gemini key removed. The app will use bundled config or offline mode.');
  };

  const getAuthErrorMessage = (error: any, fallback: string) => {
    switch (error?.code) {
      case 'auth/operation-not-allowed':
        return "This Firebase project does not have that login method enabled. Turn on Email/Password or Anonymous in Firebase Console > Authentication > Sign-in method.";
      case 'auth/network-request-failed':
        return "Network request failed. Check the device connection and try again.";
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/invalid-login-credentials':
        return "Those login credentials were rejected. Check the email and password and try again.";
      case 'auth/user-not-found':
        return "No account was found with that email. Use Sign Up to create it first.";
      case 'auth/email-already-in-use':
        return "That email already has an account. Switch to Sign In instead.";
      case 'auth/too-many-requests':
        return "Firebase temporarily blocked more attempts from this device. Wait a moment and try again.";
      default:
        return error?.message || fallback;
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    try {
      setError(null);
      setIsLoading(true);
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Email auth failed:", error);
      setError(getAuthErrorMessage(error, "Authentication failed."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setError(null);
      setIsLoading(true);
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error("Guest login failed:", error);
      setError(getAuthErrorMessage(error, "Failed to sign in as guest."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (isNativePlatform) {
      setError("Google popup sign-in is not supported inside the Android APK yet. Use Email/Password or Guest login for Firebase access.");
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized for Firebase Auth. Please add it in the Firebase Console under Authentication > Settings > Authorized domains.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError("Login popup was closed before completing. Please try again.");
      } else {
        setError(getAuthErrorMessage(error, "Failed to sign in with Google. Please try again."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">
      {/* Left Side: Visual & Brand */}
      <div className="relative w-full md:w-1/2 h-[30vh] md:h-screen bg-[#111] overflow-hidden shrink-0">
        <motion.div 
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img 
            src="https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=1200" 
            alt="Elite Fueling" 
            className="w-full h-full object-cover opacity-70 grayscale-[0.2]"
            referrerPolicy="no-referrer"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/40 to-transparent" />
        </motion.div>

        <div className="absolute inset-0 p-6 md:p-16 flex flex-col justify-end">
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <img
              src="/app-logo.png"
              alt="Pace Fuel logo"
              className="mb-4 h-16 w-16 rounded-[1.35rem] object-cover border border-white/20 shadow-2xl shadow-black/40 md:mb-6 md:h-20 md:w-20"
            />
            <p className="font-label text-primary text-[10px] md:text-sm font-bold uppercase tracking-[0.4em] mb-2 md:mb-4">
              The Athlete's Edge
            </p>
            <h1 className="font-headline text-5xl md:text-8xl font-black text-white italic leading-[0.85] tracking-tighter mb-4 md:mb-8">
              PACE<br />FUEL
            </h1>
            <div className="flex items-center gap-3 md:gap-4 text-white/80 font-body text-xs md:text-base bg-white/10 backdrop-blur-md p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/10 w-fit">
              <Trophy className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
              <span className="font-medium">Optimized for 10,000+ Elite Athletes</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side: Action & Features */}
      <div className="w-full md:w-1/2 flex flex-col justify-center p-6 md:p-24 bg-background relative overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-8 md:space-y-12 z-10">
          <div className="space-y-2 md:space-y-3">
            <h2 className="font-headline text-3xl md:text-4xl font-black text-on-surface tracking-tight">
              Start Your Engine
            </h2>
            <p className="text-outline font-body text-base md:text-lg">
              Join the elite community of athletes fueling for peak performance.
            </p>
          </div>

          <div className="space-y-4 md:space-y-6">
            {features.map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex gap-4 md:gap-5 group items-start"
              >
                <div className="p-3 md:p-4 bg-surface-container rounded-xl md:rounded-2xl text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors duration-300 shadow-sm shrink-0">
                  <feature.icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="pt-1">
                  <p className="font-headline font-bold text-on-surface text-base md:text-lg">{feature.text}</p>
                  <p className="text-xs md:text-sm text-outline font-body leading-relaxed mt-1">{feature.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="pt-6 md:pt-8 space-y-4 border-t border-surface-container pb-8 md:pb-0"
          >
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-body text-center shadow-sm">
                {error}
              </div>
            )}

            <div className="p-4 rounded-2xl border border-surface-container bg-surface-container-low space-y-3">
              <div className="flex items-start gap-3">
                <Wifi className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-headline font-bold text-on-surface text-sm">Online Setup</p>
                  <p className="text-xs text-outline font-body leading-relaxed">
                    Firebase login in the APK works best with `Email/Password` or `Anonymous` enabled in Firebase Console. Google popup login is web-only for now.
                  </p>
                  <p className="text-xs text-outline font-body leading-relaxed">
                    Gemini AI needs a real Gemini API key to answer online. `APP_URL` is not needed for the Android APK, and example text like `MY_GEMINI_API_KEY` will not work.
                  </p>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-primary">
                AI Status: {geminiKeySource === 'stored' ? 'Stored On Device' : geminiKeySource === 'bundled' ? 'Bundled In Build' : 'Offline Fallback'}
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

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <input 
                type="email" 
                placeholder="Email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-2xl bg-surface-container-low border border-surface-container focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body text-on-surface"
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-2xl bg-surface-container-low border border-surface-container focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body text-on-surface"
              />
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-on-primary font-headline font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:opacity-90 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span className="text-lg">{isSignUp ? "Create Account" : "Sign In with Email"}</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center">
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-outline hover:text-primary transition-colors font-bold uppercase tracking-wider"
              >
                {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-surface-container"></div>
              <span className="flex-shrink-0 mx-4 text-outline text-[10px] uppercase tracking-widest font-bold">Or</span>
              <div className="flex-grow border-t border-surface-container"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleLogin}
                disabled={isLoading || isNativePlatform}
                className="w-full bg-on-surface text-white font-headline font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:bg-primary hover:shadow-primary/20 transition-all duration-300 group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                <span className="text-sm">{isNativePlatform ? 'Google (Web)' : 'Google'}</span>
              </button>

              <button 
                onClick={handleGuestLogin}
                disabled={isLoading}
                className="w-full bg-transparent border-2 border-surface-container text-on-surface font-headline font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-surface-container transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <UserCircle className="w-4 h-4" />
                <span className="text-sm">Guest</span>
              </button>
            </div>

            <p className="text-[10px] text-center mt-6 text-outline font-label uppercase tracking-widest font-bold">
              Secure Athlete Authentication
            </p>
          </motion.div>
        </div>

        {/* Decorative Element */}
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none hidden md:block">
          <Zap className="w-96 h-96 text-primary" />
        </div>
      </div>
    </div>
  );
}
