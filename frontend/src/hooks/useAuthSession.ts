import { useEffect, useState } from 'react';
import { getCurrentUser, signInWithRedirect, type AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

import { authConfigured, clearSessionAndSignOut } from '../auth';

async function findCurrentUser(): Promise<AuthUser | null> {
  try {
    return await Promise.race([
      getCurrentUser(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500)),
    ]);
  } catch {
    return null;
  }
}

function leaveAuthCallback() {
  if (window.location.pathname === '/auth/callback') {
    window.history.replaceState({}, '', '/');
  }
}

export function useAuthSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const finishSignIn = async () => {
      const currentUser = await findCurrentUser();
      setUser(currentUser);
      setLoading(false);
      if (currentUser) leaveAuthCallback();
    };

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') void finishSignIn();
      if (payload.event === 'signedOut') setUser(null);
    });

    void finishSignIn();
    return unsubscribe;
  }, []);

  async function signIn() {
    if (!authConfigured) throw new Error('Cognito is not configured yet.');
    await signInWithRedirect({ provider: 'Google' });
  }

  async function signOut() {
    setUser(null);
    await clearSessionAndSignOut();
  }

  return { user, loading, signIn, signOut };
}
