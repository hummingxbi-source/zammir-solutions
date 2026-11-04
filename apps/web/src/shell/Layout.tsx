import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import type { ActiveUserSession } from '@zammir/core';

import { textos } from '../shared/i18n/textos';
import { Icono, iconoDeSeccion } from '../shared/ui/Icono';
import { IndicadorDeConexion, type SincronizacionVisible } from './IndicadorDeConexion';
import { seccionesVisibles, SECCIONES, type Interruptor, type Seccion } from './secciones';
import { useSeccionesVisitadas } from './useSeccionesVisitadas';

export interface LayoutProps {
  readonly interruptores: ReadonlySet<Interruptor>;
  readonly children: ReactNode;
  /** Estado del envío de lo guardado en la tablet; sin esto solo se avisa si no hay internet. */
  readonly sincronizacion?: SincronizacionVisible | undefined;
  /** Quién usa la tablet; con ella el encabezado saluda por su nombre. */
  readonly session?: ActiveUserSession | undefined;
  /** Hora actual, para probar la fecha del encabezado. */
  readonly ahora?: () => Date;
}

/** Fecha larga en hora de México, por ejemplo "martes, 3 de noviembre de 2026" [RN-17]. */
export function fechaLarga(instante: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instante);
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

function EnlaceDeSeccion({
  seccion,
  numero,
  visitada,
}: {
  readonly seccion: Seccion;
  readonly numero?: number;
  readonly visitada?: boolean;
}): ReactElement {
  return (
    <NavLink to={seccion.ruta} className="nav__enlace">
      <Icono nombre={iconoDeSeccion(seccion.id)} />
      <span className="nav__texto">{seccion.texto}</span>
      {numero !== undefined ? (
        <span className="nav__numero" aria-hidden="true">
          {numero}
        </span>
      ) : null}
      {visitada === true ? (
        <span className="nav__visitada">
          <span aria-hidden="true">✓</span>
          <span className="solo-lectores">{textos.navegacion.yaVisitada}</span>
        </span>
      ) : null}
    </NavLink>
  );
}

const NINGUNA_SESION = (): (() => void) => () => undefined;

/** Marco de la aplicación: barra lateral con las secciones en el orden del trabajo (numeración discreta y
 *  marca de visitadas) y las demás aparte, encabezado con la fecha y el saludo, y la franja de estado
 *  [RF-UX-01, RF-UX-06, ADR-0028]. En pantallas angostas la barra pasa arriba y se desplaza sola, sin
 *  que la página se desplace de lado. */
export function Layout({
  interruptores,
  children,
  sincronizacion,
  session,
  ahora = () => new Date(),
}: LayoutProps): ReactElement {
  const { pathname } = useLocation();
  const { visitadas, marcar } = useSeccionesVisitadas();

  useEffect(() => {
    const actual = SECCIONES.find((seccion) => pathname.startsWith(seccion.ruta));
    if (actual !== undefined) {
      marcar(actual.id);
    }
  }, [pathname, marcar]);

  const suscribir = useCallback(
    (aviso: () => void) => (session === undefined ? NINGUNA_SESION() : session.subscribe(aviso)),
    [session],
  );
  const leerNombre = useCallback((): string | null => {
    if (session === undefined) {
      return null;
    }
    const estado = session.state();
    return estado.kind === 'ACTIVE' ? estado.user.name : null;
  }, [session]);
  const nombre = useSyncExternalStore(suscribir, leerNombre);

  const principales = seccionesVisibles('principal', interruptores);
  const secundarias = seccionesVisibles('secundaria', interruptores);

  return (
    <div className="marco">
      <aside className="barra">
        <Link to="/" className="barra__logo" aria-label={textos.navegacion.irAlInicio}>
          {textos.app.nombre}
        </Link>

        <div className="barra__navs">
          <nav aria-label={textos.navegacion.principal} className="barra__grupo">
            <p className="rotulo barra__titulo" aria-hidden="true">
              {textos.navegacion.flujoDeTrabajo}
            </p>
            <ol className="nav">
              {principales.map((seccion, indice) => (
                <li key={seccion.id}>
                  <EnlaceDeSeccion
                    seccion={seccion}
                    numero={indice + 1}
                    visitada={visitadas.has(seccion.id)}
                  />
                </li>
              ))}
            </ol>
          </nav>

          <nav aria-label={textos.navegacion.secundaria} className="barra__grupo">
            <p className="rotulo barra__titulo" aria-hidden="true">
              {textos.navegacion.administracion}
            </p>
            <ul className="nav">
              {secundarias.map((seccion) => (
                <li key={seccion.id}>
                  <EnlaceDeSeccion seccion={seccion} />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      <div className="marco__cuerpo">
        <IndicadorDeConexion sincronizacion={sincronizacion} />

        <header className="marco__cabecera">
          <p className="rotulo marco__fecha">{fechaLarga(ahora())}</p>
          {nombre !== null ? (
            <p className="marco__saludo">{textos.navegacion.saludo(primerNombre(nombre))}</p>
          ) : null}
        </header>

        <main className="marco__contenido">{children}</main>
      </div>
    </div>
  );
}
