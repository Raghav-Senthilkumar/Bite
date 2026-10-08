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
  const [activeTab, setActiveTab] = useState<'ingredients' | 'method'>('ingredients');
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set());
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

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

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
        <div className="recipe-detail-drag-handle" aria-hidden="true" />

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
              className="cabagges-pill py-2.5 px-4 text-xs font-medium gap-1.5 detail-source-link"
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>Original Post</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        {/* Sticky Segmented Switcher for Mobile & Tablet */}
        <div className="detail-mobile-tabs" role="tablist" aria-label="Recipe sections">
          <div
            className="detail-tab-slider"
            style={{
              transform: activeTab === 'ingredients' ? 'translateX(0%)' : 'translateX(100%)',
            }}
            aria-hidden="true"
          />
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ingredients'}
            className={`detail-tab-btn ${activeTab === 'ingredients' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ingredients')}
          >
            <span>Ingredients</span>
            <span className="detail-tab-badge">{recipe.ingredients.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'method'}
            className={`detail-tab-btn ${activeTab === 'method' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('method')}
          >
            <span>Steps</span>
            <span className="detail-tab-badge">{recipe.instructions.length}</span>
          </button>
        </div>

        <div className={`detail-columns active-tab-${activeTab}`}>
          <section className="detail-section detail-ingredients-section">
            <div className="detail-section-header">
              <h3>Ingredients ({recipe.ingredients.length})</h3>
              <span className="detail-section-hint">Tap to check off</span>
            </div>
            <ul className="ingredient-list">
              {recipe.ingredients.map((ingredient, index) => {
                const isChecked = checkedIngredients.has(index);
                return (
                  <li
                    key={`${ingredient.raw}-${index}`}
                    className={`ingredient-row ${isChecked ? 'is-checked' : ''}`}
                    onClick={() => toggleIngredient(index)}
                  >
                    <span className="ingredient-check" aria-hidden="true">
                      {isChecked ? '✓' : ''}
                    </span>
                    <div className="ingredient-text">
                      <strong>{ingredient.name || 'Ingredient'}</strong>
                      {ingredient.raw && ingredient.raw !== ingredient.name && (
                        <span>{ingredient.raw}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="detail-section detail-method-section">
            <div className="detail-section-header">
              <h3>Method ({recipe.instructions.length} steps)</h3>
              <span className="detail-section-hint">Tap step to mark done</span>
            </div>
            <ol className="instruction-list">
              {recipe.instructions.map((instruction, index) => {
                const isDone = completedSteps.has(index);
                return (
                  <li
                    key={`${instruction}-${index}`}
                    className={`instruction-step-card ${isDone ? 'is-done' : ''}`}
                    onClick={() => toggleStep(index)}
                  >
                    <span className="step-number-pill">
                      {isDone ? '✓' : index + 1}
                    </span>
                    <p className="step-body">{instruction}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </article>
    </div>
  );
}
