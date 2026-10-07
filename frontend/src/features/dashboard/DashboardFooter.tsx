import type { FormEvent } from 'react';

import type { Creator } from '../../api';

interface DashboardFooterProps {
  creators: Creator[];
  categories: string[];
  selectedCategory: string | null;
  selectedCreatorId: string | null;
  publication: string;
  submitting: boolean;
  onResetFilters: () => void;
  onSelectCategory: (category: string) => void;
  onSelectCreator: (creatorId: string | null) => void;
  onCheckCreator: (creatorId: string) => void;
  onRemoveCreator: (creatorId: string) => void;
  onRefresh: () => void;
  onPublicationChange: (publication: string) => void;
  onAddCreator: () => void;
  onSignOut: () => Promise<void>;
}

const FALLBACK_CATEGORIES = ['Popular', 'Dinner', 'Lunch', 'Noodles'];

function statusSummary(creator: Creator): string {
  const counts = creator.importCounts ?? {};
  const working = (counts.QUEUED ?? 0) + (counts.PROCESSING ?? 0);
  if (working) return `${working} processing`;
  if (counts.FAILED) return `${counts.FAILED} need attention`;
  const complete = (counts.COMPLETE ?? 0) + (counts.NO_RECIPE ?? 0);
  return complete ? `${complete} posts checked` : 'Ready to import';
}

export function DashboardFooter({
  creators,
  categories,
  selectedCategory,
  selectedCreatorId,
  publication,
  submitting,
  onResetFilters,
  onSelectCategory,
  onSelectCreator,
  onCheckCreator,
  onRemoveCreator,
  onRefresh,
  onPublicationChange,
  onAddCreator,
  onSignOut,
}: DashboardFooterProps) {
  function handleSubmit(event: FormEvent) {
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
            onClick={onResetFilters}
            className={`cabagges-pill footer-pill ${!selectedCategory ? 'active-pill' : ''}`}
          >
            Recipe Index
          </button>
          {displayedCategories.map((category) => (
            <button
              key={`footer-${category}`}
              type="button"
              onClick={() => onSelectCategory(category)}
              className={`cabagges-pill footer-pill ${
                selectedCategory === category ? 'active-pill' : ''
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="footer-col">
          <span className="footer-col-label">Publications</span>
          {creators.length === 0 ? (
            <span className="cabagges-pill footer-pill">None yet</span>
          ) : (
            creators.map((creator) => (
              <button
                key={`footer-creator-${creator.creatorId}`}
                type="button"
                onClick={() => onSelectCreator(
                  selectedCreatorId === creator.creatorId ? null : creator.creatorId,
                )}
                className={`cabagges-pill footer-pill ${
                  selectedCreatorId === creator.creatorId ? 'active-pill' : ''
                }`}
              >
                {creator.displayName}
              </button>
            ))
          )}
        </div>

        <div className="footer-col">
          <span className="footer-col-label">Sync Status</span>
          {creators.map((creator) => (
            <button
              key={`status-${creator.creatorId}`}
              type="button"
              onClick={() => onCheckCreator(creator.creatorId)}
              title="Click to check for new posts"
              className="cabagges-pill footer-pill"
            >
              {creator.displayName.split(' ')[0]}: {statusSummary(creator)}
            </button>
          ))}
          <button type="button" onClick={onRefresh} className="cabagges-pill footer-pill">
            Refresh All
          </button>
        </div>

        <div className="footer-col">
          <span className="footer-col-label">Manage</span>
          {creators.map((creator) => (
            <button
              key={`remove-${creator.creatorId}`}
              type="button"
              onClick={() => onRemoveCreator(creator.creatorId)}
              className="cabagges-pill footer-pill"
            >
              Unfollow {creator.displayName.split(' ')[0]}
            </button>
          ))}
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
        <h4>Bite Dispatch</h4>
        <p>
          Follow a public Substack publication by URL or handle. Bite checks the
          latest 20 posts and extracts structured recipes automatically.
        </p>
        <form className="dispatch-input-bar" onSubmit={handleSubmit}>
          <input
            aria-label="Substack publication"
            value={publication}
            onChange={(event) => onPublicationChange(event.target.value)}
            placeholder="e.g. jadsaad.substack.com"
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>
    </footer>
  );
}
