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

export function getRecipeImageFromGuid(guid: string, fallbackSeed = ''): string {
  const trimmed = (guid || '').trim();
  if (/^https?:\/\/.+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return `https://api.microlink.io/?url=${encodeURIComponent(trimmed)}&embed=image.url`;
  }
  return getFallbackRecipeImage(trimmed || fallbackSeed);
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
    image: raw.image || getRecipeImageFromGuid(guid, raw.recipeId),
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
