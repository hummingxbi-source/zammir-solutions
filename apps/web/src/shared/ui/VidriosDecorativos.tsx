import { useId } from 'react';
import type { ReactElement } from 'react';

/** Tres vidrios translúcidos que se cruzan, con un brillo: el motivo de la marca en las superficies verdes
 *  (encabezado del inicio, pantallas de acceso). Es solo adorno: no lleva texto ni se lee en voz alta. */
export function VidriosDecorativos({ className }: { readonly className?: string }): ReactElement {
  const id = useId();
  const a = `${id}-a`;
  const b = `${id}-b`;
  const brillo = `${id}-brillo`;
  return (
    <svg
      className={className}
      viewBox="0 0 420 420"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={a} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={b} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b7d4cf" stopOpacity="0.42" />
          <stop offset="1" stopColor="#5fb3a6" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={brillo} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="rotate(-14 210 210)">
        <rect
          x="64"
          y="36"
          width="176"
          height="312"
          rx="12"
          fill={`url(#${a})`}
          stroke="#ffffff"
          strokeOpacity="0.38"
          strokeWidth="1.5"
        />
        <rect
          x="196"
          y="92"
          width="176"
          height="312"
          rx="12"
          fill={`url(#${b})`}
          stroke="#b7d4cf"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <rect
          x="128"
          y="150"
          width="150"
          height="232"
          rx="12"
          fill={`url(#${a})`}
          stroke="#ffffff"
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
        <path d="M108 52h34L74 336H40z" fill={`url(#${brillo})`} opacity="0.5" />
        <path d="M262 118h22l-52 250h-22z" fill={`url(#${brillo})`} opacity="0.35" />
      </g>
    </svg>
  );
}
