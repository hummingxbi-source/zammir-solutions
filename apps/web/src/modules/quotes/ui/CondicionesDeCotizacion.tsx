import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  saveQuoteConditions,
  type QuoteConditionsError,
  type QuoteConditionsStore,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.condiciones;

export interface CondicionesDeCotizacionProps {
  readonly store: QuoteConditionsStore;
}

/** Edición de las condiciones que salen en cada cotización [RN-13]. Solo administradores. */
export function CondicionesDeCotizacion({ store }: CondicionesDeCotizacionProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<QuoteConditionsError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void store.read().then((r) => {
      if (r.ok) {
        setTexto(r.value);
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
    const r = await saveQuoteConditions(store, actor, texto ?? '');
    setGuardando(false);
    if (r.ok) {
      setTexto(r.value);
      setAviso(t.guardado);
    } else {
      setError(r.error);
    }
  }

  return (
    <section className="anima-entrada" aria-labelledby="titulo-condiciones">
      <h2 id="titulo-condiciones">{t.titulo}</h2>
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
          <AreaDeTexto
            etiqueta={t.texto}
            value={texto}
            rows={5}
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
