import { BiteWordmark } from './components/BiteWordmark';
import { Dashboard } from './features/dashboard/Dashboard';
import { useAuthSession } from './hooks/useAuthSession';
import { LoginPage } from './pages/LoginPage';
import './App.css';

export default function App() {
  const { user, loading, signIn, signOut } = useAuthSession();

  if (loading) {
    return (
      <main className="boot-screen">
        <BiteWordmark />
        <span className="spinner" />
      </main>
    );
  }
  if (!user) return <LoginPage onSignIn={signIn} />;
  return <Dashboard user={user} onSignOut={signOut} />;
}
