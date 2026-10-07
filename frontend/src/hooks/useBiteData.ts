import { useCallback, useEffect, useState } from 'react';

import { apiRequest, normalizeRecipe, type Creator, type Recipe } from '../api';

type RawRecipe = Partial<Recipe> & Pick<Recipe, 'recipeId' | 'title'>;

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export function useBiteData() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [creatorData, recipeData] = await Promise.all([
        apiRequest<{ creators: Creator[] }>('/api/creators'),
        apiRequest<{ recipes: RawRecipe[] }>('/api/recipes'),
      ]);
      setCreators(creatorData.creators);
      setRecipes(recipeData.recipes.map(normalizeRecipe));
      setError('');
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load Bite.'));
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
