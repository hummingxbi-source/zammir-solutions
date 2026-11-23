import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { useSesionAdmin } from '../modules/identity/ui/SesionAdmin';
import { textos } from '../shared/i18n/textos';
import { Icono, type NombreDeIcono } from '../shared/ui/Icono';

const t = textos.inicio.formasDeEntrar;

export interface FormasDeEntrarProps {
  /** Ofrece conectar esta tablet (todavía no tiene registro). */
  readonly conectar: boolean;
  /** Ofrece entrar con PIN (nadie ha entrado en la tablet). */
  readonly entrar: boolean;
  /** La tablet ya tiene registro: se muestra como paso cumplido. */
  readonly tabletConectada: boolean;
}

interface Llave {
  readonly id: string;
  readonly icono: NombreDeIcono;
  readonly titulo: string;
  readonly cuando: string;
  readonly descripcion: string;
  readonly accion: { readonly texto: string; readonly a: string } | null;
  readonly cumplido: string | null;
}

/** Las tres formas de entrar, explicadas en el inicio: la tablet (una vez, con un código), las personas (todos
 *  los días, con su PIN) y el administrador (en la computadora, con correo y contraseña). Debajo, el orden para
 *  dejar el sistema listo la primera vez [RF-UX-02, RF-UX-05]. Solo aparece mientras falte algo. */
export function FormasDeEntrar({
  conectar,
  entrar,
  tabletConectada,
}: FormasDeEntrarProps): ReactElement | null {
  const { usuario } = useSesionAdmin();
  if (!conectar && !entrar) {
    return null;
  }
  const adminDentro = usuario !== null;

  const llaves: readonly Llave[] = [
    {
      id: 'tablet',
      icono: 'nube',
      titulo: t.tablet.titulo,
      cuando: t.tablet.cuando,
      descripcion: t.tablet.descripcion,
      accion: conectar ? { texto: textos.conectar.titulo, a: '/conectar' } : null,
      cumplido: tabletConectada ? t.tablet.lista : null,
    },
    {
      id: 'personas',
      icono: 'usuarios',
      titulo: t.personas.titulo,
      cuando: t.personas.cuando,
      descripcion: t.personas.descripcion,
      accion: entrar ? { texto: textos.personas.acceso, a: '/entrar' } : null,
      cumplido: null,
    },
    {
      id: 'administrador',
      icono: 'configuracion',
      titulo: t.administrador.titulo,
      cuando: t.administrador.cuando,
      descripcion: t.administrador.descripcion,
      accion: adminDentro ? null : { texto: textos.cuenta.entrar, a: '/administrador' },
      cumplido: adminDentro ? t.administrador.dentro : null,
    },
  ];

  return (
    <section className="formas-de-entrar anima-entrada" aria-labelledby="titulo-formas-de-entrar">
      <div className="formas-de-entrar__encabezado">
        <h2 id="titulo-formas-de-entrar" className="formas-de-entrar__titulo">
          {t.titulo}
        </h2>
        <p className="formas-de-entrar__descripcion">{t.descripcion}</p>
      </div>
      <ol className="formas-de-entrar__lista">
        {llaves.map((llave) => (
          <li
            key={llave.id}
            className={`llave${llave.cumplido === null ? '' : ' llave--cumplida'}`}
            data-recorrido={`llave-${llave.id}`}
          >
            <span className="llave__icono" aria-hidden="true">
              <Icono nombre={llave.cumplido === null ? llave.icono : 'verificar'} />
            </span>
            <span className="rotulo llave__cuando">{llave.cuando}</span>
            <h3 className="llave__titulo">{llave.titulo}</h3>
            <p className="llave__descripcion">{llave.descripcion}</p>
            {llave.cumplido !== null ? (
              <p className="llave__cumplido">{llave.cumplido}</p>
            ) : llave.accion !== null ? (
              <Link to={llave.accion.a} className="boton llave__boton">
                {llave.accion.texto}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>

      <details className="configuracion-inicial">
        <summary className="configuracion-inicial__resumen">{t.inicial.titulo}</summary>
        <p className="configuracion-inicial__descripcion">{t.inicial.descripcion}</p>
        <ol className="configuracion-inicial__pasos">
          {t.inicial.pasos.map((paso) => (
            <li key={paso.titulo}>
              <strong>{paso.titulo}</strong> {paso.detalle}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
