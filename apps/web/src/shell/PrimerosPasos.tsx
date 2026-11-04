import { useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { textos } from '../shared/i18n/textos';
import { Boton } from '../shared/ui/Boton';
import { Icono } from '../shared/ui/Icono';
import { Ventana } from '../shared/ui/Ventana';
import { seccionesVisibles, type Interruptor, type Seccion } from './secciones';

const t = textos.inicio.guia;
const DESCRIPCIONES: Readonly<Record<string, string>> = textos.inicio.descripciones;

/** Los cinco pasos en el orden real del trabajo [RF-UX-02]. */
export function pasosDeLaGuia(interruptores: ReadonlySet<Interruptor>): readonly Seccion[] {
  return seccionesVisibles('principal', interruptores);
}

/** La primera sección del flujo que todavía no se visita, o `null` si ya se visitaron todas. */
export function siguientePaso(
  pasos: readonly Seccion[],
  visitadas: ReadonlySet<string>,
): Seccion | null {
  return pasos.find((p) => !visitadas.has(p.id)) ?? null;
}

export interface PrimerosPasosProps {
  readonly interruptores: ReadonlySet<Interruptor>;
  readonly visitadas: ReadonlySet<string>;
}

/** "Primeros pasos": cinco tarjetas numeradas que se marcan al visitar cada sección. Cuando ya se visitaron
 *  todas, la guía se oculta sola [RF-UX-02]. */
export function PrimerosPasos({
  interruptores,
  visitadas,
}: PrimerosPasosProps): ReactElement | null {
  const pasos = pasosDeLaGuia(interruptores);
  if (pasos.length === 0 || siguientePaso(pasos, visitadas) === null) {
    return null;
  }
  const siguiente = siguientePaso(pasos, visitadas);
  return (
    <section className="guia" aria-labelledby="guia-titulo">
      <h2 id="guia-titulo" className="rotulo tablero__titulo">
        {t.titulo}
      </h2>
      <p className="guia__descripcion">{t.descripcion}</p>
      <ol className="guia__pasos">
        {pasos.map((paso, indice) => {
          const hecho = visitadas.has(paso.id);
          return (
            <li key={paso.id}>
              <Link
                to={paso.ruta}
                className={`guia__paso${hecho ? ' guia__paso--hecho' : ''}${
                  siguiente?.id === paso.id ? ' guia__paso--siguiente' : ''
                }`}
              >
                <span className="guia__numero" aria-hidden="true">
                  {hecho ? <Icono nombre="verificar" tamano={18} /> : indice + 1}
                </span>
                <span className="guia__texto">
                  <span className="rotulo guia__rotulo">
                    {t.paso(indice + 1)} · {hecho ? t.hecho : t.pendiente}
                  </span>
                  <span className="guia__titulo">{paso.texto}</span>
                  <span className="guia__detalle">{DESCRIPCIONES[paso.id] ?? ''}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Botón fijo "¿Por dónde empiezo?": abre una ventana que dice cuál es el siguiente paso y lleva a él
 *  [RF-UX-03]. */
export function BotonPorDondeEmpiezo({
  interruptores,
  visitadas,
}: PrimerosPasosProps): ReactElement {
  const [abierto, setAbierto] = useState(false);
  const siguiente = siguientePaso(pasosDeLaGuia(interruptores), visitadas);
  return (
    <>
      <button
        type="button"
        className="por-donde"
        onClick={() => {
          setAbierto(true);
        }}
      >
        <Icono nombre="ayuda" tamano={20} />
        {t.boton}
      </button>
      {abierto ? (
        <Ventana
          titulo={t.ventanaTitulo}
          onCerrar={() => {
            setAbierto(false);
          }}
          acciones={
            <>
              {siguiente !== null ? (
                <Link
                  to={siguiente.ruta}
                  className="boton"
                  onClick={() => {
                    setAbierto(false);
                  }}
                >
                  {t.ir}
                </Link>
              ) : null}
              <Boton
                variante="secundario"
                onClick={() => {
                  setAbierto(false);
                }}
              >
                {t.cerrar}
              </Boton>
            </>
          }
        >
          <p>{siguiente === null ? t.todoVisto : t.siguiente(siguiente.texto)}</p>
          {siguiente !== null ? <p>{DESCRIPCIONES[siguiente.id] ?? ''}</p> : null}
        </Ventana>
      ) : null}
    </>
  );
}
