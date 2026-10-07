import type { ImgHTMLAttributes } from 'react';

import { getFallbackRecipeImage, getRecipeImageFromGuid, type Recipe } from '../api';

interface RecipeImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  recipe: Recipe;
}

export function RecipeImage({ recipe, onError, ...imageProps }: RecipeImageProps) {
  const imageSrc = recipe.image || getRecipeImageFromGuid(recipe.guid, recipe.id);

  return (
    <img
      {...imageProps}
      src={imageSrc}
      alt={recipe.title}
      onError={(event) => {
        const fallback = getFallbackRecipeImage(recipe.guid || recipe.id);
        if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
        onError?.(event);
      }}
    />
  );
}
