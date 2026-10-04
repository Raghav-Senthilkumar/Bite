import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  getCurrentUser,
  signInWithRedirect,
  signOut,
  type AuthUser,
} from 'aws-amplify/auth';

import { apiRequest, type Creator, type Recipe } from './api';
import { authConfigured } from './auth';
import './App.css';

async function findCurrentUser(): Promise<AuthUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.7 4.7 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
      <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#fbbc05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
      <path fill="#ea4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">B</span>
      <span>Bite</span>
    </div>
  );
}

function LoginPage({ onSignIn }: { onSignIn: () => Promise<void> }) {
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
    <main className="login-page">
      <section className="login-copy">
        <Brand />
        <div className="login-message">
          <span className="eyebrow">Your personal recipe shelf</span>
          <h1>Turn the newsletters you love into dinner.</h1>
          <p>
            Follow your favorite Substack cooks. Bite quietly finds their recipes,
            organizes every ingredient, and keeps your collection fresh.
          </p>
          <div className="benefit-row">
            <span>Public posts only</span>
            <span>Updated daily</span>
            <span>Always linked to the source</span>
          </div>
        </div>
        <p className="login-footnote">A calmer way to save what you want to cook.</p>
      </section>
      <section className="login-panel">
        <div className="recipe-art" aria-hidden="true">
          <span className="art-leaf leaf-one" />
          <span className="art-leaf leaf-two" />
          <span className="art-bowl" />
          <span className="art-spoon" />
        </div>
        <div className="signin-card">
          <span className="eyebrow">Welcome to Bite</span>
          <h2>Your recipes are waiting.</h2>
          <p>Sign in to start building a cookbook from your favorite writers.</p>
          <button className="google-button" type="button" onClick={() => void signIn()}>
            <GoogleMark />
            Continue with Google
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!authConfigured && (
            <p className="config-note">Add your Cognito values to <code>.env</code> to enable sign in.</p>
          )}
          <small>By continuing, you agree to use Bite for public recipe content only.</small>
        </div>
      </section>
    </main>
  );
}

function statusSummary(creator: Creator): string {
  const counts = creator.importCounts;
  const working = (counts.QUEUED ?? 0) + (counts.PROCESSING ?? 0);
  if (working) return `${working} processing`;
  if (counts.FAILED) return `${counts.FAILED} need attention`;
  const complete = (counts.COMPLETE ?? 0) + (counts.NO_RECIPE ?? 0);
  return complete ? `${complete} posts checked` : 'Ready to import';
}

function RecipeCard({ recipe, creator, onOpen }: {
  recipe: Recipe;
  creator?: Creator;
  onOpen: () => void;
}) {
  return (
    <article className="recipe-card" onClick={onOpen}>
      <div className="recipe-card-top">
        <span className="source-pill">{creator?.displayName ?? 'Substack recipe'}</span>
        <span className="confidence">{Math.round(recipe.extractionConfidence * 100)}% match</span>
      </div>
      <h3>{recipe.title}</h3>
      <p>{recipe.description || `${recipe.ingredients.length} ingredients from the original post.`}</p>
      <div className="recipe-meta">
        <span>{recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min` : 'Time not listed'}</span>
        <span>{recipe.servings ? `Serves ${recipe.servings}` : 'Servings not listed'}</span>
      </div>
      <button className="text-button" type="button">View recipe <span>→</span></button>
    </article>
  );
}

function RecipeDetail({ recipe, creator, onClose }: {
  recipe: Recipe;
  creator?: Creator;
  onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <article className="recipe-detail" role="dialog" aria-modal="true" aria-label={recipe.title} onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-button" type="button" aria-label="Close recipe" onClick={onClose}>×</button>
        <span className="eyebrow">{creator?.displayName ?? 'Substack recipe'}</span>
        <h2>{recipe.title}</h2>
        {recipe.description && <p className="detail-description">{recipe.description}</p>}
        <div className="detail-columns">
          <section>
            <h3>Ingredients</h3>
            <ul className="ingredient-list">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient.raw}-${index}`}>
                  <strong>{ingredient.name || 'Ingredient'}</strong>
                  {ingredient.raw && ingredient.raw !== ingredient.name && (
                    <span>{ingredient.raw}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Method</h3>
            <ol className="instruction-list">
              {recipe.instructions.map((instruction, index) => (
                <li key={`${instruction}-${index}`}>{instruction}</li>
              ))}
            </ol>
          </section>
        </div>
        <a className="source-link" href={recipe.sourceUrl} target="_blank" rel="noreferrer">Read the original post ↗</a>
      </article>
    </div>
  );
}

function Dashboard({ user, onSignOut }: { user: AuthUser; onSignOut: () => Promise<void> }) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [publication, setPublication] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [creatorData, recipeData] = await Promise.all([
        apiRequest<{ creators: Creator[] }>('/api/creators'),
        apiRequest<{ recipes: Recipe[] }>('/api/recipes'),
      ]);
      setCreators(creatorData.creators);
      setRecipes(recipeData.recipes);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Bite.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    const interval = window.setInterval(() => void loadData(true), 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadData]);

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipes;
    return recipes.filter((recipe) =>
      [recipe.title, recipe.description, ...recipe.tags, ...recipe.ingredients.map((item) => item.name)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [recipes, search]);

  async function addCreator(event: FormEvent) {
    event.preventDefault();
    if (!publication.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/creators', {
        method: 'POST',
        body: JSON.stringify({ url: publication }),
      });
      setPublication('');
      await loadData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add that publication.');
    } finally {
      setSubmitting(false);
    }
  }

  async function checkCreator(creatorId: string) {
    try {
      await apiRequest(`/api/creators/${encodeURIComponent(creatorId)}/check`, { method: 'POST' });
      await loadData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not check this publication.');
    }
  }

  async function removeCreator(creatorId: string) {
    try {
      await apiRequest(`/api/creators/${encodeURIComponent(creatorId)}`, { method: 'DELETE' });
      await loadData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this publication.');
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Primary">
          <a className="nav-item active" href="#recipes"><span>⌂</span> Recipes</a>
          <a className="nav-item" href="#publications"><span>＋</span> Publications</a>
        </nav>
        <div className="sidebar-spacer" />
        <div className="user-block">
          <div className="avatar">{user.username.charAt(0).toUpperCase()}</div>
          <div><strong>{user.signInDetails?.loginId ?? 'Bite cook'}</strong><span>Signed in</span></div>
        </div>
        <button className="signout-button" type="button" onClick={() => void onSignOut()}>Sign out</button>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div><span className="eyebrow">Your cookbook</span><h1>Recipes worth making.</h1></div>
          <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recipes or ingredients" /></label>
        </header>

        {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => setError('')}>×</button></div>}

        <section className="add-publication" id="publications">
          <div><span className="eyebrow">Grow your collection</span><h2>Add a Substack publication</h2><p>Paste a public Substack URL or enter its handle. We’ll check the latest 20 posts.</p></div>
          <form onSubmit={(event) => void addCreator(event)}>
            <input aria-label="Substack publication" value={publication} onChange={(event) => setPublication(event.target.value)} placeholder="e.g. jadsaad.substack.com" />
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Adding…' : 'Add publication'}</button>
          </form>
        </section>

        {creators.length > 0 && (
          <section className="creator-strip" aria-label="Followed publications">
            {creators.map((creator) => (
              <article key={creator.creatorId} className="creator-chip">
                <span className="creator-initial">{creator.displayName.charAt(0)}</span>
                <div><strong>{creator.displayName}</strong><span>{statusSummary(creator)}</span></div>
                <div className="creator-actions">
                  <button type="button" onClick={() => void checkCreator(creator.creatorId)}>Check now</button>
                  <button className="remove-creator" type="button" aria-label={`Remove ${creator.displayName}`} onClick={() => void removeCreator(creator.creatorId)}>Remove</button>
                </div>
              </article>
            ))}
          </section>
        )}

        <section id="recipes" className="recipe-section">
          <div className="section-heading"><div><h2>Latest recipes</h2><p>{filteredRecipes.length} saved from your publications</p></div><button className="refresh-button" type="button" onClick={() => void loadData()}>Refresh</button></div>
          {loading ? (
            <div className="empty-state"><span className="spinner" /><h3>Setting the table…</h3></div>
          ) : filteredRecipes.length ? (
            <div className="recipe-grid">
              {filteredRecipes.map((recipe) => (
                <RecipeCard key={recipe.recipeId} recipe={recipe} creator={creators.find((item) => item.creatorId === recipe.creatorId)} onOpen={() => setSelectedRecipe(recipe)} />
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">⌁</div><h3>{search ? 'No recipes match that search.' : 'Your first recipe starts with a publication.'}</h3><p>{search ? 'Try a title, tag, or ingredient.' : 'Add a public Substack above and Bite will organize any recipes it finds.'}</p></div>
          )}
        </section>
      </main>
      {selectedRecipe && <RecipeDetail recipe={selectedRecipe} creator={creators.find((item) => item.creatorId === selectedRecipe.creatorId)} onClose={() => setSelectedRecipe(null)} />}
    </div>
  );
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
    if (!authConfigured) throw new Error('Cognito is not configured yet.');
    await signInWithRedirect({ provider: 'Google' });
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  if (loading) return <main className="boot-screen"><Brand /><span className="spinner" /></main>;
  if (!user) return <LoginPage onSignIn={handleSignIn} />;
  return <Dashboard user={user} onSignOut={handleSignOut} />;
}
