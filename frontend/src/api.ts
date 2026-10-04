import { fetchAuthSession } from 'aws-amplify/auth';

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

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
  recipeId: string;
  creatorId: string;
  sourceUrl: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  cookTimeMinutes: number | null;
  servings: number | null;
  tags: string[];
  extractionConfidence: number;
  publishedAt: string;
}

interface ApiErrorBody {
  message?: string;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is not configured.');
  }
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken.toString();
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
