import { useId } from 'react';
import type { ReactElement } from 'react';

import { Cristal, DefinicionesDeVidrio, Sombra } from './cristal';

/** Una ilustración por sección, con el vidrio como hilo: hojas con grosor y reflejos, sombra de contacto y un
 *  detalle en latón que cuenta el oficio de esa sección (la medida exacta, el seguimiento, el cuidado de lo
 *  que el cliente confía). Sobrias y sin adornos de más, como pidió el cliente: confianza y seguridad
 *  [RESPUESTAS_DE_LUIS #4, ADR-0037]. Son solo adorno: no llevan texto ni se leen en voz alta. */
export const SECCIONES_CON_ILUSTRACION = [
  'catalogo',
  'cotizador',
  'ordenes',
  'mostrador',
  'reportes',
  'clientes',
  'cuentas-por-cobrar',
  'facturas',
  'usuarios',
  'configuracion',
] as const;

export type SeccionIlustrada = (typeof SECCIONES_CON_ILUSTRACION)[number];

export function tieneIlustracion(seccion: string | null): seccion is SeccionIlustrada {
  return seccion !== null && (SECCIONES_CON_ILUSTRACION as readonly string[]).includes(seccion);
}

const VERDE = '#0f5c57';
const LATON_OSCURO = '#6f5526';

type Dibujo = (id: string) => ReactElement;

const laton = (id: string): string => `url(#${id}-laton)`;
const num = (n: number): string => String(Math.round(n * 100) / 100);

/** Una cuadrícula tenue de plano, detrás de lo que se mide o se proyecta. */
function Plano({
  x,
  y,
  w,
  h,
  paso,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  paso: number;
}): ReactElement {
  const lineas: ReactElement[] = [];
  for (let i = 0; i <= w / paso; i += 1) {
    lineas.push(<path key={`v${String(i)}`} d={`M${num(x + i * paso)} ${num(y)}v${num(h)}`} />);
  }
  for (let j = 0; j <= h / paso; j += 1) {
    lineas.push(<path key={`h${String(j)}`} d={`M${num(x)} ${num(y + j * paso)}h${num(w)}`} />);
  }
  return (
    <g stroke={VERDE} strokeOpacity="0.1" strokeWidth="1">
      {lineas}
    </g>
  );
}

/** Flecha de cota: línea con puntas en los extremos. */
function Cota({ d, puntas }: { d: string; puntas: string }): ReactElement {
  return (
    <g
      stroke={LATON_OSCURO}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d={d} />
      <path d={puntas} fill={LATON_OSCURO} />
    </g>
  );
}

/** Prisma de vidrio en perspectiva: frente, lado y tapa. */
function Prisma({
  id,
  x,
  base,
  w,
  h,
  verde = false,
}: {
  id: string;
  x: number;
  base: number;
  w: number;
  h: number;
  verde?: boolean;
}): ReactElement {
  const dx = 11;
  const dy = -7;
  const top = base - h;
  return (
    <g>
      <path
        d={`M${num(x + w)} ${num(top)}l${num(dx)} ${num(dy)}v${num(h)}l${num(-dx)} ${num(-dy)}z`}
        fill={`url(#${id}-canto)`}
      />
      <path
        d={`M${num(x)} ${num(top)}l${num(dx)} ${num(dy)}h${num(w)}l${num(-dx)} ${num(-dy)}z`}
        fill="#ffffff"
        fillOpacity="0.9"
        stroke="#ffffff"
        strokeOpacity="0.9"
      />
      <rect
        x={x}
        y={top}
        width={w}
        height={h}
        rx="3"
        fill={`url(#${id}-${verde ? 'verde' : 'cuerpo'})`}
        stroke="#ffffff"
        strokeOpacity="0.95"
        strokeWidth="1.25"
      />
      <path
        d={`M${num(x + w * 0.18)} ${num(top)}h${num(w * 0.16)}l${num(-w * 0.22)} ${num(h)}h${num(-w * 0.14)}z`}
        fill={`url(#${id}-brillo)`}
        opacity="0.6"
      />
    </g>
  );
}

/** Estrella de bordes de un sello. */
function estrella(cx: number, cy: number, rExt: number, rInt: number, puntas: number): string {
  const pts: string[] = [];
  for (let i = 0; i < puntas * 2; i += 1) {
    const ang = (Math.PI * i) / puntas - Math.PI / 2;
    const r = i % 2 === 0 ? rExt : rInt;
    pts.push(`${num(cx + r * Math.cos(ang))},${num(cy + r * Math.sin(ang))}`);
  }
  return pts.join(' ');
}

const DIBUJOS: Record<SeccionIlustrada, Dibujo> = {
  // Hojas de vidrio en su caballete, con la etiqueta de precio: lo que se ofrece, ordenado y cuidado.
  catalogo: (id) => (
    <g>
      <Sombra id={id} cx={160} cy={178} rx={124} ry={7} />
      <path d="M52 168l-8 14h12l6-14zM268 168l8 14h-12l-6-14z" fill={laton(id)} />
      <Cristal id={id} x={66} y={46} w={72} h={120} giro={-8} />
      <Cristal id={id} x={124} y={32} w={74} h={134} verde />
      <Cristal id={id} x={184} y={48} w={72} h={118} giro={8} />
      <rect
        x="40"
        y="165"
        width="240"
        height="8"
        rx="4"
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.4"
      />
      <path d="M161 38v26" stroke={LATON_OSCURO} strokeWidth="1.25" />
      <path
        d="M149 64h24l5 6v16h-34V70z"
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.55"
        strokeLinejoin="round"
      />
      <circle cx="161" cy="72" r="2.5" fill="#fff" opacity="0.9" />
      <path
        d="M154 80h14M154 85h9"
        stroke="#fff"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  ),
  // Un vidrio con sus cotas y la cinta métrica: la medida exacta antes de cortar.
  cotizador: (id) => {
    const marcas: ReactElement[] = [];
    for (let i = 0; i <= 40; i += 1) {
      const largo = i % 10 === 0 ? 7 : i % 5 === 0 ? 5 : 3;
      marcas.push(<path key={i} d={`M${num(66 + i * 4.7)} 164v${String(largo)}`} />);
    }
    return (
      <g>
        <Plano x={40} y={22} w={240} h={150} paso={20} />
        <Sombra id={id} cx={160} cy={156} rx={92} ry={6} />
        <Cristal id={id} x={96} y={54} w={128} h={98} />
        <Cota d="M96 34h128M96 28v14M224 28v14" puntas="M96 34l7-3.5v7zM224 34l-7-3.5v7z" />
        <rect
          x="136"
          y="26"
          width="48"
          height="16"
          rx="8"
          fill="#fff"
          stroke={LATON_OSCURO}
          strokeWidth="1.25"
        />
        <path d="M146 34h28" stroke={LATON_OSCURO} strokeWidth="2" strokeLinecap="round" />
        <Cota d="M246 54v98M240 54h12M240 152h12" puntas="M246 54l-3.5 7h7zM246 152l-3.5-7h7z" />
        <rect
          x="238"
          y="92"
          width="16"
          height="22"
          rx="8"
          fill="#fff"
          stroke={LATON_OSCURO}
          strokeWidth="1.25"
        />
        <rect
          x="60"
          y="158"
          width="200"
          height="20"
          rx="3"
          fill={laton(id)}
          stroke={LATON_OSCURO}
          strokeOpacity="0.45"
        />
        <path d="M60 163h200" stroke="#fff" strokeOpacity="0.35" />
        <g stroke={LATON_OSCURO} strokeWidth="1" strokeLinecap="round" transform="translate(0 0)">
          {marcas}
        </g>
      </g>
    );
  },
  // Del trazo a la pieza terminada, con su línea de avance: seguimiento de cada trabajo.
  ordenes: (id) => (
    <g>
      <Sombra id={id} cx={160} cy={156} rx={128} ry={6} />
      <g fill="none" stroke={VERDE} strokeOpacity="0.5" strokeWidth="1.5">
        <rect x="30" y="52" width="68" height="94" rx="6" strokeDasharray="5 5" />
        <path
          d="M24 46h10M30 40v10M104 46h-10M98 40v10M24 152h10M30 158v-10M104 152h-10M98 158v-10"
          stroke={LATON_OSCURO}
          strokeOpacity="0.8"
          strokeLinecap="round"
        />
      </g>
      <Cristal id={id} x={126} y={52} w={68} h={94} />
      <path
        d="M120 128l82-56"
        stroke={LATON_OSCURO}
        strokeWidth="1.75"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <circle cx="120" cy="128" r="3.5" fill={laton(id)} />
      <circle cx="202" cy="72" r="3.5" fill={laton(id)} />
      <Cristal id={id} x={222} y={52} w={68} h={94} verde />
      <circle cx="268" cy="136" r="17" fill={laton(id)} stroke={LATON_OSCURO} strokeOpacity="0.5" />
      <circle cx="268" cy="136" r="12.5" fill="none" stroke="#fff" strokeOpacity="0.6" />
      <path
        d="M261 136l5 5 9-10"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g stroke={LATON_OSCURO} strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M100 100h18" />
        <path d="M112 95l7 5-7 5" />
        <path d="M196 100h18" />
        <path d="M208 95l7 5-7 5" />
      </g>
    </g>
  ),
  // El mostrador de cristal con su ticket y QR: cobrar al momento.
  mostrador: (id) => (
    <g>
      <Sombra id={id} cx={150} cy={164} rx={118} ry={8} />
      <path
        d="M44 124l200 0 34-30H78z"
        fill="#ffffff"
        fillOpacity="0.8"
        stroke="#fff"
        strokeOpacity="0.9"
      />
      <path d="M44 124h200v8H44z" fill={`url(#${id}-canto)`} />
      <path d="M244 124l34-30v8l-34 30z" fill={`url(#${id}-canto)`} />
      <rect
        x="44"
        y="132"
        width="200"
        height="30"
        rx="4"
        fill={`url(#${id}-cuerpo)`}
        stroke="#fff"
        strokeOpacity="0.9"
      />
      <path d="M62 132v30M226 132v30" stroke={VERDE} strokeOpacity="0.14" />
      <path d="M78 94h200" stroke="#fff" strokeOpacity="0.9" />
      <ellipse
        cx="92"
        cy="112"
        rx="14"
        ry="5"
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.5"
      />
      <ellipse
        cx="92"
        cy="108"
        rx="14"
        ry="5"
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.5"
      />
      <g transform="rotate(5 218 86)">
        <path
          d="M186 26h64v94l-6.4-5-6.4 5-6.4-5-6.4 5-6.4-5-6.4 5-6.4-5-6.4 5-6.4-5-3.4 3.2z"
          fill="#000"
          opacity="0.08"
          transform="translate(4 4)"
        />
        <path
          d="M186 26h64v94l-6.4-5-6.4 5-6.4-5-6.4 5-6.4-5-6.4 5-6.4-5-6.4 5-6.4-5-3.4 3.2z"
          fill="#fff"
          stroke={VERDE}
          strokeOpacity="0.3"
          strokeLinejoin="round"
        />
        <g fill={VERDE} opacity="0.78">
          <rect x="196" y="36" width="9" height="9" />
          <rect x="207" y="36" width="5" height="5" />
          <rect x="214" y="36" width="9" height="9" />
          <rect x="196" y="47" width="5" height="5" />
          <rect x="203" y="47" width="9" height="5" />
          <rect x="214" y="47" width="5" height="9" />
          <rect x="221" y="47" width="5" height="5" />
          <rect x="196" y="54" width="9" height="9" />
          <rect x="214" y="58" width="9" height="5" />
        </g>
        <path
          d="M196 76h44M196 86h32M196 96h40"
          stroke={VERDE}
          strokeOpacity="0.3"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="196" y="104" width="44" height="7" rx="3.5" fill={laton(id)} />
      </g>
    </g>
  ),
  // Prismas de vidrio que suben y la línea de tendencia: cómo va el negocio.
  reportes: (id) => (
    <g>
      <Plano x={40} y={36} w={250} h={132} paso={22} />
      <Sombra id={id} cx={165} cy={168} rx={122} ry={6} />
      <Prisma id={id} x={52} base={166} w={36} h={46} />
      <Prisma id={id} x={104} base={166} w={36} h={76} verde />
      <Prisma id={id} x={156} base={166} w={36} h={62} />
      <Prisma id={id} x={208} base={166} w={36} h={108} verde />
      <path d="M40 166h232" stroke={VERDE} strokeOpacity="0.3" strokeWidth="1.5" />
      <path
        d="M70 108l52-30 52 14 52-46"
        stroke={LATON_OSCURO}
        strokeOpacity="0.35"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M70 106l52-30 52 14 52-46"
        stroke={laton(id)}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="226" cy="44" r="9" fill="#fff" stroke={LATON_OSCURO} strokeWidth="2" />
      <circle cx="226" cy="44" r="3.5" fill={laton(id)} />
    </g>
  ),
  // Dos medallones de cristal con su busto grabado: el trato cercano con quien confía su obra.
  clientes: (id) => {
    const busto = (cx: number, cy: number, s: number, tono: string): ReactElement => (
      <g fill={tono} fillOpacity="0.92" stroke={VERDE} strokeOpacity="0.3">
        <circle cx={cx} cy={cy - 12 * s} r={14 * s} />
        <path
          d={`M${num(cx - 28 * s)} ${num(cy + 30 * s)}c0-${num(20 * s)} ${num(12 * s)}-${num(30 * s)} ${num(28 * s)}-${num(30 * s)}s${num(28 * s)} ${num(10 * s)} ${num(28 * s)} ${num(30 * s)}z`}
        />
      </g>
    );
    return (
      <g>
        <Sombra id={id} cx={170} cy={168} rx={120} ry={7} />
        <circle cx="130" cy="106" r="58" fill={`url(#${id}-canto)`} transform="translate(6 5)" />
        <circle
          cx="130"
          cy="106"
          r="58"
          fill={`url(#${id}-cuerpo)`}
          stroke="#fff"
          strokeWidth="1.5"
        />
        <circle cx="130" cy="106" r="52" fill="none" stroke={VERDE} strokeOpacity="0.15" />
        <circle cx="130" cy="106" r="62" fill="none" stroke={laton(id)} strokeWidth="2.5" />
        <circle cx="112" cy="78" r="22" fill={`url(#${id}-espejo)`} />
        {busto(130, 100, 1, '#ffffff')}
        <circle cx="228" cy="122" r="40" fill={`url(#${id}-canto)`} transform="translate(5 4)" />
        <circle
          cx="228"
          cy="122"
          r="40"
          fill={`url(#${id}-verde)`}
          stroke="#fff"
          strokeWidth="1.5"
        />
        <circle cx="216" cy="104" r="16" fill={`url(#${id}-espejo)`} />
        {busto(228, 118, 0.7, '#ffffff')}
      </g>
    );
  },
  // Una balanza de latón con pesas y platos de cristal: cuentas claras, lo que se debe y desde cuándo.
  'cuentas-por-cobrar': (id) => (
    <g>
      <Sombra id={id} cx={160} cy={180} rx={64} ry={5} />
      <path
        d="M126 178l8-12h52l8 12z"
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.5"
        strokeLinejoin="round"
      />
      <rect x="156" y="62" width="9" height="106" rx="4" fill={laton(id)} />
      <circle
        cx="160.5"
        cy="58"
        r="10"
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.5"
      />
      <circle cx="160.5" cy="58" r="4" fill="#fff" opacity="0.7" />
      <path
        d="M62 78L259 46"
        stroke={LATON_OSCURO}
        strokeOpacity="0.4"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path d="M62 76L259 44" stroke={laton(id)} strokeWidth="6" strokeLinecap="round" />
      <circle cx="62" cy="78" r="5" fill={laton(id)} />
      <circle cx="259" cy="46" r="5" fill={laton(id)} />
      <g stroke={LATON_OSCURO} strokeOpacity="0.7" strokeWidth="1.25">
        <path d="M62 82L28 134M62 82l34 52" />
        <path d="M259 50l-34 52M259 50l34 52" />
      </g>
      <ellipse
        cx="62"
        cy="138"
        rx="38"
        ry="9"
        fill={`url(#${id}-canto)`}
        transform="translate(2 4)"
      />
      <ellipse
        cx="62"
        cy="136"
        rx="38"
        ry="9"
        fill={`url(#${id}-cuerpo)`}
        stroke="#fff"
        strokeWidth="1.25"
      />
      <g fill={laton(id)} stroke={LATON_OSCURO} strokeOpacity="0.5">
        <ellipse cx="50" cy="132" rx="11" ry="4" />
        <ellipse cx="50" cy="127.5" rx="11" ry="4" />
        <ellipse cx="50" cy="123" rx="11" ry="4" />
        <ellipse cx="72" cy="131" rx="11" ry="4" />
        <ellipse cx="72" cy="126.5" rx="11" ry="4" />
      </g>
      <ellipse
        cx="259"
        cy="106"
        rx="38"
        ry="9"
        fill={`url(#${id}-canto)`}
        transform="translate(2 4)"
      />
      <ellipse
        cx="259"
        cy="104"
        rx="38"
        ry="9"
        fill={`url(#${id}-cuerpo)`}
        stroke="#fff"
        strokeWidth="1.25"
      />
      <path
        d="M248 100l22-1 8 10h-22z"
        fill={`url(#${id}-verde)`}
        stroke="#fff"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </g>
  ),
  // Tres hojas de vidrio con la factura y su sello de latón: firme y en regla.
  facturas: (id) => (
    <g>
      <Sombra id={id} cx={160} cy={176} rx={96} ry={6} />
      <Cristal id={id} x={72} y={22} w={118} h={146} r={8} giro={-4} />
      <Cristal id={id} x={96} y={26} w={118} h={146} r={8} giro={-1} />
      <Cristal id={id} x={118} y={30} w={118} h={142} r={8} giro={3} />
      <rect
        x="136"
        y="48"
        width="48"
        height="9"
        rx="4.5"
        fill={`url(#${id}-canto)`}
        opacity="0.85"
      />
      <path
        d="M136 72h82M136 86h64M136 100h74"
        stroke={VERDE}
        strokeOpacity="0.32"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path d="M136 116h82" stroke={VERDE} strokeOpacity="0.2" strokeWidth="1" />
      <path
        d="M200 144l-8 28 14-8 14 8-6-28z"
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.5"
        strokeLinejoin="round"
      />
      <polygon
        points={estrella(206, 138, 27, 23, 16)}
        fill={laton(id)}
        stroke={LATON_OSCURO}
        strokeOpacity="0.5"
        strokeLinejoin="round"
      />
      <circle
        cx="206"
        cy="138"
        r="17"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <path
        d="M198 138l6 6 11-12"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  ),
  // Una puerta de cristal con su cerradura y una llave de latón: quién entra y con qué llave.
  usuarios: (id) => (
    <g>
      <Sombra id={id} cx={165} cy={176} rx={112} ry={6} />
      <Cristal id={id} x={90} y={24} w={112} h={146} r={10} />
      <circle cx="146" cy="82" r="24" fill={laton(id)} stroke={LATON_OSCURO} strokeOpacity="0.5" />
      <circle cx="146" cy="82" r="19" fill="none" stroke="#fff" strokeOpacity="0.45" />
      <circle cx="146" cy="76" r="6.5" fill="#0a3f3b" opacity="0.88" />
      <path d="M142.5 80h7l2.5 16h-12z" fill="#0a3f3b" opacity="0.88" />
      <Sombra id={id} cx={240} cy={168} rx={46} ry={4} />
      <g transform="rotate(-16 232 150)">
        <circle
          cx="262"
          cy="150"
          r="17"
          fill={laton(id)}
          stroke={LATON_OSCURO}
          strokeOpacity="0.55"
        />
        <circle
          cx="262"
          cy="150"
          r="7.5"
          fill="#fff"
          fillOpacity="0.85"
          stroke={LATON_OSCURO}
          strokeOpacity="0.4"
        />
        <rect
          x="190"
          y="146"
          width="62"
          height="8"
          rx="3.5"
          fill={laton(id)}
          stroke={LATON_OSCURO}
          strokeOpacity="0.5"
        />
        <path
          d="M194 154h7v9h-7zM205 154h7v6h-7zM216 154h7v11h-7z"
          fill={laton(id)}
          stroke={LATON_OSCURO}
          strokeOpacity="0.5"
          strokeLinejoin="round"
        />
      </g>
    </g>
  ),
  // Una placa de cristal con reguladores de perilla: ajustar cada detalle a la medida.
  configuracion: (id) => {
    const tornillo = (cx: number, cy: number): ReactElement => (
      <g key={`${String(cx)}-${String(cy)}`}>
        <circle
          cx={cx}
          cy={cy}
          r="4.5"
          fill={laton(id)}
          stroke={LATON_OSCURO}
          strokeOpacity="0.5"
        />
        <path
          d={`M${num(cx - 2.6)} ${num(cy - 2.6)}l5.2 5.2`}
          stroke={LATON_OSCURO}
          strokeWidth="1.1"
        />
      </g>
    );
    const regulador = (y: number, valor: number, verde: boolean): ReactElement => {
      const x = 72 + valor * 176;
      const marcas: ReactElement[] = [];
      for (let i = 0; i <= 10; i += 1) {
        marcas.push(
          <path key={i} d={`M${num(72 + i * 17.6)} ${num(y - 17)}v${i % 5 === 0 ? '6' : '3.5'}`} />,
        );
      }
      return (
        <g key={y}>
          <g stroke={LATON_OSCURO} strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round">
            {marcas}
          </g>
          <path
            d={`M72 ${String(y)}h176`}
            stroke="#0a3f3b"
            strokeOpacity="0.22"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d={`M72 ${String(y)}H${num(x)}`}
            stroke="#b88f45"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <ellipse cx={x + 1} cy={y + 15} rx="11" ry="3" fill="#083431" opacity="0.2" />
          <circle
            cx={x}
            cy={y}
            r="13"
            fill={`url(#${id}-esfera)`}
            stroke="#fff"
            strokeOpacity="0.85"
            strokeWidth="1.25"
          />
          <circle cx={x - 4} cy={y - 5} r="3.8" fill="#fff" opacity="0.9" />
          {verde ? <circle cx={x} cy={y} r="3" fill={laton(id)} /> : null}
        </g>
      );
    };
    return (
      <g>
        <Sombra id={id} cx={160} cy={172} rx={118} ry={7} />
        <Cristal id={id} x={44} y={30} w={232} h={140} r={12} />
        {tornillo(56, 42)}
        {tornillo(264, 42)}
        {tornillo(56, 158)}
        {tornillo(264, 158)}
        {regulador(70, 0.28, true)}
        {regulador(104, 0.72, false)}
        {regulador(138, 0.46, true)}
      </g>
    );
  },
};

export function IlustracionDeSeccion({
  seccion,
  className,
}: {
  readonly seccion: SeccionIlustrada;
  readonly className?: string;
}): ReactElement {
  const id = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 320 200"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <DefinicionesDeVidrio id={id} />
      </defs>
      {DIBUJOS[seccion](id)}
    </svg>
  );
}
