import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  getCurrentUser,
  signInWithRedirect,
  type AuthUser,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

import {
  apiRequest,
  getFallbackRecipeImage,
  getRecipeImageFromGuid,
  normalizeRecipe,
  type Creator,
  type Recipe,
} from './api';
import { authConfigured, clearSessionAndSignOut } from './auth';
import { RecipeCardRow } from './components/RecipeCardRow';
import './App.css';

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

function BiteWordmark() {
  return (
    <svg
      className="bite-wordmark-svg"
      viewBox="0 0 760 220"
      aria-label="bite"
      role="img"
    >
      <text
        x="50%"
        y="165"
        textAnchor="middle"
        fill="#00A859"
        fontFamily="'Fredoka', 'DM Sans', sans-serif"
        fontWeight="700"
        fontSize="188"
        letterSpacing="-8"
      >
        bite
      </text>
      <text
        x="50%"
        y="165"
        textAnchor="middle"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeDasharray="18 28"
        strokeLinecap="round"
        fontFamily="'Fredoka', 'DM Sans', sans-serif"
        fontWeight="700"
        fontSize="188"
        letterSpacing="-8"
        opacity="0.82"
      >
        bite
      </text>
    </svg>
  );
}

function statusSummary(creator: Creator): string {
  const counts = creator.importCounts ?? {};
  const working = (counts.QUEUED ?? 0) + (counts.PROCESSING ?? 0);
  if (working) return `${working} processing`;
  if (counts.FAILED) return `${counts.FAILED} need attention`;
  const complete = (counts.COMPLETE ?? 0) + (counts.NO_RECIPE ?? 0);
  return complete ? `${complete} posts checked` : 'Ready to import';
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
    <main className="login-shell">
      <header className="bite-topbar" style={{ width: '100%', padding: '8px 0' }}>
        <span className="menu-trigger">≡ bite.world</span>
        <div className="topbar-actions">
          <span>Public Substack Recipes</span>
        </div>
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

function RecipeDetail({
  recipe,
  creator,
  onClose,
  onSelectCategory,
}: {
  recipe: Recipe;
  creator?: Creator;
  onClose: () => void;
  onSelectCategory: (category: string) => void;
}) {
  const imageSrc = recipe.image || getRecipeImageFromGuid(recipe.guid, recipe.id);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <article
        className="recipe-detail"
        role="dialog"
        aria-modal="true"
        aria-label={recipe.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close-button" type="button" aria-label="Close recipe" onClick={onClose}>
          ×
        </button>

        <div className="detail-header-grid">
          <div className="detail-cover">
            <img
              src={imageSrc}
              alt={recipe.title}
              onError={(event) => {
                const fallback = getFallbackRecipeImage(recipe.guid || recipe.id);
                if (event.currentTarget.src !== fallback) {
                  event.currentTarget.src = fallback;
                }
              }}
            />
          </div>
          <div>
            <div className="detail-meta-pills">
              <span className="cabagges-pill solid-green py-2 px-4 text-xs">
                {creator?.displayName ?? 'Substack Recipe'}
              </span>
              {recipe.cookTimeMinutes && (
                <span className="cabagges-pill py-2 px-4 text-xs">
                  {recipe.cookTimeMinutes} min
                </span>
              )}
              {recipe.servings && (
                <span className="cabagges-pill py-2 px-4 text-xs">
                  Serves {recipe.servings}
                </span>
              )}
              {recipe.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat);
                    onClose();
                  }}
                  className="cabagges-pill py-2 px-4 text-xs cursor-pointer"
                >
                  {cat}
                </button>
              ))}
            </div>
            <h2>{recipe.title}</h2>
            {recipe.description && (
              <p className="detail-description">{recipe.description}</p>
            )}
            <a
              className="cabagges-pill py-2.5 px-4 text-xs font-medium gap-1.5"
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>Read Original Substack Post</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="detail-columns">
          <section>
            <h3>Ingredients ({recipe.ingredients.length})</h3>
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
      </article>
    </div>
  );
}

function Dashboard({ user, onSignOut }: { user: AuthUser; onSignOut: () => Promise<void> }) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [publication, setPublication] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [creatorData, recipeData] = await Promise.all([
        apiRequest<{ creators: Creator[] }>('/api/creators'),
        apiRequest<{ recipes: Array<Partial<Recipe> & { recipeId: string; title: string }> }>('/api/recipes'),
      ]);
      setCreators(creatorData.creators);
      setRecipes(recipeData.recipes.map((item) => normalizeRecipe(item)));
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

  const allCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const category of recipe.categories) {
        const cleaned = category.trim();
        if (cleaned) counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (selectedCreatorId && recipe.creatorId !== selectedCreatorId) {
        return false;
      }
      if (
        selectedCategory &&
        !recipe.categories.some((cat) => cat.toLowerCase() === selectedCategory.toLowerCase())
      ) {
        return false;
      }
      if (!query) return true;
      return [
        recipe.title,
        recipe.description,
        ...recipe.categories,
        ...recipe.ingredients.map((item) => item.name),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [recipes, search, selectedCategory, selectedCreatorId]);

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
      if (selectedCreatorId === creatorId) setSelectedCreatorId(null);
      await loadData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this publication.');
    }
  }

  const handleSelectCategory = useCallback((category: string) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
  }, []);

  const handleSeeAll = useCallback(() => {
    setSelectedCategory(null);
    setSelectedCreatorId(null);
    setShowAllGrid((prev) => !prev);
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const latestRecipes = useMemo(() => filteredRecipes.slice(0, 10), [filteredRecipes]);

  return (
    <div>
      {/* Backdrop overlay for smoothly closing the navbar drawer */}
      <div
        className={`nav-backdrop ${menuOpen ? 'is-open' : ''}`}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />

      {/* Sticky Minimal Topbar + Smooth Expandable Drawer */}
      <div className={`bite-header-wrap ${menuOpen ? 'drawer-open' : ''}`}>
        <header className="bite-topbar">
          <button
            type="button"
            className={`menu-trigger ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
          >
            <span className={`menu-icon-bars ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">
              <span />
              <span />
            </span>
            <span>bite.world</span>
          </button>

          <div className="topbar-actions">
            <div className={`search-shell ${searchOpen || Boolean(search) ? 'is-open' : ''}`}>
              <button
                type="button"
                className="topbar-link search-toggle-btn"
                onClick={() => setSearchOpen((prev) => !prev)}
                aria-expanded={searchOpen}
              >
                Search
              </button>
              <label className="search-inline">
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search recipes, ingredients..."
                  tabIndex={searchOpen || Boolean(search) ? 0 : -1}
                />
                <button
                  type="button"
                  aria-label="Clear search"
                  tabIndex={searchOpen || Boolean(search) ? 0 : -1}
                  onClick={() => {
                    setSearch('');
                    setSearchOpen(false);
                  }}
                >
                  ×
                </button>
              </label>
            </div>
            <button
              type="button"
              className={`topbar-link ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              Publications ({creators.length})
            </button>
            <button type="button" className="topbar-link" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        </header>

        <nav
          className={`nav-drawer ${menuOpen ? 'is-open' : ''}`}
          aria-label="Bite directory"
          aria-hidden={!menuOpen}
        >
          <div className="nav-drawer-clip">
            <div className="nav-drawer-inner">
              <div className="drawer-col">
                <h4>Recipes</h4>
                <div className="drawer-list">
                  <button
                    type="button"
                    className={`drawer-item ${!selectedCategory ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(null);
                      setMenuOpen(false);
                    }}
                  >
                    Popular
                  </button>
                  {(allCategories.length ? allCategories.slice(0, 6) : ['Dinner', 'Lunch', 'Noodles', 'Quick']).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`drawer-item ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => {
                          handleSelectCategory(cat);
                          setMenuOpen(false);
                        }}
                      >
                        {cat}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="drawer-item"
                    onClick={() => {
                      setShowAllGrid(true);
                      setMenuOpen(false);
                    }}
                  >
                    All ({recipes.length})
                  </button>
                </div>
              </div>

              <div className="drawer-col">
                <h4>Publications</h4>
                <div className="drawer-list">
                  <button
                    type="button"
                    className={`drawer-item ${!selectedCreatorId ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCreatorId(null);
                      setMenuOpen(false);
                    }}
                  >
                    All Writers
                  </button>
                  {creators.map((creator) => (
                    <button
                      key={creator.creatorId}
                      type="button"
                      className={`drawer-item ${selectedCreatorId === creator.creatorId ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCreatorId((prev) =>
                          prev === creator.creatorId ? null : creator.creatorId,
                        );
                        setMenuOpen(false);
                      }}
                    >
                      {creator.displayName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-col">
                <h4>World</h4>
                <div className="drawer-list">
                  <button
                    type="button"
                    className="drawer-item"
                    onClick={() => {
                      setDispatchOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    Add Substack
                  </button>
                  <button
                    type="button"
                    className="drawer-item"
                    onClick={() => {
                      void loadData();
                      setMenuOpen(false);
                    }}
                  >
                    Refresh Feed
                  </button>
                </div>

                <div className="drawer-sub-section">
                  <h4>Signed In</h4>
                  <div className="drawer-list">
                    <span className="drawer-item" style={{ fontSize: '16px' }}>
                      {user.signInDetails?.loginId ?? user.username}
                    </span>
                    <button
                      type="button"
                      className="drawer-item"
                      style={{ fontSize: '18px' }}
                      onClick={() => void onSignOut()}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>

              <div className="drawer-cards">
                {recipes.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className="drawer-feature-card"
                    onClick={() => {
                      setSelectedRecipe(item);
                      setMenuOpen(false);
                    }}
                  >
                    <div className="drawer-feature-img">
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="eager"
                        decoding="async"
                        onError={(event) => {
                          const fallback = getFallbackRecipeImage(item.guid || item.id);
                          if (event.currentTarget.src !== fallback) {
                            event.currentTarget.src = fallback;
                          }
                        }}
                      />
                    </div>
                    <span className="cabagges-pill py-2 px-4 text-xs" style={{ alignSelf: 'flex-start' }}>
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Hero Wordmark */}
      <section className="hero-wordmark-section">
        <BiteWordmark />
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Active Category / Publication Filter Pills */}
      {(selectedCategory || selectedCreatorId || search) && (
        <div className="filter-bar">
          {selectedCategory && (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5"
            >
              <span>Category: {selectedCategory}</span>
              <span>×</span>
            </button>
          )}
          {selectedCreatorId && (
            <button
              type="button"
              onClick={() => setSelectedCreatorId(null)}
              className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5"
            >
              <span>
                Publication:{' '}
                {creators.find((c) => c.creatorId === selectedCreatorId)?.displayName ?? 'Selected'}
              </span>
              <span>×</span>
            </button>
          )}
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5"
            >
              <span>Search: {search}</span>
              <span>×</span>
            </button>
          )}
        </div>
      )}

      {/* Recipe Index with Latest 10 Recipes */}
      {loading ? (
        <div className="empty-cookbook">
          <span className="spinner" />
          <h3>Setting the table...</h3>
        </div>
      ) : latestRecipes.length > 0 ? (
        <RecipeCardRow
          title={selectedCategory ? `${selectedCategory} Recipes` : 'Latest Recipes'}
          recipes={latestRecipes}
          onSelectRecipe={(recipe) => setSelectedRecipe(recipe)}
          onSelectCategory={handleSelectCategory}
          onSeeAll={handleSeeAll}
        />
      ) : (
        <div className="empty-cookbook">
          <h3>
            {search || selectedCategory || selectedCreatorId
              ? 'No recipes match that filter.'
              : 'Your cookbook starts with a Substack publication.'}
          </h3>
          <p>
            {search || selectedCategory || selectedCreatorId
              ? 'Clear your active filter or try another ingredient.'
              : 'Use the Bite Dispatch card or the footer below to add a public Substack URL (e.g. jadsaad.substack.com).'}
          </p>
        </div>
      )}

      {/* Optional "See All" Full Grid */}
      {showAllGrid && filteredRecipes.length > 0 && (
        <section className="all-recipes-section">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-normal tracking-tight text-[#2E2E2E]">
              All Recipes ({filteredRecipes.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowAllGrid(false)}
              className="cabagges-pill py-2 px-4 text-xs"
            >
              Collapse
            </button>
          </div>
          <div className="all-recipes-grid">
            {filteredRecipes.map((recipe) => (
              <article
                key={`grid-${recipe.id}`}
                onClick={() => setSelectedRecipe(recipe)}
                className="flex flex-col gap-y-3 group cursor-pointer"
              >
                <div className="recipe-card-photo-frame relative w-full aspect-[4/5] bg-[#EAF7EE] rounded-[20px] overflow-hidden">
                  <img
                    src={recipe.image || getRecipeImageFromGuid(recipe.guid, recipe.id)}
                    alt={recipe.title}
                    loading="eager"
                    decoding="async"
                    onError={(event) => {
                      const fallback = getFallbackRecipeImage(recipe.guid || recipe.id);
                      if (event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      }
                    }}
                    className="recipe-card-photo w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-y-1 text-sm pt-1">
                  <h3 className="text-base font-normal tracking-tight text-[#2E2E2E] group-hover:text-[#00A859] transition-colors leading-tight">
                    {recipe.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Footer Pill Index & Substack Dispatch (Screenshot 1) */}
      <footer className="bite-footer">
        <div className="footer-pill-columns">
          <div className="footer-col">
            <span className="footer-col-label">Recipes</span>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setSelectedCreatorId(null);
              }}
              className={`cabagges-pill footer-pill ${!selectedCategory ? 'active-pill' : ''}`}
            >
              Recipe Index
            </button>
            {(allCategories.length ? allCategories : ['Popular', 'Dinner', 'Lunch', 'Noodles']).map(
              (cat) => (
                <button
                  key={`footer-${cat}`}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`cabagges-pill footer-pill ${
                    selectedCategory === cat ? 'active-pill' : ''
                  }`}
                >
                  {cat}
                </button>
              ),
            )}
          </div>

          <div className="footer-col">
            <span className="footer-col-label">Publications</span>
            {creators.length === 0 ? (
              <span className="cabagges-pill footer-pill">None yet</span>
            ) : (
              creators.map((creator) => (
                <button
                  key={`footer-creator-${creator.creatorId}`}
                  type="button"
                  onClick={() =>
                    setSelectedCreatorId((prev) =>
                      prev === creator.creatorId ? null : creator.creatorId,
                    )
                  }
                  className={`cabagges-pill footer-pill ${
                    selectedCreatorId === creator.creatorId ? 'active-pill' : ''
                  }`}
                >
                  {creator.displayName}
                </button>
              ))
            )}
          </div>

          <div className="footer-col">
            <span className="footer-col-label">Sync Status</span>
            {creators.map((creator) => (
              <button
                key={`status-${creator.creatorId}`}
                type="button"
                onClick={() => void checkCreator(creator.creatorId)}
                title="Click to check for new posts"
                className="cabagges-pill footer-pill"
              >
                {creator.displayName.split(' ')[0]}: {statusSummary(creator)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadData()}
              className="cabagges-pill footer-pill"
            >
              Refresh All
            </button>
          </div>

          <div className="footer-col">
            <span className="footer-col-label">Manage</span>
            {creators.map((creator) => (
              <button
                key={`remove-${creator.creatorId}`}
                type="button"
                onClick={() => void removeCreator(creator.creatorId)}
                className="cabagges-pill footer-pill"
              >
                Unfollow {creator.displayName.split(' ')[0]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="cabagges-pill footer-pill"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="footer-dispatch-col">
          <h4>Bite Dispatch</h4>
          <p>
            Follow a public Substack publication by URL or handle. Bite checks the
            latest 20 posts and extracts structured recipes automatically.
          </p>
          <form className="dispatch-input-bar" onSubmit={(event) => void addCreator(event)}>
            <input
              aria-label="Substack publication"
              value={publication}
              onChange={(event) => setPublication(event.target.value)}
              placeholder="e.g. jadsaad.substack.com"
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      </footer>

      {/* Floating Tilted Lime-Green Card (Screenshot 1–5 Bottom-Left) */}
      {dispatchOpen ? (
        <aside className="floating-dispatch-card" aria-label="Add Substack publication">
          <button
            type="button"
            className="floating-dispatch-close"
            aria-label="Dismiss card"
            onClick={() => setDispatchOpen(false)}
          >
            ×
          </button>
          <h3>Bite Dispatch</h3>
          <p>
            Paste a public Substack URL or handle to import new recipes, ingredients,
            and cooking steps into your shelf!
          </p>
          <form className="dispatch-input-bar" onSubmit={(event) => void addCreator(event)}>
            <input
              aria-label="Substack URL or handle"
              value={publication}
              onChange={(event) => setPublication(event.target.value)}
              placeholder="Substack handle or URL"
            />
            <button type="submit" disabled={submitting}>
              {submitting ? '...' : 'Add'}
            </button>
          </form>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setDispatchOpen(true)}
          className="cabagges-pill py-2.5 px-4 text-xs font-medium floating-dispatch-reopen"
        >
          + Bite Dispatch
        </button>
      )}

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          creator={creators.find((item) => item.creatorId === selectedRecipe.creatorId)}
          onClose={() => setSelectedRecipe(null)}
          onSelectCategory={handleSelectCategory}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        void findCurrentUser().then((currentUser) => {
          setUser(currentUser);
          setLoading(false);
          if (window.location.pathname === '/auth/callback') {
            window.history.replaceState({}, '', '/');
          }
        });
      } else if (payload.event === 'signedOut') {
        setUser(null);
      }
    });

    void findCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser && window.location.pathname === '/auth/callback') {
        window.history.replaceState({}, '', '/');
      }
    });

    return unsubscribe;
  }, []);

  async function handleSignIn() {
    if (!authConfigured) throw new Error('Cognito is not configured yet.');
    await signInWithRedirect({ provider: 'Google' });
  }

  async function handleSignOut() {
    setUser(null);
    await clearSessionAndSignOut();
  }

  if (loading) {
    return (
      <main className="boot-screen">
        <BiteWordmark />
        <span className="spinner" />
      </main>
    );
  }
  if (!user) return <LoginPage onSignIn={handleSignIn} />;
  return <Dashboard user={user} onSignOut={handleSignOut} />;
}
