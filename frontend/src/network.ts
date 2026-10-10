interface NetworkInformationLike {
  effectiveType?: string;
  saveData?: boolean;
}

export interface NetworkProfile {
  constrained: boolean;
  moderate: boolean;
  devicePixelRatio: number;
  imageQuality: number;
  preloadMargin: string;
}

function connection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

export function getNetworkProfile(): NetworkProfile {
  const info = connection();
  const effectiveType = info?.effectiveType ?? '';
  const constrained = Boolean(
    info?.saveData || effectiveType === 'slow-2g' || effectiveType === '2g',
  );
  const moderate = !constrained && effectiveType === '3g';
  const rawPixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  return {
    constrained,
    moderate,
    devicePixelRatio: Math.min(rawPixelRatio, constrained ? 1 : moderate ? 1.5 : 2),
    imageQuality: constrained ? 48 : moderate ? 62 : 76,
    preloadMargin: constrained ? '80px' : moderate ? '280px' : '600px',
  };
}

export function getRecipeBatchSize(): number {
  const profile = getNetworkProfile();
  if (profile.constrained) return 6;
  if (typeof window !== 'undefined' && window.innerWidth < 640) return 8;
  return 12;
}

export function getDataRefreshInterval(): number {
  const profile = getNetworkProfile();
  if (profile.constrained) return 120_000;
  if (profile.moderate) return 90_000;
  return 60_000;
}
