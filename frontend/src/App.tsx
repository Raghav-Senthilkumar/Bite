import { useEffect, useState } from 'react';
import {
  getCurrentUser,
  signInWithRedirect,
  signOut,
  type AuthUser,
} from 'aws-amplify/auth';

import { authConfigured } from './auth';

async function findCurrentUser(): Promise<AuthUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void findCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  async function handleSignIn() {
    if (!authConfigured) {
      window.alert('Cognito is not configured yet.');
      return;
    }

    await signInWithRedirect({ provider: 'Google' });
  }

  async function handleSignOut() {
    await signOut();
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return (
      <main>
        <h1>Bite</h1>
        <button onClick={handleSignIn}>
          Continue with Google
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Welcome to Bite</h1>
      <p>Signed in as {user.username}</p>
      <button onClick={handleSignOut}>Sign out</button>
    </main>
  );
}