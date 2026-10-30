import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { textos } from '../shared/i18n/textos';
import { seccionesVisibles, type Interruptor, type Seccion } from './secciones';

/** Panel de inicio: por ahora solo accesos a las secciones, sin cifras (contenido por rol: PD-31). */
export function PanelDeInicio({
  interruptores,
  conectar = false,
}: {
  readonly interruptores: ReadonlySet<Interruptor>;
  /** Muestra el acceso para conectar esta tablet con un código de registro. */
  readonly conectar?: boolean;
}): ReactElement {
  const accesos: Seccion[] = [
    ...seccionesVisibles('principal', interruptores),
    ...seccionesVisibles('secundaria', interruptores),
  ];

  return (
    <section className="anima-entrada">
      <h1>{textos.inicio.titulo}</h1>
      <p>{textos.inicio.descripcion}</p>
      <ul className="accesos">
        {accesos.map((seccion) => (
          <li key={seccion.id}>
            <Link to={seccion.ruta} className="acceso">
              {seccion.texto}
            </Link>
          </li>
        ))}
      </ul>
      {conectar ? (
        <p>
          <Link to="/conectar" className="acceso">
            {textos.conectar.titulo}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/** Sección que todavía no se construye: estado vacío sin datos de relleno [RN-23]. */
export function SeccionVacia({ titulo }: { readonly titulo: string }): ReactElement {
  return (
    <section className="anima-entrada">
      <h1>{titulo}</h1>
      <p>{textos.seccionVacia.descripcion}</p>
    </section>
  );
}
