import { useEffect, useRef, useState } from 'react';

import { BiteWordmark } from './components/BiteWordmark';
import { Dashboard } from './features/dashboard/Dashboard';
import { useAuthSession } from './hooks/useAuthSession';
import { LoginPage } from './pages/LoginPage';
import './App.css';

export default function App() {
  const { user, loading, signIn, signOut } = useAuthSession();
  const [handoff, setHandoff] = useState<'sign-in' | 'sign-out' | null>(null);
  const handoffInProgress = useRef(false);
  const signInFallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [loading, user]);

  useEffect(() => {
    const restorePage = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (signInFallbackTimer.current !== null) {
        window.clearTimeout(signInFallbackTimer.current);
        signInFallbackTimer.current = null;
      }
      setHandoff(null);
      handoffInProgress.current = false;
    };
    window.addEventListener('pageshow', restorePage);
    return () => window.removeEventListener('pageshow', restorePage);
  }, []);

  async function coverPage(direction: 'sign-in' | 'sign-out') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setHandoff(direction);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
  }

  async function handleSignIn() {
    if (handoffInProgress.current) return;
    handoffInProgress.current = true;
    if (signInFallbackTimer.current !== null) window.clearTimeout(signInFallbackTimer.current);

    try {
      await coverPage('sign-in');
      await signIn();
      // The browser normally navigates away. Restore the page if it does not.
      signInFallbackTimer.current = window.setTimeout(() => {
        signInFallbackTimer.current = null;
        setHandoff(null);
        handoffInProgress.current = false;
      }, 10_000);
    } catch (error) {
      setHandoff(null);
      handoffInProgress.current = false;
      throw error;
    }
  }

  async function handleSignOut() {
    if (handoffInProgress.current) return;
    handoffInProgress.current = true;

    try {
      await coverPage('sign-out');
      await signOut();
    } finally {
      setHandoff(null);
      handoffInProgress.current = false;
    }
  }

  const page = !loading && (
    <div className="auth-page-enter" key={user ? 'dashboard' : 'login'} inert={Boolean(handoff)}>
      {user
        ? <Dashboard user={user} onSignOut={handleSignOut} />
        : <LoginPage onSignIn={handleSignIn} />}
    </div>
  );

  return (
    <>
      {page}
      <div
        className={`auth-handoff ${loading || handoff ? 'is-visible' : ''}`}
        aria-hidden={!loading && !handoff}
        role={loading || handoff ? 'status' : undefined}
      >
        <div aria-hidden="true"><BiteWordmark /></div>
        <span className="spinner" aria-hidden="true" />
        <span>{loading ? 'Loading Bite' : handoff === 'sign-out' ? 'Signing out' : 'Signing in'}</span>
      </div>
    </>
  );
}
