/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import { useStore, setupFirebaseSync } from './store/useStore';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { LogIn, Sparkles, LogOut, CheckCircle2, Menu } from 'lucide-react';

export default function App() {
  const yagnas = useStore(state => state.yagnas);
  const currentYagnaId = useStore(state => state.currentYagnaId);
  const user = useStore(state => state.user);
  const setUser = useStore(state => state.setUser);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, [setUser]);

  useEffect(() => {
    if (user) {
      const unsubscribeSync = setupFirebaseSync(user.uid);
      return () => unsubscribeSync();
    } else {
      useStore.getState().setYagnas([]);
    }
  }, [user]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Authentication error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  const currentYagna = yagnas.find(y => y.id === currentYagnaId);

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Initializing Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 text-white px-4">
        <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-md border border-slate-800 p-8 rounded-2xl shadow-2xl text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-orange-300 to-amber-200 bg-clip-text text-transparent">
              Yagna Arch
            </h1>
            <p className="text-sm text-slate-400">
              Interactive Yagna Kund Layout & Material Estimator
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="text-left space-y-3 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Real-time layout generator (11, 21, 51, 108 Kund designs)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Synchronized workspaces across all your authorized devices</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Material requirement calculator & client PDF reports</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold rounded-xl transition-all shadow-lg hover:shadow-amber-500/10"
            >
              {isSigningIn ? (
                <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In with Google</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-sans bg-slate-50 overflow-hidden text-slate-900">
      {isSidebarOpen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with sign out */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-slate-800">Workspace</span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">Cloud Sync Active</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-7 h-7 rounded-full border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-xs text-slate-600 font-medium hidden sm:inline">{user.displayName || user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md font-medium transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {currentYagna ? (
          <Workspace yagna={currentYagna} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50 p-6">
            <div className="max-w-md text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Welcome to Yagna Arch, {user.displayName?.split(' ')[0]}!</h2>
              <p className="text-sm text-slate-500">
                Create a new Yagna project or select an existing one from the sidebar list to get started. All your edits are saved and synced automatically in real-time.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
