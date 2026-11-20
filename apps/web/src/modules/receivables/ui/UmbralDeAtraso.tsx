import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  saveAgingThreshold,
  type AgingThresholdError,
  type AgingThresholdStore,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { CampoNumerico } from '../../../shared/ui/Campo';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.umbralDeAtraso;

export interface UmbralDeAtrasoProps {
  readonly store: AgingThresholdStore;
  /** Avisa el valor guardado para que las pantallas lo usen de inmediato. */
  readonly alGuardar?: (dias: number) => void;
}

/** Días a partir de los cuales una cuenta por cobrar se resalta como atrasada [RF-M6-01, PD-33]. */
export function UmbralDeAtraso({ store, alGuardar }: UmbralDeAtrasoProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<AgingThresholdError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void store.read().then((r) => {
      if (r.ok) {
        setTexto(String(r.value));
      } else {
        setError(r.error);
        setTexto('');
      }
    });
  }, [store]);

  async function guardar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setAviso(null);
    setGuardando(true);
    const r = await saveAgingThreshold(store, actor, texto ?? '');
    setGuardando(false);
    if (r.ok) {
      setTexto(String(r.value));
      setAviso(t.guardado);
      alGuardar?.(r.value);
    } else {
      setError(r.error);
    }
  }

  return (
    <section className="anima-entrada bloque" aria-labelledby="titulo-umbral">
      <h2 id="titulo-umbral">{t.titulo}</h2>
      <p>{t.descripcion}</p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
          {t.errores[error.code].mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}
      {texto === null ? (
        <p role="status">{t.cargando}</p>
      ) : (
        <form
          onSubmit={(e) => {
            void guardar(e);
          }}
        >
          <CampoNumerico
            entero
            etiqueta={t.campo}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
            }}
          />
          <Boton type="submit" disabled={guardando}>
            {guardando ? t.guardando : t.guardar}
          </Boton>
        </form>
      )}
    </section>
  );
}
