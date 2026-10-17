import type { FormEvent } from 'react';

import type { Creator } from '../../api';
import { CreatorImportStatus } from './CreatorImportStatus';
import type { ImportProgress } from './importProgress';
import type { DashboardPage } from './types';

interface DashboardFooterProps {
  page: DashboardPage;
  creators: Creator[];
  categories: string[];
  selectedCategory: string | null;
  selectedCreatorId: string | null;
  publication: string;
  submitting: boolean;
  importProgress: ImportProgress | null;
  onBrowseAll: () => void;
  onBrowseCategory: (category: string) => void;
  onBrowseCreator: (creatorId: string) => void;
  onManagePublications: () => void;
  onPublicationChange: (publication: string) => void;
  onAddCreator: () => void;
  onSignOut: () => Promise<void>;
}

const FALLBACK_CATEGORIES = ['Popular', 'Dinner', 'Lunch', 'Noodles'];

export function DashboardFooter({
  page,
  creators,
  categories,
  selectedCategory,
  selectedCreatorId,
  publication,
  submitting,
  importProgress,
  onBrowseAll,
  onBrowseCategory,
  onBrowseCreator,
  onManagePublications,
  onPublicationChange,
  onAddCreator,
  onSignOut,
}: DashboardFooterProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddCreator();
  }

  const displayedCategories = categories.length ? categories : FALLBACK_CATEGORIES;

  return (
    <footer className="bite-footer">
      <div className="footer-pill-columns">
        <div className="footer-col">
          <span className="footer-col-label">Recipes</span>
          <button
            type="button"
            onClick={onBrowseAll}
            className={`cabagges-pill footer-pill ${page === 'all' && !selectedCategory && !selectedCreatorId ? 'active-pill' : ''}`}
          >
            All Recipes
          </button>
          {displayedCategories.map((category) => (
            <button
              key={`footer-${category}`}
              type="button"
              onClick={() => onBrowseCategory(category)}
              className={`cabagges-pill footer-pill ${page === 'all' && selectedCategory === category ? 'active-pill' : ''}`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="footer-col">
          <span className="footer-col-label">Writers</span>
          {creators.length === 0 ? (
            <span className="cabagges-pill footer-pill footer-status-pill">None yet</span>
          ) : (
            creators.map((creator) => (
              <button
                key={`footer-creator-${creator.creatorId}`}
                type="button"
                onClick={() => onBrowseCreator(creator.creatorId)}
                className={`cabagges-pill footer-pill ${
                  page === 'all' && selectedCreatorId === creator.creatorId ? 'active-pill' : ''
                }`}
              >
                {creator.displayName}
              </button>
            ))
          )}
        </div>

        <div className="footer-col">
          <span className="footer-col-label">Manage</span>
          <button type="button" onClick={onManagePublications} className="cabagges-pill footer-pill">
            Manage Publications
          </button>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="cabagges-pill footer-pill"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="footer-dispatch-col">
        <h4>Add New Creator</h4>
        {importProgress ? (
          <CreatorImportStatus progress={importProgress} variant="inline" />
        ) : (
          <p>
            Follow a public Substack publication by URL or handle. Bite checks the
            latest 20 posts and extracts structured recipes automatically.
          </p>
        )}
        <form className="dispatch-input-bar" onSubmit={handleSubmit}>
          <input
            aria-label="Substack publication"
            value={publication}
            disabled={submitting}
            onChange={(event) => onPublicationChange(event.target.value)}
            placeholder="e.g. jadsaad.substack.com"
          />
          <button type="submit" disabled={submitting || !publication.trim()}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>
    </footer>
  );
}
