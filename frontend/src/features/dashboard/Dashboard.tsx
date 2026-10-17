import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AuthUser } from 'aws-amplify/auth';

import type { Recipe } from '../../api';
import { RecipeDetail } from '../../components/RecipeDetail';
import { useBiteData } from '../../hooks/useBiteData';
import { useRecipeFilters } from '../../hooks/useRecipeFilters';
import { AllRecipesPage } from './AllRecipesPage';
import { CreatorImportStatus } from './CreatorImportStatus';
import { DashboardFooter } from './DashboardFooter';
import { DashboardHeader } from './DashboardHeader';
import { DispatchCard } from './DispatchCard';
import { LatestRecipesPage } from './LatestRecipesPage';
import { PublicationsPage } from './PublicationsPage';
import type { DashboardPage } from './types';

interface DashboardProps {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}

const PAGE_PATHS: Record<DashboardPage, string> = {
  index: '/',
  all: '/recipes',
  publications: '/publications',
};

function pageFromPath(pathname: string): DashboardPage {
  if (pathname === '/recipes') return 'all';
  if (pathname === '/publications') return 'publications';
  return 'index';
}

export function Dashboard({ user, onSignOut }: DashboardProps) {
  const {
    creators,
    recipes,
    loading,
    submitting,
    error,
    importProgress,
    clearError,
    dismissImport,
    addCreator,
    removeCreator,
  } = useBiteData();
  const latestFilters = useRecipeFilters(recipes);
  const allFilters = useRecipeFilters(recipes);
  const [page, setPage] = useState<DashboardPage>(() => pageFromPath(window.location.pathname));
  const {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    selectedCreatorId,
    setSelectedCreatorId,
    selectCategory,
    filteredRecipes,
  } = page === 'index' ? latestFilters : allFilters;
  const [publication, setPublication] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [leavingPage, setLeavingPage] = useState(false);
  const pageTransitionTimer = useRef<number | null>(null);
  const lockedScrollY = useRef(0);
  const importBannerRef = useRef<HTMLDivElement>(null);
  const [headerSpring, setHeaderSpring] = useState(false);
  const [leavingImport, setLeavingImport] = useState(false);

  useEffect(() => {
    if (importProgress?.phase !== 'connecting') return;
    importBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [importProgress?.phase]);

  useEffect(() => {
    const locked = menuOpen || selectedRecipe !== null;
    if (!locked) return;

    const body = document.body;
    const scrollY = window.scrollY;
    lockedScrollY.current = scrollY;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;
    document.documentElement.style.setProperty('--scrollbar-gap', `${scrollbarGap}px`);

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.paddingRight = previous.paddingRight;
      document.documentElement.style.removeProperty('--scrollbar-gap');
      window.scrollTo({ top: lockedScrollY.current, left: 0, behavior: 'instant' });
    };
  }, [menuOpen, selectedRecipe]);

  const showPage = useCallback((nextPage: DashboardPage) => {
    if (pageTransitionTimer.current !== null) {
      window.clearTimeout(pageTransitionTimer.current);
      pageTransitionTimer.current = null;
    }
    lockedScrollY.current = 0;
    if (nextPage === page) {
      setLeavingPage(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const finishNavigation = () => {
      flushSync(() => {
        setPage(nextPage);
        setLeavingPage(false);
        if (nextPage === 'publications') setSearchOpen(false);
      });
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishNavigation();
      return;
    }

    setLeavingPage(true);
    pageTransitionTimer.current = window.setTimeout(() => {
      pageTransitionTimer.current = null;
      finishNavigation();
    }, 180);
  }, [page]);

  useEffect(() => () => {
    if (pageTransitionTimer.current !== null) {
      window.clearTimeout(pageTransitionTimer.current);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      showPage(pageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [showPage]);

  const navigate = useCallback((nextPage: DashboardPage) => {
    const targetPath = PAGE_PATHS[nextPage];
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    showPage(nextPage);
  }, [showPage]);

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

  function handleDismissImport() {
    if (leavingImport) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      dismissImport();
      return;
    }
    setLeavingImport(true);
    setHeaderSpring(true);
    window.setTimeout(() => {
      dismissImport();
      setLeavingImport(false);
    }, 520);
    window.setTimeout(() => setHeaderSpring(false), 760);
  }

  async function handleAddCreator(publication: string) {
    return addCreator(publication);
  }

  async function handleQuickAddCreator() {
    if (await addCreator(publication)) setPublication('');
  }

  async function handleRemoveCreator(creatorId: string) {
    const removed = await removeCreator(creatorId);
    if (removed) {
      latestFilters.setSelectedCreatorId((current) => current === creatorId ? null : current);
      allFilters.setSelectedCreatorId((current) => current === creatorId ? null : current);
    }
    return removed;
  }

  function handleViewCreatorRecipes(creatorId: string) {
    allFilters.setSearch('');
    allFilters.setSelectedCategory(null);
    allFilters.setSelectedCreatorId(creatorId);
    navigate('all');
  }

  function browseAllRecipes() {
    allFilters.setSearch('');
    allFilters.setSelectedCategory(null);
    allFilters.setSelectedCreatorId(null);
    navigate('all');
  }

  function browseCategory(category: string) {
    allFilters.setSearch('');
    allFilters.setSelectedCategory(category);
    allFilters.setSelectedCreatorId(null);
    navigate('all');
  }

  function browseCreator(creatorId: string) {
    allFilters.setSearch('');
    allFilters.setSelectedCategory(null);
    allFilters.setSelectedCreatorId(creatorId);
    navigate('all');
  }

  const handleCloseRecipe = useCallback(() => {
    setSelectedRecipe(null);
  }, []);

  const latestRecipes = useMemo(
    () => latestFilters.filteredRecipes.slice(0, 10),
    [latestFilters.filteredRecipes],
  );

  return (
    <div className={leavingPage ? 'page-is-leaving' : undefined}>
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
        onSelectCategory={(category) => {
          if (page === 'publications') {
            allFilters.selectCategory(category);
            navigate('all');
          } else {
            selectCategory(category);
          }
        }}
        onClearCategory={() => setSelectedCategory(null)}
        onSelectCreator={(creatorId) => {
          if (page === 'publications') {
            allFilters.setSelectedCreatorId(creatorId);
            navigate('all');
          } else {
            setSelectedCreatorId(creatorId);
          }
        }}
        onOpenDispatch={() => setDispatchOpen(true)}
        onSelectRecipe={setSelectedRecipe}
        onSignOut={onSignOut}
        spring={headerSpring}
      />

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError}>×</button>
        </div>
      )}

      {importProgress && (
        <div
          ref={importBannerRef}
          className={`import-banner-anchor ${leavingImport ? 'is-leaving' : ''}`}
        >
          <CreatorImportStatus progress={importProgress} onDismiss={handleDismissImport} />
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
          onManagePublications={() => navigate('publications')}
          importProgress={importProgress}
        />
      ) : page === 'all' ? (
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
      ) : (
        <PublicationsPage
          creators={creators}
          recipeCounts={creatorRecipeCounts}
          loading={loading}
          submitting={submitting}
          onAdd={handleAddCreator}
          onUnfollow={handleRemoveCreator}
          onViewRecipes={handleViewCreatorRecipes}
        />
      )}

      <DashboardFooter
        page={page}
        creators={creators}
        categories={categories}
        selectedCategory={allFilters.selectedCategory}
        selectedCreatorId={allFilters.selectedCreatorId}
        publication={publication}
        submitting={submitting}
        importProgress={importProgress}
        onBrowseAll={browseAllRecipes}
        onBrowseCategory={browseCategory}
        onBrowseCreator={browseCreator}
        onManagePublications={() => navigate('publications')}
        onPublicationChange={setPublication}
        onAddCreator={() => void handleQuickAddCreator()}
        onSignOut={onSignOut}
      />

      <DispatchCard
        open={dispatchOpen}
        publication={publication}
        submitting={submitting}
        importProgress={importProgress}
        onOpen={() => setDispatchOpen(true)}
        onClose={() => setDispatchOpen(false)}
        onPublicationChange={setPublication}
        onSubmit={() => void handleQuickAddCreator()}
      />

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          creator={creators.find((creator) => creator.creatorId === selectedRecipe.creatorId)}
          onClose={handleCloseRecipe}
          onSelectCategory={selectCategory}
        />
      )}
    </div>
  );
}
