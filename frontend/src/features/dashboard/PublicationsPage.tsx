import { useMemo, useState, type FormEvent } from 'react';

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

type SortKey = 'recipes' | 'name' | 'checked';
type StatusFilter = 'all' | 'syncing' | 'attention';
type PublicationHealth = 'active' | 'syncing' | 'attention' | 'paused' | 'starting';

interface DerivedStatus {
  health: PublicationHealth;
  label: string;
  detail?: string;
  progressPercent?: number;
}

function publicationUrl(siteUrl: string): string | null {
  try {
    const url = new URL(siteUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function publicationHost(siteUrl: string, parsedUrl: string | null): string {
  if (!parsedUrl) return siteUrl;
  try {
    return new URL(parsedUrl).hostname.replace(/^www\./, '');
  } catch {
    return siteUrl;
  }
}

function formatCheckedAt(isoString: string): string | null {
  const checkedAt = new Date(isoString);
  if (Number.isNaN(checkedAt.getTime())) return null;

  const now = new Date();
  const sameDay =
    checkedAt.getFullYear() === now.getFullYear() &&
    checkedAt.getMonth() === now.getMonth() &&
    checkedAt.getDate() === now.getDate();

  if (sameDay) return 'Synced today';
  return `Checked ${checkedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function derivePublicationStatus(creator: Creator): DerivedStatus {
  if (creator.status === 'PAUSED') {
    return { health: 'paused', label: 'Paused' };
  }

  const { working, settled, total } = countImports(creator);
  if (working > 0) {
    const progressPercent = total > 0 ? Math.max(8, Math.round((settled / total) * 100)) : 25;
    return {
      health: 'syncing',
      label: total > 0 ? `Checking ${settled}/${total} posts` : 'Checking posts',
      progressPercent,
    };
  }

  if (creator.lastError) {
    return {
      health: 'attention',
      label: 'Needs attention',
      detail: creator.lastError,
    };
  }

  if (creator.lastSuccessfulCheckAt) {
    const formatted = formatCheckedAt(creator.lastSuccessfulCheckAt);
    if (formatted) {
      return { health: 'active', label: formatted };
    }
  }

  return { health: 'starting', label: 'Setting up' };
}

function checkedTimestamp(creator: Creator): number {
  if (!creator.lastSuccessfulCheckAt) return 0;
  const ts = Date.parse(creator.lastSuccessfulCheckAt);
  return Number.isNaN(ts) ? 0 : ts;
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
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recipes');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const enrichedCreators = useMemo(() => {
    return creators.map((creator) => {
      const url = publicationUrl(creator.siteUrl);
      const host = publicationHost(creator.siteUrl, url);
      const count = recipeCounts.get(creator.creatorId) ?? 0;
      const status = derivePublicationStatus(creator);
      return { creator, url, host, count, status };
    });
  }, [creators, recipeCounts]);

  const totalRecipes = useMemo(
    () => enrichedCreators.reduce((sum, item) => sum + item.count, 0),
    [enrichedCreators],
  );

  const syncingCount = useMemo(
    () => enrichedCreators.filter((item) => item.status.health === 'syncing').length,
    [enrichedCreators],
  );

  const attentionCount = useMemo(
    () => enrichedCreators.filter((item) => item.status.health === 'attention').length,
    [enrichedCreators],
  );

  const activeStatusFilter: StatusFilter =
    (statusFilter === 'syncing' && syncingCount === 0) ||
    (statusFilter === 'attention' && attentionCount === 0)
      ? 'all'
      : statusFilter;

  const visibleCreators = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();

    const filtered = enrichedCreators.filter(({ creator, host, status }) => {
      if (activeStatusFilter === 'syncing' && status.health !== 'syncing') return false;
      if (activeStatusFilter === 'attention' && status.health !== 'attention') return false;
      if (!query) return true;
      return (
        creator.displayName.toLowerCase().includes(query) ||
        host.toLowerCase().includes(query)
      );
    });

    return filtered.sort((left, right) => {
      if (sortBy === 'recipes') {
        const countDiff = right.count - left.count;
        if (countDiff !== 0) return countDiff;
        return left.creator.displayName.localeCompare(right.creator.displayName);
      }
      if (sortBy === 'checked') {
        const timeDiff = checkedTimestamp(right.creator) - checkedTimestamp(left.creator);
        if (timeDiff !== 0) return timeDiff;
        return left.creator.displayName.localeCompare(right.creator.displayName);
      }
      return left.creator.displayName.localeCompare(right.creator.displayName);
    });
  }, [activeStatusFilter, enrichedCreators, filterQuery, sortBy]);

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
      setConfirmingId((current) => (current === creatorId ? null : current));
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
        <p>
          {creators.length > 0
            ? `${totalRecipes} ${totalRecipes === 1 ? 'recipe' : 'recipes'} synced across ${creators.length} ${creators.length === 1 ? 'publication' : 'publications'}.`
            : 'Follow the writers you cook with. Their recipes appear in your cookbook.'}
        </p>
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
        <div className="publications-toolbar">
          <div className="publications-toolbar-left">
            <h2 id="following-title">Following</h2>
            {(syncingCount > 0 || attentionCount > 0) && creators.length > 0 && (
              <div className="publications-status-filters" role="group" aria-label="Filter by status">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`pub-filter-chip ${activeStatusFilter === 'all' ? 'is-active' : ''}`}
                >
                  All ({creators.length})
                </button>
                {syncingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter((cur) => (cur === 'syncing' ? 'all' : 'syncing'))}
                    className={`pub-filter-chip is-syncing ${activeStatusFilter === 'syncing' ? 'is-active' : ''}`}
                  >
                    Syncing ({syncingCount})
                  </button>
                )}
                {attentionCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter((cur) => (cur === 'attention' ? 'all' : 'attention'))}
                    className={`pub-filter-chip is-attention ${activeStatusFilter === 'attention' ? 'is-active' : ''}`}
                  >
                    Needs attention ({attentionCount})
                  </button>
                )}
              </div>
            )}
          </div>

          {creators.length > 0 && (
            <div className="publications-toolbar-controls">
              <label className="publications-filter-box">
                <input
                  type="search"
                  value={filterQuery}
                  onChange={(event) => setFilterQuery(event.target.value)}
                  placeholder="Filter publications..."
                  aria-label="Filter publications"
                />
                {filterQuery && (
                  <button
                    type="button"
                    aria-label="Clear publication filter"
                    onClick={() => setFilterQuery('')}
                  >
                    ×
                  </button>
                )}
              </label>

              <div className="publications-sort-control" role="group" aria-label="Sort publications">
                <button
                  type="button"
                  onClick={() => setSortBy('recipes')}
                  className={sortBy === 'recipes' ? 'is-active' : ''}
                >
                  Recipes
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('name')}
                  className={sortBy === 'name' ? 'is-active' : ''}
                >
                  A–Z
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('checked')}
                  className={sortBy === 'checked' ? 'is-active' : ''}
                >
                  Recent
                </button>
              </div>
            </div>
          )}
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
        ) : visibleCreators.length === 0 ? (
          <div className="publication-directory-empty">
            <p>No publications match your current filter.</p>
            <button
              type="button"
              className="cabagges-pill py-2 px-4 text-xs cursor-pointer"
              onClick={() => {
                setFilterQuery('');
                setStatusFilter('all');
              }}
            >
              Reset filter
            </button>
          </div>
        ) : (
          <div className="publication-directory" role="region" aria-label="Followed publications directory">
            <div className="publication-directory-head" aria-hidden="true">
              <span>Publication</span>
              <span>Status</span>
              <span className="text-right">Recipes</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="publication-directory-body">
              {visibleCreators.map(({ creator, url, host, count, status }) => {
                const isConfirming = confirmingId === creator.creatorId;
                const isRemoving = removingId === creator.creatorId;

                return (
                  <article className="publication-row" key={creator.creatorId}>
                    <div className="publication-cell-source">
                      <span className="publication-avatar" aria-hidden="true">
                        {creator.displayName.charAt(0).toUpperCase() || 'P'}
                      </span>
                      <div className="publication-identity">
                        <h3>{creator.displayName}</h3>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {host} ↗
                          </a>
                        ) : (
                          <span>{host}</span>
                        )}
                      </div>
                    </div>

                    <div className="publication-cell-status">
                      <span
                        className={`publication-status-badge is-${status.health}`}
                        title={status.detail}
                      >
                        <span className="publication-status-dot" aria-hidden="true" />
                        <span>{status.label}</span>
                      </span>
                      {status.health === 'syncing' && status.progressPercent !== undefined && (
                        <div className="publication-mini-progress" aria-hidden="true">
                          <span style={{ width: `${status.progressPercent}%` }} />
                        </div>
                      )}
                      {status.detail && (
                        <p className="publication-status-detail" title={status.detail}>
                          {status.detail}
                        </p>
                      )}
                    </div>

                    <div className="publication-cell-count">
                      <strong className={count === 0 ? 'is-zero' : ''}>{count}</strong>
                      <span>{count === 1 ? 'recipe' : 'recipes'}</span>
                    </div>

                    <div className="publication-cell-actions">
                      <button
                        type="button"
                        className="cabagges-pill publication-view-btn"
                        onClick={() => onViewRecipes(creator.creatorId)}
                      >
                        <span>View recipes</span>
                        <span aria-hidden="true">→</span>
                      </button>

                      {isConfirming ? (
                        <div className="publication-confirm-group">
                          <button
                            type="button"
                            className="publication-confirm-remove"
                            onClick={() => void handleUnfollow(creator.creatorId)}
                            disabled={removingId !== null}
                            aria-label={`Confirm unfollowing ${creator.displayName}`}
                          >
                            {isRemoving ? 'Removing...' : 'Remove'}
                          </button>
                          <button
                            type="button"
                            className="publication-confirm-cancel"
                            onClick={() => setConfirmingId(null)}
                            disabled={isRemoving}
                            aria-label="Cancel unfollow"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="publication-unfollow-btn"
                          onClick={() => setConfirmingId(creator.creatorId)}
                          disabled={removingId !== null}
                          aria-label={`Unfollow ${creator.displayName}`}
                        >
                          Unfollow
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
