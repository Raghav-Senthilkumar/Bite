import { useCallback, useEffect, useRef, useState } from 'react';

import { apiRequest, normalizeRecipe, type Creator, type Recipe } from '../api';
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
  const pendingImportsRef = useRef(false);
  const lastRefreshRef = useRef(0);

  const loadData = useCallback(async (quiet = false) => {
    lastRefreshRef.current = Date.now();
    if (!quiet) setLoading(true);
    try {
      const [creatorData, recipeData] = await Promise.all([
        apiRequest<{ creators: Creator[] }>('/api/creators'),
        apiRequest<{ recipes: RawRecipe[] }>('/api/recipes'),
      ]);
      const nextRecipes = recipeData.recipes.map(normalizeRecipe);
      pendingImportsRef.current = creatorData.creators.some((creator) =>
        (creator.importCounts.QUEUED ?? 0) > 0
        || (creator.importCounts.PROCESSING ?? 0) > 0,
      );
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
      const interval = pendingImportsRef.current ? 15_000 : getDataRefreshInterval();
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (force || Date.now() - lastRefreshRef.current >= interval) {
          void loadData(true);
        }
      }
    };
    const interval = window.setInterval(() => refresh(), 15_000);
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
    if (!publication.trim()) return false;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/creators', {
        method: 'POST',
        body: JSON.stringify({ url: publication }),
      });
      await loadData(true);
      return true;
    } catch (caught) {
      setError(errorMessage(caught, 'Could not add that publication.'));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function checkCreator(creatorId: string) {
    try {
      await apiRequest(`/api/creators/${encodeURIComponent(creatorId)}/check`, {
        method: 'POST',
      });
      await loadData(true);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not check this publication.'));
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

  return {
    creators,
    recipes,
    loading,
    submitting,
    error,
    clearError: () => setError(''),
    loadData,
    addCreator,
    checkCreator,
    removeCreator,
  };
}
