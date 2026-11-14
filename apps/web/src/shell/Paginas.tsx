import type { ReactElement, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { textos } from '../shared/i18n/textos';
import { AvisoCerrable } from '../shared/ui/AvisoCerrable';
import { EncabezadoDePagina } from '../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../shared/ui/EstadoVacio';
import { Icono, iconoDeSeccion } from '../shared/ui/Icono';
import { Tarjeta } from '../shared/ui/Tarjeta';
import { PrimerosPasos } from './PrimerosPasos';
import { useSeccionesVisitadas } from './useSeccionesVisitadas';
import { seccionesVisibles, type Interruptor, type Seccion } from './secciones';

const DESCRIPCIONES: Readonly<Record<string, string>> = textos.inicio.descripciones;

function Mosaico({ seccion }: { readonly seccion: Seccion }): ReactElement {
  return (
    <Link to={seccion.ruta} className="mosaico">
      <span className="mosaico__icono">
        <Icono nombre={iconoDeSeccion(seccion.id)} tamano={24} />
      </span>
      <span className="mosaico__texto">
        <span className="mosaico__titulo">{seccion.texto}</span>
        <span className="mosaico__descripcion">{DESCRIPCIONES[seccion.id] ?? ''}</span>
      </span>
      <span className="mosaico__flecha">
        <Icono nombre="flechaDerecha" />
      </span>
    </Link>
  );
}

/** Panel de inicio: las cifras del día según quien entró, la guía de primeros pasos y los accesos a las
 *  secciones con su ícono y una línea que dice para qué sirven [RF-UX-01 a RF-UX-03, RF-UX-05]. */
export function PanelDeInicio({
  interruptores,
  conectar = false,
  entrar = false,
  resumen = null,
}: {
  readonly interruptores: ReadonlySet<Interruptor>;
  /** Muestra el acceso para conectar esta tablet con un código de registro. */
  readonly conectar?: boolean;
  /** Muestra el acceso para entrar con PIN. */
  readonly entrar?: boolean;
  /** Cifras del día según quien entró; sin ellas, el inicio solo muestra los accesos. */
  readonly resumen?: ReactNode;
}): ReactElement {
  const { visitadas } = useSeccionesVisitadas();
  const irA = useNavigate();
  const principales = seccionesVisibles('principal', interruptores);
  const secundarias = seccionesVisibles('secundaria', interruptores);

  const atajos = (
    <>
      <h2 className="rotulo tablero__titulo">{textos.navegacion.flujoDeTrabajo}</h2>
      <ul className="tablero">
        {principales.map((seccion) => (
          <li key={seccion.id}>
            <Mosaico seccion={seccion} />
          </li>
        ))}
      </ul>

      <h2 className="rotulo tablero__titulo">{textos.navegacion.administracion}</h2>
      <ul className="tablero tablero--chico">
        {secundarias.map((seccion) => (
          <li key={seccion.id}>
            <Mosaico seccion={seccion} />
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <section className="anima-entrada">
      <EncabezadoDePagina
        titulo={textos.inicio.titulo}
        descripcion={textos.inicio.descripcion}
        acciones={
          entrar || conectar ? (
            <>
              {entrar ? (
                <Link to="/entrar" className="boton">
                  <Icono nombre="usuarios" />
                  {textos.personas.acceso}
                </Link>
              ) : null}
              {conectar ? (
                <Link to="/conectar" className="boton boton--secundario">
                  <Icono nombre="nube" />
                  {textos.conectar.titulo}
                </Link>
              ) : null}
            </>
          ) : undefined
        }
      />

      {!visitadas.has('catalogo') ? (
        <AvisoCerrable
          id="revisar-catalogo"
          accion={{
            texto: textos.inicio.guia.irAlCatalogo,
            alTocar: () => {
              void irA('/catalogo');
            },
          }}
        >
          {textos.inicio.guia.avisoCatalogo}
        </AvisoCerrable>
      ) : null}

      {resumen}

      <PrimerosPasos interruptores={interruptores} visitadas={visitadas} />

      {resumen === null ? (
        atajos
      ) : (
        <details className="atajos">
          <summary className="rotulo atajos__titulo">{textos.inicio.atajos}</summary>
          {atajos}
        </details>
      )}

      <Tarjeta variante="panel">
        <p className="inicio__nota">{textos.inicio.nota}</p>
      </Tarjeta>
    </section>
  );
}

/** Sección que todavía no se construye: estado vacío sin datos de relleno [RN-23]. */
export function SeccionVacia({ titulo }: { readonly titulo: string }): ReactElement {
  return (
    <section className="anima-entrada">
      <EncabezadoDePagina titulo={titulo} />
      <EstadoVacio
        titulo={textos.seccionVacia.titulo}
        descripcion={textos.seccionVacia.descripcion}
      />
    </section>
  );
}
