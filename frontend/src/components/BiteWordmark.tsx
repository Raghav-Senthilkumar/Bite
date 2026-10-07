import { useEffect, useId, useRef, useState } from 'react';

const BASE = 165;
const GREEN = '#00A859';
const GREEN_DEEP = '#007A40';

const type = {
  fontFamily: "'Fredoka', 'DM Sans', sans-serif",
  fontWeight: 700,
  fontSize: 188,
  letterSpacing: -8,
  textAnchor: 'middle' as const,
};

const TEETH = [140, 180, 220].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { dx: 30 * Math.cos(a), dy: 30 * Math.sin(a) };
});

export function BiteWordmark() {
  const id = useId().replace(/:/g, '');
  const textRef = useRef<SVGTextElement>(null);
  const [right, setRight] = useState(540);

  useEffect(() => {
    const measure = () => {
      const b = textRef.current?.getBBox();
      if (b && b.width) setRight(b.x + b.width);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);

  const cx = right - 2;
  const cy = 82;

  return (
    <svg
      className="bite-wordmark-svg"
      viewBox="0 0 760 220"
      aria-label="bite"
      role="img"
    >
      <style>{`
        @keyframes ${id}-pop { from { transform: scale(0); } to { transform: scale(1); } }
        .${id}-pop {
          transform-box: fill-box;
          transform-origin: center;
          animation: ${id}-pop .35s cubic-bezier(.2, 1.5, .4, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .${id}-pop { animation: none; }
        }
      `}</style>

      <defs>
        <mask
          id={`${id}-mask`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="760"
          height="220"
        >
          <rect width="760" height="220" fill="#fff" />
          <g fill="#000">
            <circle
              className={`${id}-pop`}
              cx={cx + 8}
              cy={cy}
              r="30"
              style={{ animationDelay: '.5s' }}
            />
            {TEETH.map((t, i) => (
              <circle
                key={i}
                className={`${id}-pop`}
                cx={cx + 8 + t.dx}
                cy={cy + t.dy}
                r="9"
                style={{ animationDelay: `${0.62 + i * 0.07}s` }}
              />
            ))}
          </g>
        </mask>
      </defs>

      <g mask={`url(#${id}-mask)`}>
        <text x="50%" y={BASE + 7} fill={GREEN_DEEP} {...type}>
          bite
        </text>

        <text
          x="50%"
          y={BASE}
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeDasharray="18 28"
          strokeLinecap="round"
          opacity="0.82"
          {...type}
        >
          bite
        </text>

        <text ref={textRef} x="50%" y={BASE} fill={GREEN} {...type}>
          bite
        </text>
      </g>

      <circle
        className={`${id}-pop`}
        cx={cx - 44}
        cy={cy - 40}
        r="4.5"
        fill={GREEN}
        style={{ animationDelay: '.95s' }}
      />
      <circle
        className={`${id}-pop`}
        cx={cx - 16}
        cy={cy - 60}
        r="3"
        fill={GREEN}
        style={{ animationDelay: '1.02s' }}
      />
    </svg>
  );
}
