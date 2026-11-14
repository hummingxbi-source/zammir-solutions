import type { ReactElement } from 'react';

/** Piezas para dibujar vidrio con acabado de verdad (grosor, reflejos, sombra de contacto, latón con brillo).
 *  Las ilustraciones de sección las combinan; todo es SVG, sin imágenes externas, así pesa poco, se ve nítido
 *  en la tablet y funciona sin internet. Los identificadores salen de `useId` para no chocar entre dibujos. */

const VERDE = '#0f5c57';

/** Degradados y filtros comunes de un dibujo. Va una vez dentro de `<defs>`. */
export function DefinicionesDeVidrio({ id }: { readonly id: string }): ReactElement {
  return (
    <>
      <linearGradient id={`${id}-cuerpo`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.97" />
        <stop offset="0.55" stopColor="#eaf4f1" stopOpacity="0.82" />
        <stop offset="1" stopColor="#c9e1dc" stopOpacity="0.62" />
      </linearGradient>
      <linearGradient id={`${id}-verde`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#bfe6de" stopOpacity="0.95" />
        <stop offset="0.5" stopColor="#7cc3b7" stopOpacity="0.8" />
        <stop offset="1" stopColor="#3f9d91" stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id={`${id}-canto`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7fc4b8" />
        <stop offset="1" stopColor="#1d6f68" />
      </linearGradient>
      <linearGradient id={`${id}-laton`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ecd29a" />
        <stop offset="0.45" stopColor="#b88f45" />
        <stop offset="1" stopColor="#7a5f2d" />
      </linearGradient>
      <linearGradient id={`${id}-brillo`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-espejo`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-esfera`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
        <stop offset="0.45" stopColor="#bfe0da" stopOpacity="0.9" />
        <stop offset="1" stopColor="#3f9d91" stopOpacity="0.95" />
      </radialGradient>
      <filter id={`${id}-sombra`} x="-30%" y="-80%" width="160%" height="260%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </>
  );
}

/** Sombra de contacto suave sobre la superficie donde apoya el objeto. */
export function Sombra({
  id,
  cx,
  cy,
  rx,
  ry,
}: {
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}): ReactElement {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill="#083431"
      opacity="0.26"
      filter={`url(#${id}-sombra)`}
    />
  );
}

export interface CristalProps {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r?: number;
  /** Giro en grados alrededor del centro. */
  readonly giro?: number;
  /** Vidrio con tinte verde en lugar de claro. */
  readonly verde?: boolean;
  /** Grosor visible del canto. */
  readonly grosor?: number;
}

/** Una hoja de vidrio: canto con grosor, cuerpo translúcido, bisel interior, dos bandas de reflejo y un
 *  destello de luz en la esquina. */
export function Cristal({
  id,
  x,
  y,
  w,
  h,
  r = 6,
  giro = 0,
  verde = false,
  grosor = 6,
}: CristalProps): ReactElement {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const recorte = `${id}-c-${String(x)}-${String(y)}`;
  return (
    <g transform={giro === 0 ? undefined : `rotate(${String(giro)} ${String(cx)} ${String(cy)})`}>
      <rect
        x={x + grosor}
        y={y + grosor * 0.7}
        width={w}
        height={h}
        rx={r}
        fill={`url(#${id}-canto)`}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill={`url(#${id}-${verde ? 'verde' : 'cuerpo'})`}
        stroke="#ffffff"
        strokeOpacity="0.95"
        strokeWidth="1.25"
      />
      <rect
        x={x + 3}
        y={y + 3}
        width={w - 6}
        height={h - 6}
        rx={Math.max(r - 2, 2)}
        fill="none"
        stroke={VERDE}
        strokeOpacity="0.16"
      />
      <clipPath id={recorte}>
        <rect x={x} y={y} width={w} height={h} rx={r} />
      </clipPath>
      <g clipPath={`url(#${recorte})`}>
        <path
          d={`M${String(x + w * 0.12)} ${String(y)}h${String(w * 0.16)}l${String(-w * 0.34)} ${String(h)}h${String(-w * 0.16)}z`}
          fill={`url(#${id}-brillo)`}
          opacity="0.7"
        />
        <path
          d={`M${String(x + w * 0.46)} ${String(y)}h${String(w * 0.07)}l${String(-w * 0.34)} ${String(h)}h${String(-w * 0.07)}z`}
          fill={`url(#${id}-brillo)`}
          opacity="0.45"
        />
        <circle
          cx={x + w * 0.2}
          cy={y + h * 0.14}
          r={Math.min(w, h) * 0.34}
          fill={`url(#${id}-espejo)`}
        />
      </g>
    </g>
  );
}
