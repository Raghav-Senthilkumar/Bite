import { useCallback, useEffect, useRef, useState } from 'react';

import type { Creator, Recipe } from '../api';
import { RecipeImage } from './RecipeImage';

interface RecipeDetailProps {
  recipe: Recipe;
  creator?: Creator;
  onClose: () => void;
  onSelectCategory: (category: string) => void;
}

export function RecipeDetail({
  recipe,
  creator,
  onClose,
  onSelectCategory,
}: RecipeDetailProps) {
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const handleClose = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 250);
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [handleClose]);

  return (
    <div
      className={`dialog-backdrop ${closing ? 'is-closing' : ''}`}
      role="presentation"
      onMouseDown={handleClose}
    >
      <article
        className={`recipe-detail ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={recipe.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close-button" type="button" aria-label="Close recipe" onClick={handleClose}>
          ×
        </button>

        <div className="detail-header-grid">
          <div className="detail-cover select-none">
            <RecipeImage recipe={recipe} draggable={false} />
          </div>
          <div className="detail-header-info">
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
              {recipe.categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    onSelectCategory(category);
                    handleClose();
                  }}
                  className="cabagges-pill py-2 px-4 text-xs cursor-pointer"
                >
                  {category}
                </button>
              ))}
            </div>
            <h2>{recipe.title}</h2>
            {recipe.description && <p className="detail-description">{recipe.description}</p>}
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
