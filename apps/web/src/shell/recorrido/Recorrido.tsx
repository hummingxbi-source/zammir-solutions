import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';

import { textos } from '../../shared/i18n/textos';
import { Boton } from '../../shared/ui/Boton';
import { Icono } from '../../shared/ui/Icono';
import { RUTAS_DE_ACCESO, type Interruptor } from '../secciones';
import { pasosDelRecorrido, type PasoDelRecorrido } from './pasos';
import { ANCHO_DE_HOJA, colocarGlobo, esVisible, type Caja, type Colocacion } from './posicion';

const t = textos.recorrido;

/** Se guarda en la tablet cuando la persona terminó o saltó el recorrido, para no volver a ofrecerlo solo. */
export const CLAVE_DEL_RECORRIDO = 'zammir.recorrido-visto';

/** ¿Ya se vio el recorrido en este equipo? Sin almacenamiento se responde que sí, para no insistir. */
export function recorridoVisto(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_DEL_RECORRIDO) === '1';
  } catch {
    return true;
  }
}

function marcarVisto(): void {
  try {
    window.localStorage.setItem(CLAVE_DEL_RECORRIDO, '1');
  } catch {
    // Sin almacenamiento: el recorrido se ofrecerá otra vez la próxima vez; no pasa nada.
  }
}

interface ContextoDelRecorrido {
  readonly activo: boolean;
  readonly iniciar: () => void;
}

const Contexto = createContext<ContextoDelRecorrido>({ activo: false, iniciar: () => undefined });

/** Para el botón de la barra: iniciar el recorrido otra vez. */
export function useRecorrido(): ContextoDelRecorrido {
  return useContext(Contexto);
}

export interface ProveedorDelRecorridoProps {
  readonly interruptores: ReadonlySet<Interruptor>;
  /** Lo ofrece solo la primera vez que se abre la aplicación en este equipo. */
  readonly automatico?: boolean;
  readonly children: ReactNode;
}

/** Espera antes de arrancar solo, para que la pantalla termine de aparecer. */
const ESPERA_AL_ARRANCAR = 700;

/** Recorrido guiado por todo el sistema: enfoca cada parte de la pantalla y la explica en un globo, paso a
 *  paso, navegando por las secciones [RF-UX-04, ADR-0042]. */
export function ProveedorDelRecorrido({
  interruptores,
  automatico = false,
  children,
}: ProveedorDelRecorridoProps): ReactElement {
  const pasos = useMemo(() => pasosDelRecorrido(interruptores), [interruptores]);
  const [indice, setIndice] = useState<number | null>(null);
  const irA = useNavigate();
  const { pathname } = useLocation();
  const focoPrevio = useRef<Element | null>(null);

  const iniciar = useCallback((): void => {
    focoPrevio.current = document.activeElement;
    setIndice(0);
  }, []);

  const terminar = useCallback((): void => {
    marcarVisto();
    setIndice(null);
    const previo = focoPrevio.current;
    if (previo instanceof HTMLElement && previo.isConnected) {
      previo.focus();
    }
  }, []);

  useEffect(() => {
    if (!automatico || recorridoVisto() || RUTAS_DE_ACCESO.includes(pathname)) {
      return undefined;
    }
    const espera = window.setTimeout(() => {
      focoPrevio.current = document.activeElement;
      setIndice((actual) => actual ?? 0);
    }, ESPERA_AL_ARRANCAR);
    return () => {
      window.clearTimeout(espera);
    };
  }, [automatico, pathname]);

  const paso = indice === null ? undefined : pasos[indice];

  useEffect(() => {
    if (paso?.ruta !== undefined && paso.ruta !== null && paso.ruta !== pathname) {
      void irA(paso.ruta);
    }
  }, [paso, pathname, irA]);

  const valor = useMemo(() => ({ activo: indice !== null, iniciar }), [indice, iniciar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {paso !== undefined && indice !== null
        ? createPortal(
            <CapaDelRecorrido
              paso={paso}
              numero={indice + 1}
              total={pasos.length}
              onAnterior={() => {
                setIndice(Math.max(0, indice - 1));
              }}
              onSiguiente={() => {
                if (indice + 1 >= pasos.length) {
                  terminar();
                } else {
                  setIndice(indice + 1);
                }
              }}
              onTerminar={terminar}
            />,
            document.body,
          )
        : null}
    </Contexto.Provider>
  );
}

/** Busca el primer elemento visible de la lista de objetivos del paso. */
function buscarObjetivo(objetivos: readonly string[]): Element | null {
  for (const objetivo of objetivos) {
    const elemento = document.querySelector(`[data-recorrido="${objetivo}"]`);
    if (elemento !== null && esVisible(elemento.getBoundingClientRect())) {
      return elemento;
    }
  }
  return null;
}

function cajaDe(elemento: Element): Caja {
  const { top, left, width, height } = elemento.getBoundingClientRect();
  return { top, left, width, height };
}

const mismaCaja = (a: Caja | null, b: Caja | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

/** Cuánto se busca el elemento después de cambiar de pantalla (en cuadros de animación, ~1.5 s). */
const CUADROS_DE_BUSQUEDA = 90;

const ENFOCABLES = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

interface CapaProps {
  readonly paso: PasoDelRecorrido;
  readonly numero: number;
  readonly total: number;
  readonly onAnterior: () => void;
  readonly onSiguiente: () => void;
  readonly onTerminar: () => void;
}

/** El velo con el hueco de luz sobre el elemento y el globo con la explicación. */
function CapaDelRecorrido({
  paso,
  numero,
  total,
  onAnterior,
  onSiguiente,
  onTerminar,
}: CapaProps): ReactElement {
  const idTitulo = useId();
  const idTexto = useId();
  const idMascara = `recorrido-mascara-${useId().replace(/:/g, '')}`;
  const globo = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [colocacion, setColocacion] = useState<Colocacion | null>(null);
  const primero = numero === 1;
  const ultimo = numero === total;

  // Busca el elemento (puede tardar en aparecer tras cambiar de pantalla), lo lleva a la vista y después
  // sigue su posición en cada cuadro, por si la página se desplaza o cambia de tamaño.
  useLayoutEffect(() => {
    let cuadro = 0;
    let intentos = 0;
    let elemento: Element | null = null;
    let ultimaCaja: Caja | null = null;
    let ultimaColocacion: Colocacion | null = null;
    setCaja(null);

    let llevadas = 0;
    let ultimaLlevada = 0;
    // Lleva el elemento a la vista. En el celular el globo tapa la parte de abajo, así que va arriba. Es un salto
    // directo: el desplazamiento suave se interrumpe al cambiar de sección y en la barra que se desliza de lado;
    // la suavidad la pone el hueco de luz, que se mueve con transición.
    const llevarALaVista = (destino: Element): void => {
      llevadas += 1;
      ultimaLlevada = performance.now();
      destino.scrollIntoView({
        block: window.innerWidth < ANCHO_DE_HOJA ? 'start' : 'center',
        inline: 'center',
      });
    };

    const seguir = (): void => {
      if (elemento === null && intentos < CUADROS_DE_BUSQUEDA && paso.objetivos.length > 0) {
        intentos += 1;
        elemento = buscarObjetivo(paso.objetivos);
        if (elemento !== null) {
          llevarALaVista(elemento);
        }
      }
      const actual =
        elemento !== null && elemento.isConnected && esVisible(elemento.getBoundingClientRect())
          ? cajaDe(elemento)
          : null;
      // Si la pantalla se movió después (por ejemplo, al cambiar de sección vuelve arriba) y el elemento quedó
      // fuera, se vuelve a llevar a la vista, pocas veces y sin pelear con el desplazamiento en curso.
      if (
        elemento !== null &&
        actual !== null &&
        llevadas < 4 &&
        performance.now() - ultimaLlevada > 700 &&
        (actual.top < 0 ||
          actual.left < 0 ||
          actual.top + actual.height > window.innerHeight ||
          actual.left + actual.width > window.innerWidth)
      ) {
        llevarALaVista(elemento);
      }
      if (!mismaCaja(actual, ultimaCaja)) {
        ultimaCaja = actual;
        setCaja(actual);
      }
      // El globo se coloca con su tamaño real y el de la pantalla en cada cuadro: así se acomoda solo si la
      // tablet se gira, cambia la letra o el elemento se mueve.
      const siguiente = colocarGlobo(
        actual,
        { width: globo.current?.offsetWidth ?? 0, height: globo.current?.offsetHeight ?? 0 },
        { width: window.innerWidth, height: window.innerHeight },
        paso.lado,
      );
      if (
        ultimaColocacion?.lado !== siguiente.lado ||
        Math.abs(ultimaColocacion.top - siguiente.top) >= 0.5 ||
        Math.abs(ultimaColocacion.left - siguiente.left) >= 0.5
      ) {
        ultimaColocacion = siguiente;
        setColocacion(siguiente);
      }
      cuadro = window.requestAnimationFrame(seguir);
    };
    seguir();
    return () => {
      window.cancelAnimationFrame(cuadro);
    };
  }, [paso]);

  // En cada paso el foco va al botón principal: Enter avanza y el lector de pantalla anuncia el paso.
  useEffect(() => {
    globo.current?.querySelector<HTMLElement>('[data-principal]')?.focus();
  }, [paso]);

  function alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      onTerminar();
      return;
    }
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      onSiguiente();
      return;
    }
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      if (!primero) {
        onAnterior();
      }
      return;
    }
    if (evento.key !== 'Tab' || globo.current === null) {
      return;
    }
    const lista = [...globo.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
    const inicio = lista[0];
    const fin = lista[lista.length - 1];
    if (inicio === undefined || fin === undefined) {
      return;
    }
    if (evento.shiftKey && document.activeElement === inicio) {
      evento.preventDefault();
      fin.focus();
    } else if (!evento.shiftKey && document.activeElement === fin) {
      evento.preventDefault();
      inicio.focus();
    }
  }

  const lado = colocacion?.lado ?? 'centro';
  const estiloGlobo =
    colocacion === null || lado === 'hoja'
      ? undefined
      : { top: `${String(colocacion.top)}px`, left: `${String(colocacion.left)}px` };

  return (
    <div className="recorrido" data-paso={paso.id}>
      {caja === null ? (
        <div className="recorrido__velo" aria-hidden="true" />
      ) : (
        <>
          {/* El velo con un hueco: una máscara SVG oscurece toda la pantalla menos el elemento. */}
          <svg className="recorrido__mascara" aria-hidden="true" width="100%" height="100%">
            <defs>
              <mask id={idMascara}>
                <rect width="100%" height="100%" fill="#fff" />
                <rect
                  x={caja.left - 8}
                  y={caja.top - 8}
                  width={caja.width + 16}
                  height={caja.height + 16}
                  rx={12}
                  fill="#000"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" mask={`url(#${idMascara})`} />
          </svg>
          <div
            className="recorrido__foco"
            aria-hidden="true"
            style={{
              top: `${String(caja.top - 8)}px`,
              left: `${String(caja.left - 8)}px`,
              width: `${String(caja.width + 16)}px`,
              height: `${String(caja.height + 16)}px`,
            }}
          />
        </>
      )}
      <div
        ref={globo}
        className={`recorrido__globo recorrido__globo--${lado}${ultimo ? ' recorrido__globo--final' : ''}`}
        style={estiloGlobo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        onKeyDown={alTeclear}
        key={paso.id}
      >
        {ultimo ? (
          <span className="recorrido__destellos" aria-hidden="true">
            {Array.from({ length: 12 }, (_v, i) => (
              <span
                key={i}
                className="recorrido__destello"
                style={{ rotate: `${String(i * 30)}deg`, animationDelay: `${String(i * 35)}ms` }}
              />
            ))}
          </span>
        ) : null}
        <div
          className="recorrido__progreso"
          role="progressbar"
          aria-label={t.paso(numero, total)}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={numero}
        >
          <span
            className="recorrido__avance"
            style={{ width: `${String((numero / total) * 100)}%` }}
          />
        </div>
        <div className="recorrido__cabecera">
          <span className="recorrido__insignia" aria-hidden="true">
            <Icono nombre={paso.icono} tamano={24} />
          </span>
          <p className="rotulo recorrido__rotulo">{paso.rotulo ?? t.paso(numero, total)}</p>
          <button
            type="button"
            className="recorrido__cerrar"
            aria-label={t.salir}
            onClick={onTerminar}
          >
            <Icono nombre="cerrar" />
          </button>
        </div>
        <h2 id={idTitulo} className="recorrido__titulo">
          {paso.titulo}
        </h2>
        <p id={idTexto} className="recorrido__texto">
          {paso.texto}
        </p>
        <div className="recorrido__pie">
          <span className="recorrido__contador" aria-hidden="true">
            {numero} / {total}
          </span>
          <div className="recorrido__botones">
            {primero ? (
              <Boton variante="secundario" onClick={onTerminar}>
                {t.saltar}
              </Boton>
            ) : (
              <Boton variante="secundario" onClick={onAnterior}>
                {t.anterior}
              </Boton>
            )}
            <Boton onClick={onSiguiente} data-principal="">
              {primero ? t.empezar : ultimo ? t.terminar : t.siguiente}
              {ultimo ? null : <Icono nombre="flechaDerecha" />}
            </Boton>
          </div>
        </div>
        <p className="solo-lectores">{t.ayudaTeclado}</p>
      </div>
    </div>
  );
}
