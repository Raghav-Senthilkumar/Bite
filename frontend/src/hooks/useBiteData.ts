import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiRequest, normalizeRecipe, type Creator, type Recipe } from '../api';
import {
  deriveImportProgress,
  type ImportProgress,
  type WatchedImport,
} from '../features/dashboard/importProgress';
import { getDataRefreshInterval } from '../network';

type RawRecipe = Partial<Recipe> & Pick<Recipe, 'recipeId' | 'title'>;

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function sameRecipes(current: Recipe[], next: Recipe[]): boolean {
  return current.length === next.length
    && current.every((recipe, index) => JSON.stringify(recipe) === JSON.stringify(next[index]));
}

export function useBiteData() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [watchedImport, setWatchedImport] = useState<WatchedImport | null>(null);
  const pendingImportsRef = useRef(false);
  const watchedImportRef = useRef<WatchedImport | null>(null);
  const lastRefreshRef = useRef(0);

  const rememberImport = useCallback((watch: WatchedImport | null) => {
    watchedImportRef.current = watch;
    setWatchedImport(watch);
    if (watch && !watch.creatorId) pendingImportsRef.current = true;
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    lastRefreshRef.current = Date.now();
    if (!quiet) setLoading(true);
    try {
      const [creatorData, recipeData] = await Promise.all([
        apiRequest<{ creators: Creator[] }>('/api/creators'),
        apiRequest<{ recipes: RawRecipe[] }>('/api/recipes'),
      ]);
      const nextRecipes = recipeData.recipes.map(normalizeRecipe);
      const creatorsStillWorking = creatorData.creators.some((creator) =>
        (creator.importCounts?.QUEUED ?? 0) > 0
        || (creator.importCounts?.PROCESSING ?? 0) > 0,
      );
      const watch = watchedImportRef.current;
      const watchedCreator = watch?.creatorId
        ? creatorData.creators.find((creator) => creator.creatorId === watch.creatorId)
        : undefined;
      const watchedStillWorking = Boolean(
        watchedCreator
        && (
          (watchedCreator.importCounts?.QUEUED ?? 0) > 0
          || (watchedCreator.importCounts?.PROCESSING ?? 0) > 0
        ),
      );
      const watchedStillChecking = Boolean(watch) && (
        !watchedCreator
        || (
          !watchedCreator.lastSuccessfulCheckAt
          && !watchedCreator.lastError
          && !watchedStillWorking
        )
      );
      pendingImportsRef.current = creatorsStillWorking || watchedStillWorking || watchedStillChecking;
      setCreators(creatorData.creators);
      setRecipes((current) => sameRecipes(current, nextRecipes) ? current : nextRecipes);
      setError('');
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load Bite.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    const refresh = (force = false) => {
      const interval = pendingImportsRef.current ? 3_000 : getDataRefreshInterval();
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (force || Date.now() - lastRefreshRef.current >= interval) {
          void loadData(true);
        }
      }
    };
    const interval = window.setInterval(() => refresh(), 3_000);
    const onVisibilityChange = () => refresh(true);
    const onOnline = () => refresh(true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [loadData]);

  async function addCreator(publication: string) {
    const label = publication.trim();
    if (!label) return false;
    rememberImport({ creatorId: null, label, startedAt: Date.now() });
    setSubmitting(true);
    setError('');
    try {
      const created = await apiRequest<{ creatorId: string; displayName: string }>('/api/creators', {
        method: 'POST',
        body: JSON.stringify({ url: label }),
      });
      rememberImport({
        creatorId: created.creatorId,
        label: created.displayName || label,
        startedAt: watchedImportRef.current?.startedAt ?? Date.now(),
      });
      await loadData(true);
      return true;
    } catch (caught) {
      rememberImport(null);
      setError(errorMessage(caught, 'Could not add that publication.'));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCreator(creatorId: string) {
    try {
      await apiRequest(`/api/creators/${encodeURIComponent(creatorId)}`, {
        method: 'DELETE',
      });
      await loadData(true);
      return true;
    } catch (caught) {
      setError(errorMessage(caught, 'Could not remove this publication.'));
      return false;
    }
  }

  const importProgress = useMemo<ImportProgress | null>(() => {
    if (!watchedImport) return null;
    const creator = watchedImport.creatorId
      ? creators.find((item) => item.creatorId === watchedImport.creatorId)
      : undefined;
    const recipesFound = watchedImport.creatorId
      ? recipes.filter((recipe) => recipe.creatorId === watchedImport.creatorId).length
      : 0;
    return deriveImportProgress(creator, recipesFound, watchedImport);
  }, [creators, recipes, watchedImport]);

  return {
    creators,
    recipes,
    loading,
    submitting,
    error,
    importProgress,
    clearError: () => setError(''),
    dismissImport: () => rememberImport(null),
    loadData,
    addCreator,
    removeCreator,
  };
}
