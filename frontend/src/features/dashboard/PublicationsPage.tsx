import { useState, type FormEvent } from 'react';

import type { Creator } from '../../api';
import { countImports } from './importProgress';

interface PublicationsPageProps {
  creators: Creator[];
  recipeCounts: Map<string, number>;
  loading: boolean;
  submitting: boolean;
  onAdd: (publication: string) => Promise<boolean>;
  onUnfollow: (creatorId: string) => Promise<boolean>;
  onViewRecipes: (creatorId: string) => void;
}

function publicationUrl(siteUrl: string): string | null {
  try {
    const url = new URL(siteUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function publicationStatus(creator: Creator): string {
  if (creator.status === 'PAUSED') return 'Paused';
  const { working, settled, total } = countImports(creator);
  if (working > 0) return `Checking ${settled} of ${total} posts`;
  if (creator.lastError) return 'Needs attention';
  if (creator.lastSuccessfulCheckAt) {
    const checkedAt = new Date(creator.lastSuccessfulCheckAt);
    if (!Number.isNaN(checkedAt.getTime())) {
      return `Last checked ${checkedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  }
  return 'Getting started';
}

export function PublicationsPage({
  creators,
  recipeCounts,
  loading,
  submitting,
  onAdd,
  onUnfollow,
  onViewRecipes,
}: PublicationsPageProps) {
  const [publication, setPublication] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onAdd(publication)) setPublication('');
  }

  async function handleUnfollow(creatorId: string) {
    setRemovingId(creatorId);
    try {
      await onUnfollow(creatorId);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="publications-page page-view-transition">
      <header className="publications-heading-block">
        <span className="publications-eyebrow">Your cookbook sources</span>
        <h1 className="all-recipes-heading">
          Publications
          <span className="all-recipes-count">{creators.length}</span>
        </h1>
        <p>Follow the writers you cook with. Their recipes appear in your cookbook.</p>
      </header>

      <section className="publication-add-card" aria-labelledby="publication-add-title">
        <div>
          <span className="publications-eyebrow">Grow your cookbook</span>
          <h2 id="publication-add-title">Follow a publication</h2>
          <p>Add a public Substack URL or handle. Bite will look for recipes in its latest posts.</p>
        </div>
        <form onSubmit={(event) => void handleAdd(event)}>
          <label htmlFor="publication-input">Substack URL or handle</label>
          <div className="publication-add-input-row">
            <input
              id="publication-input"
              value={publication}
              onChange={(event) => setPublication(event.target.value)}
              placeholder="e.g. jadsaad.substack.com"
              autoComplete="off"
              required
              disabled={submitting}
            />
            <button type="submit" disabled={submitting || !publication.trim()}>
              {submitting ? 'Adding...' : 'Follow'}
            </button>
          </div>
        </form>
      </section>

      <section className="publications-list-section" aria-labelledby="following-title">
        <div className="publications-list-heading">
          <h2 id="following-title">Following</h2>
          <span>{creators.length} {creators.length === 1 ? 'publication' : 'publications'}</span>
        </div>

        {loading ? (
          <div className="empty-cookbook">
            <span className="spinner" />
            <h3>Loading your publications...</h3>
          </div>
        ) : creators.length === 0 ? (
          <div className="empty-cookbook">
            <h3>No publications yet.</h3>
            <p>Add your first publication above to start building your cookbook.</p>
          </div>
        ) : (
          <div className="publication-grid">
            {creators.map((creator) => {
              const recipeCount = recipeCounts.get(creator.creatorId) ?? 0;
              const url = publicationUrl(creator.siteUrl);
              const isRemoving = removingId === creator.creatorId;

              return (
                <article className="publication-card" key={creator.creatorId}>
                  <div className="publication-card-top">
                    <span className="publication-avatar" aria-hidden="true">
                      {creator.displayName.charAt(0).toUpperCase() || 'P'}
                    </span>
                    <div className="publication-identity">
                      <h3>{creator.displayName}</h3>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {new URL(url).hostname.replace(/^www\./, '')} ↗
                        </a>
                      ) : (
                        <span>{creator.siteUrl}</span>
                      )}
                    </div>
                  </div>

                  <div className="publication-count">
                    <strong>{recipeCount}</strong>
                    <span>{recipeCount === 1 ? 'recipe' : 'recipes'} in your cookbook</span>
                  </div>
                  <p className="publication-status">{publicationStatus(creator)}</p>

                  <div className="publication-card-actions">
                    <button type="button" onClick={() => onViewRecipes(creator.creatorId)}>
                      View recipes <span aria-hidden="true">→</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUnfollow(creator.creatorId)}
                      disabled={removingId !== null}
                      aria-label={`Unfollow ${creator.displayName}`}
                    >
                      {isRemoving ? 'Unfollowing...' : 'Unfollow'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
