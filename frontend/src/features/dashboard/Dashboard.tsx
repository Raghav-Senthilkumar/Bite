import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from 'aws-amplify/auth';

import type { Recipe } from '../../api';
import { RecipeDetail } from '../../components/RecipeDetail';
import { useBiteData } from '../../hooks/useBiteData';
import { useRecipeFilters } from '../../hooks/useRecipeFilters';
import { AllRecipesPage } from './AllRecipesPage';
import { DashboardFooter } from './DashboardFooter';
import { DashboardHeader } from './DashboardHeader';
import { DispatchCard } from './DispatchCard';
import { LatestRecipesPage } from './LatestRecipesPage';
import type { DashboardPage } from './types';

interface DashboardProps {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}

export function Dashboard({ user, onSignOut }: DashboardProps) {
  const {
    creators,
    recipes,
    loading,
    submitting,
    error,
    clearError,
    loadData,
    addCreator,
    checkCreator,
    removeCreator,
  } = useBiteData();
  const {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    selectedCreatorId,
    setSelectedCreatorId,
    selectCategory,
    filteredRecipes,
  } = useRecipeFilters(recipes);
  const [publication, setPublication] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(true);
  const [page, setPage] = useState<DashboardPage>(() =>
    window.location.pathname === '/recipes' ? 'all' : 'index',
  );

  useEffect(() => {
    const onPopState = () => {
      setPage(window.location.pathname === '/recipes' ? 'all' : 'index');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPage: DashboardPage) => {
    const targetPath = nextPage === 'all' ? '/recipes' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const category of recipe.categories) {
        const cleaned = category.trim();
        if (cleaned) counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [recipes]);

  const creatorRecipeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      if (recipe.creatorId) {
        counts.set(recipe.creatorId, (counts.get(recipe.creatorId) ?? 0) + 1);
      }
    }
    return counts;
  }, [recipes]);

  async function handleAddCreator() {
    if (await addCreator(publication)) setPublication('');
  }

  async function handleRemoveCreator(creatorId: string) {
    if (await removeCreator(creatorId)) {
      setSelectedCreatorId((current) => current === creatorId ? null : current);
    }
  }

  const latestRecipes = useMemo(
    () => filteredRecipes.slice(0, 10),
    [filteredRecipes],
  );

  return (
    <div>
      <DashboardHeader
        user={user}
        page={page}
        menuOpen={menuOpen}
        searchOpen={searchOpen}
        search={search}
        creators={creators}
        recipes={recipes}
        categories={categories}
        selectedCategory={selectedCategory}
        selectedCreatorId={selectedCreatorId}
        onToggleMenu={() => setMenuOpen((current) => !current)}
        onCloseMenu={() => setMenuOpen(false)}
        onToggleSearch={() => setSearchOpen((current) => !current)}
        onCloseSearch={() => setSearchOpen(false)}
        onSearchChange={setSearch}
        onNavigate={navigate}
        onSelectCategory={selectCategory}
        onClearCategory={() => setSelectedCategory(null)}
        onSelectCreator={setSelectedCreatorId}
        onOpenDispatch={() => setDispatchOpen(true)}
        onRefresh={() => void loadData()}
        onSelectRecipe={setSelectedRecipe}
        onSignOut={onSignOut}
      />

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError}>×</button>
        </div>
      )}

      {page === 'index' ? (
        <LatestRecipesPage
          creators={creators}
          recipes={latestRecipes}
          loading={loading}
          search={search}
          selectedCategory={selectedCategory}
          selectedCreatorId={selectedCreatorId}
          onClearSearch={() => setSearch('')}
          onClearCategory={() => setSelectedCategory(null)}
          onClearCreator={() => setSelectedCreatorId(null)}
          onSelectCategory={selectCategory}
          onSelectRecipe={setSelectedRecipe}
          onSeeAll={() => navigate('all')}
        />
      ) : (
        <AllRecipesPage
          creators={creators}
          recipes={filteredRecipes}
          totalRecipeCount={recipes.length}
          creatorRecipeCounts={creatorRecipeCounts}
          loading={loading}
          search={search}
          selectedCategory={selectedCategory}
          selectedCreatorId={selectedCreatorId}
          onBack={() => navigate('index')}
          onClearSearch={() => setSearch('')}
          onClearCategory={() => setSelectedCategory(null)}
          onSelectCreator={setSelectedCreatorId}
          onSelectRecipe={setSelectedRecipe}
        />
      )}

      <DashboardFooter
        creators={creators}
        categories={categories}
        selectedCategory={selectedCategory}
        selectedCreatorId={selectedCreatorId}
        publication={publication}
        submitting={submitting}
        onResetFilters={() => {
          setSelectedCategory(null);
          setSelectedCreatorId(null);
        }}
        onSelectCategory={selectCategory}
        onSelectCreator={setSelectedCreatorId}
        onCheckCreator={(creatorId) => void checkCreator(creatorId)}
        onRemoveCreator={(creatorId) => void handleRemoveCreator(creatorId)}
        onRefresh={() => void loadData()}
        onPublicationChange={setPublication}
        onAddCreator={() => void handleAddCreator()}
        onSignOut={onSignOut}
      />

      <DispatchCard
        open={dispatchOpen}
        publication={publication}
        submitting={submitting}
        onOpen={() => setDispatchOpen(true)}
        onClose={() => setDispatchOpen(false)}
        onPublicationChange={setPublication}
        onSubmit={() => void handleAddCreator()}
      />

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          creator={creators.find((creator) => creator.creatorId === selectedRecipe.creatorId)}
          onClose={() => setSelectedRecipe(null)}
          onSelectCategory={selectCategory}
        />
      )}
    </div>
  );
}
