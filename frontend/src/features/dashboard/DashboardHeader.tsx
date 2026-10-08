import { useEffect, useRef } from 'react';
import type { AuthUser } from 'aws-amplify/auth';

import type { Creator, Recipe } from '../../api';
import { NavigationDrawer } from './NavigationDrawer';
import type { DashboardPage } from './types';

interface DashboardHeaderProps {
  user: AuthUser;
  page: DashboardPage;
  menuOpen: boolean;
  searchOpen: boolean;
  search: string;
  creators: Creator[];
  recipes: Recipe[];
  categories: string[];
  selectedCategory: string | null;
  selectedCreatorId: string | null;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onSearchChange: (search: string) => void;
  onNavigate: (page: DashboardPage) => void;
  onSelectCategory: (category: string) => void;
  onClearCategory: () => void;
  onSelectCreator: (creatorId: string | null) => void;
  onOpenDispatch: () => void;
  onRefresh: () => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onSignOut: () => Promise<void>;
}

export function DashboardHeader(props: DashboardHeaderProps) {
  const {
    page,
    menuOpen,
    searchOpen,
    search,
    creators,
    recipes,
    onToggleMenu,
    onCloseMenu,
    onToggleSearch,
    onCloseSearch,
    onSearchChange,
    onNavigate,
    onSignOut,
  } = props;
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const searchVisible = searchOpen || Boolean(search);

  return (
    <>
      <div
        className={`nav-backdrop ${menuOpen ? 'is-open' : ''}`}
        aria-hidden="true"
        onClick={onCloseMenu}
      />

      <div className={`bite-header-wrap ${menuOpen ? 'drawer-open' : ''}`}>
        <header className={`bite-topbar ${searchVisible ? 'search-is-active' : ''}`}>
          <div className="topbar-left">
            <button
              type="button"
              className={`menu-trigger ${menuOpen ? 'is-open' : ''}`}
              onClick={onToggleMenu}
              aria-expanded={menuOpen}
            >
              <span className={`menu-icon-bars ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">
                <span />
                <span />
              </span>
              <span>bite.world</span>
            </button>
            {page === 'all' && (
              <button
                type="button"
                className="topbar-link hide-on-mobile"
                onClick={() => onNavigate('index')}
              >
                ← Latest Index
              </button>
            )}
          </div>

          <div className="topbar-actions">
            <div className={`search-shell ${searchVisible ? 'is-open' : ''}`}>
              <button
                type="button"
                className="topbar-link search-toggle-btn"
                onClick={onToggleSearch}
                aria-expanded={searchOpen}
              >
                Search
              </button>
              <label className="search-inline">
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search recipes..."
                  tabIndex={searchVisible ? 0 : -1}
                />
                <button
                  type="button"
                  aria-label="Clear search"
                  tabIndex={searchVisible ? 0 : -1}
                  onClick={() => {
                    onSearchChange('');
                    onCloseSearch();
                  }}
                >
                  ×
                </button>
              </label>
            </div>
            <button
              type="button"
              className={`topbar-link topbar-recipes-link ${page === 'all' ? 'active' : ''}`}
              onClick={() => onNavigate(page === 'all' ? 'index' : 'all')}
            >
              {page === 'all' ? 'Latest' : `All (${recipes.length})`}
            </button>
            <button
              type="button"
              className={`topbar-link hide-on-mobile ${menuOpen ? 'active' : ''}`}
              onClick={onToggleMenu}
            >
              Publications ({creators.length})
            </button>
            <button
              type="button"
              className="topbar-link hide-on-mobile"
              onClick={() => void onSignOut()}
            >
              Sign out
            </button>
          </div>
        </header>

        <NavigationDrawer {...props} open={menuOpen} onClose={onCloseMenu} />
      </div>
    </>
  );
}
