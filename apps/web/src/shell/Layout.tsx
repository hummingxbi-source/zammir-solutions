import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { textos } from '../shared/i18n/textos';
import { IndicadorDeConexion } from './IndicadorDeConexion';
import { seccionesVisibles, SECCIONES, type Interruptor } from './secciones';
import { useSeccionesVisitadas } from './useSeccionesVisitadas';

export interface LayoutProps {
  readonly interruptores: ReadonlySet<Interruptor>;
  readonly children: ReactNode;
}

/** Marco de la aplicación: logo que lleva al panel de inicio, secciones en el orden del trabajo
 *  con numeración discreta y marca de visitadas, y un menú secundario [RF-UX-01]. */
export function Layout({ interruptores, children }: LayoutProps): ReactElement {
  const { pathname } = useLocation();
  const { visitadas, marcar } = useSeccionesVisitadas();

  useEffect(() => {
    const actual = SECCIONES.find((seccion) => pathname.startsWith(seccion.ruta));
    if (actual !== undefined) {
      marcar(actual.id);
    }
  }, [pathname, marcar]);

  const principales = seccionesVisibles('principal', interruptores);
  const secundarias = seccionesVisibles('secundaria', interruptores);

  return (
    <div className="marco">
      <header className="marco__encabezado">
        <Link to="/" className="marco__logo" aria-label={textos.navegacion.irAlInicio}>
          {textos.app.nombre}
        </Link>

        <nav aria-label={textos.navegacion.principal}>
          <ol className="nav">
            {principales.map((seccion, indice) => (
              <li key={seccion.id}>
                <NavLink to={seccion.ruta} className="nav__enlace">
                  <span className="nav__numero" aria-hidden="true">
                    {indice + 1}
                  </span>
                  {seccion.texto}
                  {visitadas.has(seccion.id) ? (
                    <span className="nav__visitada">
                      <span aria-hidden="true">✓</span>
                      <span className="solo-lectores">{textos.navegacion.yaVisitada}</span>
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>

        <details className="nav-mas">
          <summary className="nav-mas__resumen">{textos.navegacion.mas}</summary>
          <nav aria-label={textos.navegacion.secundaria}>
            <ul className="nav-mas__lista">
              {secundarias.map((seccion) => (
                <li key={seccion.id}>
                  <NavLink to={seccion.ruta} className="nav__enlace">
                    {seccion.texto}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </header>

      <IndicadorDeConexion />

      <main className="marco__contenido">{children}</main>
    </div>
  );
}
