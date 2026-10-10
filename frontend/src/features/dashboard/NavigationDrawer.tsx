import type { AuthUser } from 'aws-amplify/auth';

import type { Creator, Recipe } from '../../api';
import { RecipeImage } from '../../components/RecipeImage';
import type { DashboardPage } from './types';

interface NavigationDrawerProps {
  user: AuthUser;
  page: DashboardPage;
  open: boolean;
  creators: Creator[];
  recipes: Recipe[];
  categories: string[];
  selectedCategory: string | null;
  selectedCreatorId: string | null;
  onClose: () => void;
  onNavigate: (page: DashboardPage) => void;
  onSelectCategory: (category: string) => void;
  onClearCategory: () => void;
  onSelectCreator: (creatorId: string | null) => void;
  onOpenDispatch: () => void;
  onRefresh: () => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onSignOut: () => Promise<void>;
}

const FALLBACK_CATEGORIES = ['Dinner', 'Lunch', 'Noodles', 'Quick'];

export function NavigationDrawer({
  user,
  page,
  open,
  creators,
  recipes,
  categories,
  selectedCategory,
  selectedCreatorId,
  onClose,
  onNavigate,
  onSelectCategory,
  onClearCategory,
  onSelectCreator,
  onOpenDispatch,
  onRefresh,
  onSelectRecipe,
  onSignOut,
}: NavigationDrawerProps) {
  const displayedCategories = categories.length ? categories.slice(0, 6) : FALLBACK_CATEGORIES;

  return (
    <nav
      className={`nav-drawer ${open ? 'is-open' : ''}`}
      aria-label="Bite directory"
      aria-hidden={!open}
    >
      <div className="nav-drawer-clip">
        <div className="nav-drawer-inner">
          <div className="drawer-col">
            <h4>Recipes</h4>
            <div className="drawer-list">
              <button
                type="button"
                className={`drawer-item ${page === 'index' && !selectedCategory ? 'active' : ''}`}
                onClick={() => {
                  onClearCategory();
                  onNavigate('index');
                  onClose();
                }}
              >
                Latest 10
              </button>
              {displayedCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`drawer-item ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => {
                    onSelectCategory(category);
                    onClose();
                  }}
                >
                  {category}
                </button>
              ))}
              <button
                type="button"
                className={`drawer-item ${page === 'all' ? 'active' : ''}`}
                onClick={() => {
                  onNavigate('all');
                  onClose();
                }}
              >
                All ({recipes.length})
              </button>
            </div>
          </div>

          <div className="drawer-col">
            <h4>Publications</h4>
            <div className="drawer-list">
              <button
                type="button"
                className={`drawer-item ${!selectedCreatorId ? 'active' : ''}`}
                onClick={() => {
                  onSelectCreator(null);
                  onClose();
                }}
              >
                All Writers
              </button>
              {creators.map((creator) => (
                <button
                  key={creator.creatorId}
                  type="button"
                  className={`drawer-item ${selectedCreatorId === creator.creatorId ? 'active' : ''}`}
                  onClick={() => {
                    onSelectCreator(
                      selectedCreatorId === creator.creatorId ? null : creator.creatorId,
                    );
                    onClose();
                  }}
                >
                  {creator.displayName}
                </button>
              ))}
            </div>
          </div>

          <div className="drawer-col">
            <h4>World</h4>
            <div className="drawer-list">
              <button
                type="button"
                className="drawer-item"
                onClick={() => {
                  onOpenDispatch();
                  onClose();
                }}
              >
                Add Substack
              </button>
              <button
                type="button"
                className="drawer-item"
                onClick={() => {
                  onRefresh();
                  onClose();
                }}
              >
                Refresh Feed
              </button>
            </div>

            <div className="drawer-sub-section">
              <h4>Signed In</h4>
              <div className="drawer-list">
                <span className="drawer-item" style={{ fontSize: '16px' }}>
                  {user.signInDetails?.loginId ?? user.username}
                </span>
                <button
                  type="button"
                  className="drawer-item"
                  style={{ fontSize: '18px' }}
                  onClick={() => void onSignOut()}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <div className="drawer-cards">
            {recipes.slice(0, 2).map((recipe) => (
              <div
                key={recipe.id}
                className="drawer-feature-card select-none"
                onClick={() => {
                  onSelectRecipe(recipe);
                  onClose();
                }}
              >
                <div className="drawer-feature-img">
                  <RecipeImage
                    recipe={recipe}
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    maxDisplayWidth={420}
                  />
                </div>
                <span className="cabagges-pill py-2 px-4 text-xs" style={{ alignSelf: 'flex-start' }}>
                  {recipe.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
