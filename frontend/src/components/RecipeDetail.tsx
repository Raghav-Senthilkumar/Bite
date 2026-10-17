import { useCallback, useEffect, useRef, useState } from 'react';

import type { Creator, Recipe } from '../api';
import { RecipeImage } from './RecipeImage';

interface RecipeDetailProps {
  recipe: Recipe;
  creator?: Creator;
  onClose: () => void;
  onSelectCategory: (category: string) => void;
}

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function formatRecipeForClipboard(recipe: Recipe, creatorName?: string): string {
  const parts: string[] = [];

  parts.push(`# ${recipe.title}`);

  const metadata: string[] = [];
  if (creatorName) metadata.push(`By: ${creatorName}`);
  if (recipe.sourceUrl) metadata.push(`Source: ${recipe.sourceUrl}`);
  if (recipe.cookTimeMinutes) metadata.push(`Cook Time: ${recipe.cookTimeMinutes} minutes`);
  if (recipe.servings) metadata.push(`Servings: ${recipe.servings}`);
  if (recipe.categories && recipe.categories.length > 0) {
    metadata.push(`Categories: ${recipe.categories.join(', ')}`);
  }
  if (metadata.length > 0) {
    parts.push(metadata.join('\n'));
  }

  if (recipe.description) {
    parts.push(`## Description\n${recipe.description}`);
  }

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const ingredientLines = recipe.ingredients.map((ing) => {
      const line = ing.raw?.trim() || ing.name?.trim();
      return `- ${line}`;
    });
    parts.push(`## Ingredients\n${ingredientLines.join('\n')}`);
  }

  if (recipe.instructions && recipe.instructions.length > 0) {
    const instructionLines = recipe.instructions.map((step, idx) => {
      return `${idx + 1}. ${step.trim()}`;
    });
    parts.push(`## Instructions\n${instructionLines.join('\n')}`);
  }

  return parts.join('\n\n');
}

export function RecipeDetail({
  recipe,
  creator,
  onClose,
  onSelectCategory,
}: RecipeDetailProps) {
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'method'>('ingredients');
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set());
  const closeTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onCloseRef.current();
    }, 240);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const handleCopyRecipe = useCallback(async () => {
    const text = formatRecipeForClipboard(recipe, creator?.displayName);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopied(false);
      }, 2000);
    } catch {
      // Ignore clipboard write failures.
    }
  }, [recipe, creator?.displayName]);

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
            <RecipeImage
              recipe={recipe}
              draggable={false}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              maxDisplayWidth={640}
            />
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
                  onClick={(event) => {
                    event.stopPropagation();
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
            <div className="detail-links-row">
              <a
                className="cabagges-pill py-2.5 px-4 text-xs font-medium gap-1.5 detail-source-link"
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>Original Post</span>
                <span aria-hidden="true">↗</span>
              </a>
              <button
                type="button"
                onClick={handleCopyRecipe}
                className={`detail-circle-btn detail-copy-btn ${copied ? 'is-copied' : ''}`}
                aria-label={copied ? 'Copied recipe to clipboard' : 'Copy recipe to clipboard'}
                title={copied ? 'Copied recipe to clipboard' : 'Copy recipe to clipboard'}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
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
