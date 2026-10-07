import { useState } from 'react';

import { authConfigured } from '../auth';
import { BiteWordmark } from '../components/BiteWordmark';
import { GoogleMark } from '../components/GoogleMark';

interface LoginPageProps {
  onSignIn: () => Promise<void>;
}

export function LoginPage({ onSignIn }: LoginPageProps) {
  const [error, setError] = useState('');

  async function signIn() {
    setError('');
    try {
      await onSignIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start sign in.');
    }
  }

  return (
    <main className="login-shell">
      <header className="bite-topbar" style={{ width: '100%', padding: '8px 0' }}>
        <span className="menu-trigger">≡ bite.world</span>
        <div className="topbar-actions"><span>Public Substack Recipes</span></div>
      </header>

      <section className="login-center">
        <BiteWordmark />
        <div className="login-card">
          <h2>Bite Dispatch</h2>
          <p>
            Follow your favorite Substack food writers. Bite automatically gathers
            their public recipes, ingredients, and methods in one calm index.
          </p>
          <button className="google-button" type="button" onClick={() => void signIn()}>
            <GoogleMark />
            Continue with Google
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!authConfigured && (
            <p className="form-error">
              Add your Cognito values to <code>.env.local</code> to enable sign in.
            </p>
          )}
        </div>
      </section>

      <div className="filter-bar" style={{ justifyContent: 'center' }}>
        <span className="cabagges-pill footer-pill">Public RSS Only</span>
        <span className="cabagges-pill footer-pill">Updated Daily</span>
        <span className="cabagges-pill footer-pill">Original Post Linked</span>
      </div>
    </main>
  );
}
