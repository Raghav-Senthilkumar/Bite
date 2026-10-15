import { createAvatar } from '@bible-strong/avatar-react';
import '@bible-strong/avatar-react/styles.css';
import { useCallback, useEffect, useRef } from 'react';

import kirbyDefinition from '../assets/kirby.avatar.json';
import './InteractiveAvatar.css';

interface EyeOffset {
  x: number;
  y: number;
}

interface InteractiveAvatarProps {
  quiet?: boolean;
  dispatchOpen?: boolean;
}

const KirbyAvatar = createAvatar(kirbyDefinition);

export function InteractiveAvatar({
  quiet = false,
  dispatchOpen = false,
}: InteractiveAvatarProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const eyeFrameRef = useRef<number | null>(null);
  const eyePathsRef = useRef<SVGPathElement[]>([]);
  const eyeCurrentRef = useRef<EyeOffset>({ x: 0, y: 0 });
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const pointerInViewportRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const quietRef = useRef(quiet);

  const applyEyeOffset = useCallback(({ x, y }: EyeOffset) => {
    const shell = shellRef.current;
    if (!shell) return;

    if (
      eyePathsRef.current.length !== 2
      || eyePathsRef.current.some((path) => !path.isConnected)
    ) {
      eyePathsRef.current = Array.from(
        shell.querySelectorAll<SVGPathElement>('.bs-avatar__svg > g[clip-path] > path'),
      ).slice(0, 2);
    }

    const transform = `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
    eyePathsRef.current.forEach((path) => path.setAttribute('transform', transform));
  }, []);

  const resetEyeTracking = useCallback(() => {
    pointerInViewportRef.current = false;
    eyeCurrentRef.current = { x: 0, y: 0 };
    if (eyeFrameRef.current !== null) {
      window.cancelAnimationFrame(eyeFrameRef.current);
      eyeFrameRef.current = null;
    }
    applyEyeOffset({ x: 0, y: 0 });
  }, [applyEyeOffset]);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const syncMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
    };

    const renderEyeTracking = () => {
      eyeFrameRef.current = null;
      const shell = shellRef.current;
      if (!shell) return;

      let target: EyeOffset = { x: 0, y: 0 };
      if (pointerInViewportRef.current && !quietRef.current) {
        const svg = shell.querySelector<SVGSVGElement>('.bs-avatar__svg');
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const deltaX = latestPointerRef.current.x - (rect.left + rect.width / 2);
          const deltaY = latestPointerRef.current.y - (rect.top + rect.height / 2);
          const distance = Math.hypot(deltaX, deltaY);

          if (distance > 0.01) {
            const strength = Math.min(distance / Math.max(rect.width * 1.25, 1), 1);
            target = {
              x: (deltaX / distance) * 12 * strength,
              y: (deltaY / distance) * 9 * strength,
            };
          }
        }
      }

      const current = eyeCurrentRef.current;
      const easing = reducedMotionRef.current ? 1 : 0.28;
      const next = {
        x: current.x + (target.x - current.x) * easing,
        y: current.y + (target.y - current.y) * easing,
      };
      eyeCurrentRef.current = next;
      applyEyeOffset(next);

      if (Math.hypot(target.x - next.x, target.y - next.y) > 0.02) {
        eyeFrameRef.current = window.requestAnimationFrame(renderEyeTracking);
      }
    };

    const scheduleEyeTracking = () => {
      if (eyeFrameRef.current === null) {
        eyeFrameRef.current = window.requestAnimationFrame(renderEyeTracking);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerInViewportRef.current = true;
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleEyeTracking();
    };

    const onPointerLeave = () => {
      pointerInViewportRef.current = false;
      scheduleEyeTracking();
    };

    syncMotionPreference();
    motionQuery.addEventListener('change', syncMotionPreference);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    document.addEventListener('mouseleave', onPointerLeave);

    return () => {
      motionQuery.removeEventListener('change', syncMotionPreference);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', onPointerLeave);
      document.removeEventListener('mouseleave', onPointerLeave);
      resetEyeTracking();
    };
  }, [applyEyeOffset, resetEyeTracking]);

  useEffect(() => {
    quietRef.current = quiet;
    if (quiet) resetEyeTracking();
  }, [quiet, resetEyeTracking]);

  return (
    <div
      ref={shellRef}
      className="bite-avatar"
      data-quiet={quiet ? 'true' : 'false'}
      data-dispatch-open={dispatchOpen ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className="bite-avatar__glow" />
      <div className="bite-avatar__stage">
        <KirbyAvatar
          defaultExpression="neutral"
          size="100%"
          className="bite-avatar__render"
          ariaLabel="Kirby, the Bite companion"
        />
      </div>
    </div>
  );
}
