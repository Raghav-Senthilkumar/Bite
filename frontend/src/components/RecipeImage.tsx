import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react';

import {
  getCachedRecipeImage,
  getFallbackRecipeImage,
  getOptimizedRecipeImageUrl,
  getRecipeImageFromGuid,
  resolveDirectRecipeImage,
  type Recipe,
} from '../api';
import { getNetworkProfile } from '../network';

interface RecipeImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  recipe: Recipe;
  maxDisplayWidth?: number;
}

function loadImage(src: string, priority: 'high' | 'low' | 'auto'): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = priority;
    image.onload = () => {
      const decode = image.decode?.();
      if (decode) void decode.catch(() => {}).finally(resolve);
      else resolve();
    };
    image.onerror = reject;
    image.src = src;
  });
}

function ProgressiveRecipeImage({
  recipe,
  maxDisplayWidth = 640,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
  className = '',
  onError,
  ...imageProps
}: RecipeImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const profile = useMemo(() => getNetworkProfile(), []);
  const fallback = useMemo(
    () => getFallbackRecipeImage(recipe.guid || recipe.id),
    [recipe.guid, recipe.id],
  );
  const knownSource = recipe.image
    || getCachedRecipeImage(recipe.guid)
    || getRecipeImageFromGuid(recipe.guid, recipe.id);
  const placeholder = useMemo(
    () => getOptimizedRecipeImageUrl(knownSource || fallback, 48, 24),
    [fallback, knownSource],
  );
  const [displayedSrc, setDisplayedSrc] = useState(placeholder);
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const element = imageRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(() => setShouldLoad(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: profile.preloadMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [profile.preloadMargin, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;

    const loadFullImage = async () => {
      const resolved = recipe.image
        || await resolveDirectRecipeImage(recipe.guid)
        || fallback;
      const renderedWidth = imageRef.current?.getBoundingClientRect().width ?? maxDisplayWidth;
      const cssWidth = Math.min(maxDisplayWidth, Math.max(240, renderedWidth));
      const targetWidth = Math.ceil(cssWidth * profile.devicePixelRatio);
      let fullImage = getOptimizedRecipeImageUrl(
        resolved,
        targetWidth,
        profile.imageQuality,
      );

      try {
        await loadImage(fullImage, fetchPriority);
      } catch {
        fullImage = getOptimizedRecipeImageUrl(
          fallback,
          targetWidth,
          profile.imageQuality,
        );
        try {
          await loadImage(fullImage, 'low');
        } catch {
          try {
            await loadImage(fallback, 'low');
            fullImage = fallback;
          } catch {
            return;
          }
        }
      }

      if (cancelled) return;
      setDisplayedSrc(fullImage);
      requestAnimationFrame(() => {
        if (!cancelled) setLoaded(true);
      });
    };

    void loadFullImage();
    return () => {
      cancelled = true;
    };
  }, [
    fallback,
    fetchPriority,
    maxDisplayWidth,
    profile.devicePixelRatio,
    profile.imageQuality,
    recipe.guid,
    recipe.image,
    shouldLoad,
  ]);

  return (
    <img
      {...imageProps}
      ref={imageRef}
      src={displayedSrc}
      alt={recipe.title}
      loading="eager"
      decoding={decoding}
      fetchPriority={loaded ? fetchPriority : 'low'}
      aria-busy={!loaded}
      onError={(event) => {
        if (event.currentTarget.src !== fallback) setDisplayedSrc(fallback);
        onError?.(event);
      }}
      className={`${className} progressive-recipe-image ${loaded ? 'is-loaded' : 'is-placeholder'}`.trim()}
    />
  );
}

export function RecipeImage(props: RecipeImageProps) {
  const { recipe } = props;
  return (
    <ProgressiveRecipeImage
      key={`${recipe.id}:${recipe.image}:${recipe.guid}`}
      {...props}
    />
  );
}
