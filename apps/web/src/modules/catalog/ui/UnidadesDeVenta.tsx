import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  saveSaleUnitSuggestions,
  type SaleUnitSuggestionsError,
  type SaleUnitSuggestionsStore,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.unidadesDeVenta;

export interface UnidadesDeVentaProps {
  readonly store: SaleUnitSuggestionsStore;
}

/** Las unidades de venta que se sugieren al capturar un producto, editables por un administrador
 *  [RF-M1-11, PP-40]. Una por renglón. */
export function UnidadesDeVenta({ store }: UnidadesDeVentaProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<SaleUnitSuggestionsError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void store.read().then((r) => {
      if (r.ok) {
        setTexto(r.value.join('\n'));
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
    const r = await saveSaleUnitSuggestions(store, actor, texto ?? '');
    setGuardando(false);
    if (r.ok) {
      setTexto(r.value.join('\n'));
      setAviso(t.guardado);
    } else {
      setError(r.error);
    }
  }

  return (
    <section className="anima-entrada bloque" aria-labelledby="titulo-unidades-de-venta">
      <h2 id="titulo-unidades-de-venta">{t.titulo}</h2>
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
            etiqueta={t.campo}
            value={texto}
            rows={8}
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
