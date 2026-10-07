import type { Creator, Recipe } from '../../api';
import { RecipeImage } from '../../components/RecipeImage';

interface AllRecipesPageProps {
  creators: Creator[];
  recipes: Recipe[];
  totalRecipeCount: number;
  creatorRecipeCounts: Map<string, number>;
  loading: boolean;
  search: string;
  selectedCategory: string | null;
  selectedCreatorId: string | null;
  onBack: () => void;
  onClearSearch: () => void;
  onClearCategory: () => void;
  onSelectCreator: (creatorId: string | null) => void;
  onSelectRecipe: (recipe: Recipe) => void;
}

export function AllRecipesPage({
  creators,
  recipes,
  totalRecipeCount,
  creatorRecipeCounts,
  loading,
  search,
  selectedCategory,
  selectedCreatorId,
  onBack,
  onClearSearch,
  onClearCategory,
  onSelectCreator,
  onSelectRecipe,
}: AllRecipesPageProps) {
  return (
    <main className="all-recipes-page page-view-transition">
      <div className="all-recipes-header">
        <div className="all-recipes-title-row">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="cabagges-pill py-2 px-4 text-xs font-medium gap-1.5 cursor-pointer"
            >
              <span aria-hidden="true">←</span>
              <span>Back to Latest</span>
            </button>
            <h1 className="all-recipes-heading">
              All Recipes
              <span className="all-recipes-count">{recipes.length}</span>
            </h1>
          </div>
        </div>

        <div className="creator-filter-section" aria-label="Filter by creator">
          <span className="creator-filter-label">Filter by Creator</span>
          <div className="creator-filter-pills">
            <button
              type="button"
              onClick={() => onSelectCreator(null)}
              className={`cabagges-pill creator-pill cursor-pointer ${
                selectedCreatorId === null ? 'active-pill' : ''
              }`}
            >
              <span>All Creators</span>
              <span className="creator-pill-count">{totalRecipeCount}</span>
            </button>
            {creators.map((creator) => (
              <button
                key={creator.creatorId}
                type="button"
                onClick={() => onSelectCreator(
                  selectedCreatorId === creator.creatorId ? null : creator.creatorId,
                )}
                className={`cabagges-pill creator-pill cursor-pointer ${
                  selectedCreatorId === creator.creatorId ? 'active-pill' : ''
                }`}
              >
                <span>{creator.displayName}</span>
                <span className="creator-pill-count">
                  {creatorRecipeCounts.get(creator.creatorId) ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {(selectedCategory || search) && (
          <div className="all-recipes-subfilters">
            {selectedCategory && (
              <button
                type="button"
                onClick={onClearCategory}
                className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5 cursor-pointer"
              >
                <span>Category: {selectedCategory}</span>
                <span>×</span>
              </button>
            )}
            {search && (
              <button
                type="button"
                onClick={onClearSearch}
                className="cabagges-pill active-pill py-2 px-4 text-xs gap-1.5 cursor-pointer"
              >
                <span>Search: {search}</span>
                <span>×</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty-cookbook">
          <span className="spinner" />
          <h3>Loading all recipes...</h3>
        </div>
      ) : recipes.length > 0 ? (
        <div className="all-recipes-grid">
          {recipes.map((recipe) => {
            const creator = creators.find((item) => item.creatorId === recipe.creatorId);
            return (
              <article
                key={`grid-${recipe.id}`}
                onClick={() => onSelectRecipe(recipe)}
                className="all-recipe-card flex flex-col gap-y-3 group select-none cursor-pointer"
              >
                <div className="recipe-card-photo-frame relative w-full aspect-[4/5] bg-[#EAF7EE] rounded-[20px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)] pointer-events-none">
                  <RecipeImage
                    recipe={recipe}
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    className="recipe-card-photo w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-y-1 text-sm pt-1">
                  <h3 className="text-base font-normal tracking-tight text-[#2E2E2E] group-hover:text-[#00A859] transition-colors leading-tight">
                    {recipe.title}
                  </h3>
                  <div className="text-xs text-[#2E2E2E]/50 flex items-center gap-1.5 flex-wrap">
                    {creator && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectCreator(
                            selectedCreatorId === creator.creatorId ? null : creator.creatorId,
                          );
                        }}
                        className="hover:text-[#00A859] hover:underline transition-colors text-left font-medium"
                      >
                        {creator.displayName}
                      </button>
                    )}
                    {creator && recipe.categories.length > 0 && <span>·</span>}
                    {recipe.categories.slice(0, 2).map((category, index) => (
                      <span key={`${category}-${index}`}>
                        {category}
                        {index < Math.min(recipe.categories.length, 2) - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-cookbook">
          <h3>No recipes found for this creator.</h3>
          <p>Select All Creators above or check that your Substack publication has finished syncing.</p>
        </div>
      )}
    </main>
  );
}
