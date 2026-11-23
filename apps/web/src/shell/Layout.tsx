import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import type { ActiveUserSession } from '@zammir/core';

import { LogoZammir } from '../shared/ui/LogoZammir';
import { VidriosDecorativos } from '../shared/ui/VidriosDecorativos';
import { ContextoDeSeccion } from '../shared/ui/ContextoDeSeccion';
import { textos } from '../shared/i18n/textos';
import { Icono, iconoDeSeccion } from '../shared/ui/Icono';
import { IndicadorDeConexion, type SincronizacionVisible } from './IndicadorDeConexion';
import {
  RUTAS_DE_ACCESO,
  seccionesVisibles,
  SECCIONES,
  type Interruptor,
  type Seccion,
} from './secciones';
import { useRecorrido } from './recorrido/Recorrido';
import { BotonPorDondeEmpiezo } from './PrimerosPasos';
import { CuentaAdmin } from './CuentaAdmin';
import { Boton } from '../shared/ui/Boton';
import { useBarraOculta } from './useBarraOculta';
import { recordarDondeEstaba } from './donde-estaba';
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
    <NavLink to={seccion.ruta} className="nav__enlace" data-recorrido={`nav-${seccion.id}`}>
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
  const { oculta: barraOculta, alternar: alternarBarra } = useBarraOculta();
  const { iniciar: iniciarRecorrido } = useRecorrido();

  useEffect(() => {
    const actual = SECCIONES.find((seccion) => pathname.startsWith(seccion.ruta));
    if (actual !== undefined) {
      marcar(actual.id);
      // Para volver aquí después de entrar con el PIN o como administrador.
      recordarDondeEstaba(pathname);
    } else if (pathname === '/') {
      recordarDondeEstaba(null);
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

  const seccionActual = SECCIONES.find((seccion) => pathname.startsWith(seccion.ruta));
  const principales = seccionesVisibles('principal', interruptores);
  const secundarias = seccionesVisibles('secundaria', interruptores);

  // Las pantallas de acceso (PIN, conectar la tablet, administrador) van a pantalla completa, sin la barra
  // de secciones: todavía no hay nada que navegar.
  if (RUTAS_DE_ACCESO.includes(pathname)) {
    return (
      <div className="acceso-lienzo">
        <aside className="acceso-marca">
          <Link to="/" className="acceso-marca__logo" aria-label={textos.navegacion.irAlInicio}>
            <LogoZammir className="acceso-marca__marca" />
            {textos.app.nombre}
          </Link>
          <VidriosDecorativos className="acceso-marca__vidrios" />
          <div className="acceso-marca__texto">
            <p className="acceso-marca__lema">{textos.acceso.lema}</p>
            <p className="acceso-marca__detalle">{textos.acceso.detalle}</p>
          </div>
        </aside>
        <div className="acceso-lienzo__cuerpo">
          <IndicadorDeConexion sincronizacion={sincronizacion} />
          <main className="acceso-lienzo__contenido">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className={`marco${barraOculta ? ' marco--sin-barra' : ''}`}>
      <aside className="barra" id="barra-lateral">
        <Link to="/" className="barra__logo" aria-label={textos.navegacion.irAlInicio}>
          <LogoZammir className="barra__marca" />
          {textos.app.nombre}
        </Link>

        <div className="barra__navs">
          <NavLink to="/" end className="nav__enlace barra__inicio" data-recorrido="nav-inicio">
            <Icono nombre="inicio" />
            <span className="nav__texto">{textos.navegacion.inicio}</span>
          </NavLink>

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

        <div className="barra__pie">
          <button
            type="button"
            className="nav__enlace barra__recorrido"
            data-recorrido="boton-recorrido"
            onClick={iniciarRecorrido}
          >
            <Icono nombre="brujula" />
            <span className="nav__texto">{textos.recorrido.boton}</span>
          </button>
        </div>
      </aside>

      <div className="marco__cuerpo">
        <IndicadorDeConexion sincronizacion={sincronizacion} />

        <header className="marco__cabecera">
          <div className="marco__cabecera-izquierda">
            <Boton
              variante="secundario"
              aria-controls="barra-lateral"
              aria-expanded={!barraOculta}
              onClick={alternarBarra}
            >
              <Icono nombre="panelLateral" />
              {barraOculta ? textos.navegacion.mostrarMenu : textos.navegacion.ocultarMenu}
            </Boton>
            <div className="marco__cabecera-texto">
              <p className="rotulo marco__fecha">{fechaLarga(ahora())}</p>
              {nombre !== null ? (
                <p className="marco__saludo">{textos.navegacion.saludo(primerNombre(nombre))}</p>
              ) : null}
            </div>
          </div>
          <CuentaAdmin />
        </header>

        <main className="marco__contenido">
          <ContextoDeSeccion.Provider value={seccionActual?.id ?? null}>
            {children}
          </ContextoDeSeccion.Provider>
        </main>
        <BotonPorDondeEmpiezo interruptores={interruptores} visitadas={visitadas} />
      </div>
    </div>
  );
}
