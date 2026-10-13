import type { Creator } from '../../api';

export type ImportPhase = 'connecting' | 'checking' | 'importing' | 'complete' | 'failed';

export interface WatchedImport {
  creatorId: string | null;
  label: string;
  startedAt: number;
}

export interface ImportProgress {
  phase: ImportPhase;
  title: string;
  detail: string;
  checked: number;
  total: number;
  recipesFound: number;
  percent: number | null;
}

interface ImportTotals {
  working: number;
  settled: number;
  complete: number;
  failed: number;
  total: number;
}

export function countImports(creator: Creator): ImportTotals {
  const counts = creator.importCounts ?? {};
  const queued = counts.QUEUED ?? 0;
  const processing = counts.PROCESSING ?? 0;
  const complete = counts.COMPLETE ?? 0;
  const noRecipe = counts.NO_RECIPE ?? 0;
  const failed = counts.FAILED ?? 0;
  const working = queued + processing;
  const settled = complete + noRecipe + failed;
  return {
    working,
    settled,
    complete,
    failed,
    total: working + settled,
  };
}

function recipeLabel(count: number): string {
  return count === 1 ? '1 recipe' : `${count} recipes`;
}

export function deriveImportProgress(
  creator: Creator | undefined,
  recipesFound: number,
  watch: WatchedImport,
  now = Date.now(),
): ImportProgress {
  if (!creator) {
    return {
      phase: 'connecting',
      title: 'Adding creator',
      detail: `Connecting to ${watch.label}`,
      checked: 0,
      total: 0,
      recipesFound: 0,
      percent: null,
    };
  }

  const { working, settled, complete, failed, total } = countImports(creator);
  const name = creator.displayName || watch.label;
  const elapsed = now - watch.startedAt;

  if (creator.lastError && working === 0 && total === 0 && !creator.lastSuccessfulCheckAt) {
    return {
      phase: 'failed',
      title: `Could not import ${name}`,
      detail: creator.lastError,
      checked: 0,
      total: 0,
      recipesFound,
      percent: null,
    };
  }

  if (total === 0 && !creator.lastSuccessfulCheckAt) {
    return {
      phase: 'checking',
      title: `Following ${name}`,
      detail: elapsed > 90_000
        ? 'Still checking the latest posts. This can take a minute.'
        : 'Looking through the latest posts',
      checked: 0,
      total: 0,
      recipesFound,
      percent: null,
    };
  }

  if (working > 0) {
    const found = recipesFound > 0 ? ` · ${recipeLabel(recipesFound)} added` : '';
    return {
      phase: 'importing',
      title: `Importing ${name}`,
      detail: total > 0
        ? `Checked ${settled} of ${total} posts${found}`
        : `Extracting recipes${found}`,
      checked: settled,
      total,
      recipesFound,
      percent: total > 0 && settled > 0 ? Math.round((settled / total) * 100) : null,
    };
  }

  const readyCount = Math.max(recipesFound, complete);
  let detail = 'Checked the latest posts. No recipes turned up this time.';
  if (readyCount > 0) {
    detail = `${recipeLabel(readyCount)} ${readyCount === 1 ? 'is' : 'are'} on your shelf`;
  } else if (failed > 0 && settled === failed) {
    detail = 'Posts were checked, but recipe extraction needs attention.';
  }

  return {
    phase: 'complete',
    title: `${name} is ready`,
    detail,
    checked: settled,
    total,
    recipesFound,
    percent: 100,
  };
}
