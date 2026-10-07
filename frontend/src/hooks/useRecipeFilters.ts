import { useCallback, useMemo, useState } from 'react';

import type { Recipe } from '../api';

export function useRecipeFilters(recipes: Recipe[]) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);

  const selectCategory = useCallback((category: string) => {
    setSelectedCategory((current) => (current === category ? null : category));
  }, []);

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (selectedCreatorId && recipe.creatorId !== selectedCreatorId) return false;
      if (
        selectedCategory &&
        !recipe.categories.some(
          (category) => category.toLowerCase() === selectedCategory.toLowerCase(),
        )
      ) {
        return false;
      }
      if (!query) return true;
      return [
        recipe.title,
        recipe.description,
        ...recipe.categories,
        ...recipe.ingredients.map((ingredient) => ingredient.name),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [recipes, search, selectedCategory, selectedCreatorId]);

  return {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    selectedCreatorId,
    setSelectedCreatorId,
    selectCategory,
    filteredRecipes,
  };
}
