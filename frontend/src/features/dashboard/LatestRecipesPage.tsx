import type { Creator, Recipe } from '../../api';
import { BiteWordmark } from '../../components/BiteWordmark';
import { RecipeCardRow } from '../../components/RecipeCardRow';

interface LatestRecipesPageProps {
  creators: Creator[];
  recipes: Recipe[];
  loading: boolean;
  search: string;
  selectedCategory: string | null;
  selectedCreatorId: string | null;
  onClearSearch: () => void;
  onClearCategory: () => void;
  onClearCreator: () => void;
  onSelectCategory: (category: string) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onSeeAll: () => void;
}

export function LatestRecipesPage({
  creators,
  recipes,
  loading,
  search,
  selectedCategory,
  selectedCreatorId,
  onClearSearch,
  onClearCategory,
  onClearCreator,
  onSelectCategory,
  onSelectRecipe,
  onSeeAll,
}: LatestRecipesPageProps) {
  const hasFilters = Boolean(search || selectedCategory || selectedCreatorId);

  return (
    <main className="page-view-transition">
      <section className="hero-wordmark-section">
        <BiteWordmark />
      </section>

      {hasFilters && (
        <div className="filter-bar">
          {selectedCategory && (
            <button
              type="button"
              onClick={onClearCategory}
              className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5"
            >
              <span>Category: {selectedCategory}</span>
              <span>×</span>
            </button>
          )}
          {selectedCreatorId && (
            <button
              type="button"
              onClick={onClearCreator}
              className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5"
            >
              <span>
                Creator:{' '}
                {creators.find((creator) => creator.creatorId === selectedCreatorId)?.displayName ?? 'Selected'}
              </span>
              <span>×</span>
            </button>
          )}
          {search && (
            <button
              type="button"
              onClick={onClearSearch}
              className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5"
            >
              <span>Search: {search}</span>
              <span>×</span>
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty-cookbook">
          <span className="spinner" />
          <h3>Setting the table...</h3>
        </div>
      ) : recipes.length > 0 ? (
        <RecipeCardRow
          title={selectedCategory ? `${selectedCategory} Recipes` : 'Latest Recipes'}
          recipes={recipes}
          onSelectRecipe={onSelectRecipe}
          onSelectCategory={onSelectCategory}
          onSeeAll={onSeeAll}
        />
      ) : (
        <div className="empty-cookbook">
          <h3>
            {hasFilters
              ? 'No recipes match that filter.'
              : 'Your cookbook starts with a Substack publication.'}
          </h3>
          <p>
            {hasFilters
              ? 'Clear your active filter or try another ingredient.'
              : 'Use the Bite Dispatch card or the footer below to add a public Substack URL (e.g. jadsaad.substack.com).'}
          </p>
        </div>
      )}
    </main>
  );
}
