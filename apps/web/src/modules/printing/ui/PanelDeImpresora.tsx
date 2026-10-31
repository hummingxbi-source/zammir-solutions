import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { testPage, type PrinterStatus } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import type { ImpresionDeTickets } from './impresion';

const t = textos.impresion;

export function mensajeDeImpresion(codigo: string): { mensaje: string; queHacer: string } {
  return codigo in t.errores ? t.errores[codigo as keyof typeof t.errores] : t.errores.PRINT_FAILED;
}

/** Estado de la impresora de tickets, con conectarla e imprimir una página de prueba [S3-23]. */
export function PanelDeImpresora(props: { readonly impresion: ImpresionDeTickets }): ReactElement {
  const { impresion } = props;
  const [estado, setEstado] = useState<PrinterStatus | null>(null);
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setEstado(await impresion.estado());
  }, [impresion]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  async function conectar(): Promise<void> {
    setError(null);
    setAviso(null);
    const falla = await impresion.conectar();
    if (falla !== null) {
      setError(mensajeDeImpresion(falla));
    }
    await refrescar();
  }

  async function probar(): Promise<void> {
    setError(null);
    setAviso(null);
    const r = await impresion.imprimir(
      testPage({
        business: impresion.business,
        labels: t.rotulos,
        width: impresion.width,
      }),
    );
    if ('error' in r) {
      setError(mensajeDeImpresion(r.error));
    } else {
      setAviso(`${t.impreso} · ${t.impresoPor} ${r.via}`);
    }
  }

  return (
    <section aria-labelledby="titulo-impresora">
      <h2 id="titulo-impresora">{t.titulo}</h2>
      <p>
        {estado === null ? '…' : t.estado[estado.state]}
        {estado?.name !== null && estado?.name !== undefined ? ` · ${estado.name}` : ''}
      </p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}
      <Boton
        variante="secundario"
        onClick={() => {
          void conectar();
        }}
      >
        {t.conectar}
      </Boton>
      <Boton
        variante="secundario"
        onClick={() => {
          void probar();
        }}
      >
        {t.probar}
      </Boton>
    </section>
  );
}
