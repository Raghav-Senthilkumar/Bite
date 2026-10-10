import { fetchAuthSession } from 'aws-amplify/auth';

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');

export interface Creator {
  creatorId: string;
  displayName: string;
  siteUrl: string;
  status: 'ACTIVE' | 'PAUSED';
  lastSuccessfulCheckAt?: string;
  lastError?: string;
  importCounts: Record<string, number>;
}

export interface Ingredient {
  raw: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
}

export interface Recipe {
  id: string;
  recipeId: string;
  guid: string;
  sourceGuid?: string;
  sourceItemId?: string;
  creatorId: string;
  sourceUrl: string;
  title: string;
  description: string;
  image: string;
  categories: string[];
  ingredients: Ingredient[];
  instructions: string[];
  cookTimeMinutes: number | null;
  servings: number | null;
  tags: string[];
  extractionConfidence: number;
  publishedAt: string;
}

const FALLBACK_FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=900&q=80',
];

const IMAGE_CACHE_STORAGE_KEY = 'bite:resolved-images:v2';
const LEGACY_IMAGE_CACHE_STORAGE_KEY = 'bite:resolved-images:v1';
const IMAGE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const IMAGE_CACHE_MAX_ENTRIES = 200;
const IMAGE_FAILURE_TTL_MS = 15 * 60 * 1_000;

interface CachedImageUrl {
  url: string;
  cachedAt: number;
  lastUsedAt: number;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getFallbackRecipeImage(seed: string): string {
  const index = hashString(seed || 'bite') % FALLBACK_FOOD_IMAGES.length;
  return FALLBACK_FOOD_IMAGES[index];
}

const directImageCache = new Map<string, CachedImageUrl>();
const inFlightResolutions = new Map<string, Promise<string | null>>();
const failedResolutions = new Map<string, number>();

function normalizeImageKey(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function isDirectImageUrl(value: string): boolean {
  return /^https?:\/\/.+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i.test(value);
}

try {
  const stored = typeof window !== 'undefined'
    ? window.localStorage.getItem(IMAGE_CACHE_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_IMAGE_CACHE_STORAGE_KEY)
    : null;
  if (stored) {
    const parsed = JSON.parse(stored) as Record<string, string | CachedImageUrl>;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      const entry = typeof v === 'string'
        ? { url: v, cachedAt: now, lastUsedAt: now }
        : v;
      if (k && entry?.url && now - entry.cachedAt < IMAGE_CACHE_TTL_MS) {
        directImageCache.set(k, entry);
      }
    }
  }
} catch {
  // Ignore localStorage read errors.
}

function pruneDirectImageCache() {
  const now = Date.now();
  for (const [key, entry] of directImageCache) {
    if (now - entry.cachedAt >= IMAGE_CACHE_TTL_MS) directImageCache.delete(key);
  }
  if (directImageCache.size <= IMAGE_CACHE_MAX_ENTRIES) return;
  const oldestFirst = [...directImageCache.entries()]
    .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt);
  for (const [key] of oldestFirst.slice(0, directImageCache.size - IMAGE_CACHE_MAX_ENTRIES)) {
    directImageCache.delete(key);
  }
}

function persistDirectImageCache() {
  try {
    if (typeof window !== 'undefined') {
      pruneDirectImageCache();
      window.localStorage.setItem(
        IMAGE_CACHE_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(directImageCache)),
      );
      window.localStorage.removeItem(LEGACY_IMAGE_CACHE_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage quota errors.
  }
}

export function getCachedRecipeImage(sourceUrl: string): string | null {
  const key = normalizeImageKey(sourceUrl);
  const entry = directImageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt >= IMAGE_CACHE_TTL_MS) {
    directImageCache.delete(key);
    return null;
  }
  entry.lastUsedAt = Date.now();
  return entry.url;
}

export async function resolveDirectRecipeImage(guid: string): Promise<string | null> {
  const trimmed = normalizeImageKey(guid || '');
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (isDirectImageUrl(trimmed)) return trimmed;

  const cached = getCachedRecipeImage(trimmed);
  if (cached) return cached;

  const failedAt = failedResolutions.get(trimmed);
  if (failedAt && Date.now() - failedAt < IMAGE_FAILURE_TTL_MS) return null;

  const existing = inFlightResolutions.get(trimmed);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await apiRequest<{ imageUrl?: string }>(
        `/api/recipe-image?url=${encodeURIComponent(trimmed)}`,
      );
      if (data.imageUrl) {
        const now = Date.now();
        directImageCache.set(trimmed, {
          url: data.imageUrl,
          cachedAt: now,
          lastUsedAt: now,
        });
        failedResolutions.delete(trimmed);
        persistDirectImageCache();
        return data.imageUrl;
      }
    } catch {
      // Ignore resolution errors.
    } finally {
      inFlightResolutions.delete(trimmed);
    }
    failedResolutions.set(trimmed, Date.now());
    return null;
  })();

  inFlightResolutions.set(trimmed, promise);
  return promise;
}

export function getRecipeImageFromGuid(guid: string, fallbackSeed = ''): string {
  const trimmed = normalizeImageKey(guid || '');
  if (isDirectImageUrl(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    const direct = getCachedRecipeImage(trimmed);
    if (direct) return direct;
  }
  return getFallbackRecipeImage(trimmed || fallbackSeed);
}

export function getOptimizedRecipeImageUrl(
  imageUrl: string,
  width: number,
  quality: number,
): string {
  const safeWidth = Math.max(32, Math.min(1_920, Math.round(width)));
  const safeQuality = Math.max(20, Math.min(85, Math.round(quality)));
  if (!/^https?:\/\//i.test(imageUrl)) return imageUrl;

  try {
    const parsed = new URL(imageUrl);
    if (parsed.hostname === 'images.unsplash.com') {
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('w', String(safeWidth));
      parsed.searchParams.set('q', String(safeQuality));
      return parsed.toString();
    }

    const marker = '/image/fetch/';
    if (parsed.hostname === 'substackcdn.com' && parsed.pathname.startsWith(marker)) {
      const remainder = parsed.pathname.slice(marker.length);
      const separator = remainder.indexOf('/');
      if (separator !== -1) {
        const encodedSource = remainder.slice(separator + 1);
        parsed.pathname = `${marker}w_${safeWidth},c_limit,f_auto,q_${safeQuality},fl_progressive:steep/${encodedSource}`;
        return parsed.toString();
      }
    }
  } catch {
    return imageUrl;
  }

  return `https://substackcdn.com/image/fetch/w_${safeWidth},c_limit,f_auto,q_${safeQuality},fl_progressive:steep/${encodeURIComponent(imageUrl)}`;
}

export function normalizeRecipe(raw: Partial<Recipe> & { recipeId: string; title: string }): Recipe {
  const guid = (raw.guid || raw.sourceGuid || raw.sourceUrl || raw.sourceItemId || raw.recipeId || '').trim();
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [];
  const categories =
    Array.isArray(raw.categories) && raw.categories.length > 0
      ? raw.categories
      : tags.length > 0
        ? tags
        : [
            raw.cookTimeMinutes ? `${raw.cookTimeMinutes} min` : 'Recipe',
            raw.servings ? `Serves ${raw.servings}` : 'Substack',
          ];

  return {
    ...raw,
    id: raw.id || raw.recipeId,
    recipeId: raw.recipeId,
    guid,
    creatorId: raw.creatorId ?? '',
    sourceUrl: raw.sourceUrl ?? '',
    title: raw.title,
    description: raw.description ?? '',
    // Keep normalization side-effect free. The image component resolves old
    // recipes only when they approach the viewport.
    image: (raw.image ?? '').trim(),
    categories,
    ingredients: raw.ingredients ?? [],
    instructions: raw.instructions ?? [],
    cookTimeMinutes: raw.cookTimeMinutes ?? null,
    servings: raw.servings ?? null,
    tags,
    extractionConfidence: raw.extractionConfidence ?? 1,
    publishedAt: raw.publishedAt ?? '',
  };
}

interface ApiErrorBody {
  message?: string;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is not configured.');
  }
  const session = await fetchAuthSession();
  const token =
    session.tokens?.idToken?.toString() ??
    session.tokens?.accessToken?.toString();
  if (!token) {
    throw new Error('Your session expired. Please sign in again.');
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Keep the fallback below for non-JSON gateway responses.
    }
    throw new Error(body.message ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}
