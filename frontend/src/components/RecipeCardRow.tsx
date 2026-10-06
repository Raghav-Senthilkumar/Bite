import React, { useCallback, useEffect, useRef } from 'react';
import { getFallbackRecipeImage, getRecipeImageFromGuid, type Recipe } from '../api';

export interface RecipeCardRowProps {
  title?: string;
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onSelectCategory: (category: string) => void;
  onSeeAll: () => void;
}

const DRAG_SENSITIVITY = 0.45;

export const RecipeCardRow: React.FC<RecipeCardRowProps> = ({
  title = 'Latest Recipes',
  recipes,
  onSelectRecipe,
  onSelectCategory,
  onSeeAll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{
    id: number; x: number; scrollLeft: number;
    lastX: number; lastTime: number; velocity: number;
  } | null>(null);
  const dragDistanceRef = useRef(0);
  const rubberRef = useRef(0);
  const suppressClickRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const snapFrameRef = useRef<number | null>(null);

  // Preload all recipe images and fallbacks into browser cache before scrolling into view.
  useEffect(() => {
    const preloaders: HTMLImageElement[] = [];
    for (const recipe of recipes) {
      const primarySrc = recipe.image || getRecipeImageFromGuid(recipe.guid, recipe.id);
      const fallbackSrc = getFallbackRecipeImage(recipe.guid || recipe.id);

      const img = new Image();
      img.decoding = 'async';
      img.src = primarySrc;
      preloaders.push(img);

      if (fallbackSrc && fallbackSrc !== primarySrc) {
        const fallbackImg = new Image();
        fallbackImg.decoding = 'async';
        fallbackImg.src = fallbackSrc;
        preloaders.push(fallbackImg);
      }
    }
    return () => {
      preloaders.length = 0;
    };
  }, [recipes]);

  // Keep the first card aligned with the heading, including on wide screens.
  useEffect(() => {
    const container = containerRef.current;
    const titleEl = titleRef.current;
    if (!container || !titleEl) return;

    const align = () => {
      container.style.setProperty('--row-inset', `${Math.max(0, titleEl.getBoundingClientRect().left)}px`);
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(titleEl);
    window.addEventListener('resize', align);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', align);
    };
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (snapFrameRef.current !== null) cancelAnimationFrame(snapFrameRef.current);
  }, []);

  const cards = useCallback(() =>
    Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[data-recipe-card]') ?? []), []);

  const cardTarget = useCallback((card: HTMLElement) => {
    const container = containerRef.current!;
    const track = trackRef.current!;
    const inset = parseFloat(getComputedStyle(container).getPropertyValue('--row-inset')) || 0;
    // Both rectangles share the same rubber-band translation.
    return card.getBoundingClientRect().left - track.getBoundingClientRect().left - inset;
  }, []);

  const applyDrag = (desiredScroll: number) => {
    const container = containerRef.current!;
    const track = trackRef.current!;
    const max = Math.max(0, container.scrollWidth - container.clientWidth);
    container.scrollLeft = Math.max(0, Math.min(desiredScroll, max));
    const excess = desiredScroll < 0 ? -desiredScroll : desiredScroll > max ? max - desiredScroll : 0;
    // At the edge, only a fraction of the pointer movement moves the cards.
    const offset = Math.sign(excess) * 36 * (1 - Math.exp(-Math.abs(excess) / 320));
    rubberRef.current = offset;
    track.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : '';
  };

  const stopSnap = () => {
    if (snapFrameRef.current !== null) {
      cancelAnimationFrame(snapFrameRef.current);
      snapFrameRef.current = null;
    }
  };

  const smoothSnapTo = (target: number, releaseVelocity = 0) => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    stopSnap();
    // Keep browser snapping off until the animation finishes, so it cannot
    // jump to a card before the eased transition starts.
    container.style.scrollSnapType = 'none';
    const from = container.scrollLeft;
    const to = Math.max(0, Math.min(target, container.scrollWidth - container.clientWidth));
    const distance = to - from;
    const rubberFrom = rubberRef.current;
    if (Math.abs(distance) < 1 && Math.abs(rubberFrom) < 0.5) {
      container.scrollLeft = to;
      track.style.transform = '';
      rubberRef.current = 0;
      requestAnimationFrame(() => {
        container.style.scrollSnapType = '';
      });
      return;
    }

    // Let velocity influence the pace without turning a fast swipe into a jump.
    const travel = Math.max(Math.abs(distance), Math.abs(rubberFrom) * 3);
    const duration = Math.min(1250, Math.max(700,
      760 + travel * 0.6 - Math.min(Math.abs(releaseVelocity), 2.5) * 40));
    let startedAt: number | null = null;
    const step = (time: number) => {
      if (startedAt === null) startedAt = time;
      const progress = Math.min((time - startedAt) / duration, 1);
      // Normalized exponential ease-out: fast at release, soft on arrival.
      const eased = (1 - Math.exp(-5 * progress)) / (1 - Math.exp(-5));
      container.scrollLeft = from + distance * eased;
      rubberRef.current = rubberFrom * (1 - eased);
      track.style.transform = rubberRef.current
        ? `translate3d(${rubberRef.current}px, 0, 0)` : '';
      if (progress < 1) {
        snapFrameRef.current = requestAnimationFrame(step);
      } else {
        snapFrameRef.current = null;
        container.scrollLeft = to;
        rubberRef.current = 0;
        track.style.transform = '';
        container.style.scrollSnapType = '';
      }
    };
    snapFrameRef.current = requestAnimationFrame(step);
  };

  const scrollStep = (direction: -1 | 1) => {
    const container = containerRef.current;
    const items = cards();
    if (!container || !items.length) return;

    const current = items.reduce((best, card, index) =>
      Math.abs(cardTarget(card) - container.scrollLeft) <
      Math.abs(cardTarget(items[best]) - container.scrollLeft) ? index : best, 0);
    const next = Math.max(0, Math.min(items.length - 1, current + direction));
    smoothSnapTo(cardTarget(items[next]));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    stopSnap();
    containerRef.current.style.scrollSnapType = 'none';
    trackRef.current!.style.transform = '';
    rubberRef.current = 0;
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      scrollLeft: containerRef.current.scrollLeft,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    dragDistanceRef.current = 0;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerRef.current;
    const container = containerRef.current;
    if (!start || !container || start.id !== event.pointerId) return;
    const rawDistance = event.clientX - start.x;
    const dampedDistance = rawDistance * DRAG_SENSITIVITY;
    dragDistanceRef.current = rawDistance;
    if (Math.abs(rawDistance) <= 6 && !container.hasPointerCapture(event.pointerId)) return;

    if (!container.hasPointerCapture(event.pointerId)) {
      container.setPointerCapture(event.pointerId);
      container.classList.add('cursor-grabbing');
    }
    const elapsed = event.timeStamp - start.lastTime;
    if (elapsed > 0) {
      const speed = Math.max(
        -2.5,
        Math.min(2.5, ((start.lastX - event.clientX) * DRAG_SENSITIVITY) / elapsed),
      );
      start.velocity = start.velocity * 0.45 + speed * 0.55;
    }
    start.lastX = event.clientX;
    start.lastTime = event.timeStamp;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      applyDrag(start.scrollLeft - dampedDistance);
      frameRef.current = null;
    });
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerRef.current;
    const container = containerRef.current;
    if (!start || !container || start.id !== event.pointerId) return;
    pointerRef.current = null;
    const dragged = Math.abs(dragDistanceRef.current) > 6;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      if (dragged) applyDrag(start.scrollLeft - dragDistanceRef.current * DRAG_SENSITIVITY);
    }
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    container.classList.remove('cursor-grabbing');
    if (event.type === 'pointercancel') {
      smoothSnapTo(container.scrollLeft);
      return;
    }
    if (dragged) {
      suppressClickRef.current = true;
      // Native click follows pointerup. Clear this after that click has been handled.
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      const items = cards();
      const velocity = start.velocity;
      const projected = container.scrollLeft + velocity * 65;
      const nearest = items.reduce<HTMLElement | null>((best, card) =>
        !best || Math.abs(cardTarget(card) - projected) <
          Math.abs(cardTarget(best) - projected) ? card : best, null);
      if (nearest) smoothSnapTo(cardTarget(nearest), velocity);
      else container.style.scrollSnapType = '';
    } else {
      container.style.scrollSnapType = '';
    }
  };

  return (
    <section className="w-full flex flex-col gap-y-6 md:gap-y-8 overflow-hidden">
      <div className="max-w-[1720px] w-full mx-auto px-4 md:px-8">
        <div ref={titleRef} className="w-full flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl lg:text-[34px] font-normal tracking-tight text-[#2E2E2E]">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 mr-2">
              <button type="button" onClick={() => scrollStep(-1)} aria-label="Previous recipes"
                className="w-8 h-8 rounded-full border border-black/10 hover:border-black/25 flex items-center justify-center text-xs text-[#2E2E2E]/60 hover:text-[#2E2E2E] transition-colors cursor-pointer">←</button>
              <button type="button" onClick={() => scrollStep(1)} aria-label="Next recipes"
                className="w-8 h-8 rounded-full border border-black/10 hover:border-black/25 flex items-center justify-center text-xs text-[#2E2E2E]/60 hover:text-[#2E2E2E] transition-colors cursor-pointer">→</button>
            </div>
            <button type="button" onClick={onSeeAll}
              className="cabagges-pill py-2.5 px-4 text-xs font-medium gap-1.5 cursor-pointer">
              <span>See All</span><span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
          }
        }}
        className="w-full overflow-x-auto no-scrollbar py-2 cursor-grab snap-x snap-proximity touch-pan-y overscroll-x-contain"
        style={{ '--row-inset': '16px', scrollPaddingLeft: 'var(--row-inset)', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        
        {/* Adjusted inline style: Removed paddingRight */}
        <div ref={trackRef} className="flex gap-4 md:gap-5 w-max will-change-transform"
          style={{ paddingLeft: 'var(--row-inset)' }}>
          {recipes.map((recipe, index) => {
            const imageSrc = recipe.image || getRecipeImageFromGuid(recipe.guid, recipe.id);
            return (
              <article key={recipe.id} data-recipe-card
                onClick={() => onSelectRecipe(recipe)}
                className="w-[260px] sm:w-[290px] md:w-[350px] lg:w-[380px] flex flex-col gap-y-3 group select-none flex-shrink-0 snap-start cursor-pointer">
                <div className="recipe-card-photo-frame relative w-full aspect-[4/5] bg-[#EAF7EE] rounded-[20px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)] pointer-events-none">
                  <img
                    src={imageSrc}
                    alt={recipe.title}
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    fetchPriority={index < 5 ? 'high' : 'auto'}
                    onError={(event) => {
                      const fallback = getFallbackRecipeImage(recipe.guid || recipe.id);
                      if (event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      }
                    }}
                    className="recipe-card-photo w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-y-1 text-sm pt-1">
                  <h3 className="text-base font-normal tracking-tight text-[#2E2E2E] group-hover:text-[#00A859] transition-colors leading-tight">
                    {recipe.title}
                  </h3>
                  <div className="text-xs text-[#2E2E2E]/50 flex items-center gap-1.5 flex-wrap">
                    {recipe.categories.map((category, catIndex) => (
                      <React.Fragment key={`${category}-${catIndex}`}>
                        <button type="button" onClick={(event) => {
                          event.stopPropagation();
                          onSelectCategory(category);
                        }} className="hover:text-[#00A859] hover:underline transition-colors text-left">
                          {category}
                        </button>
                        {catIndex < recipe.categories.length - 1 && <span>,</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
          
          {/* THE LAYOUT FIX: Physical DOM node acting as the trailing boundary */}
          <div className="flex-shrink-0 pointer-events-none" style={{ width: 'max(var(--row-inset), 35vw)' }} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};

export default RecipeCardRow;
