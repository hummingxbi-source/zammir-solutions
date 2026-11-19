import { useState } from 'react';
import type { ReactElement } from 'react';

import { textos } from '../../../shared/i18n/textos';
import { Boton } from '../../../shared/ui/Boton';
import { Icono } from '../../../shared/ui/Icono';

const t = textos.documento.acciones;

export interface AccionesDelDocumentoProps {
  /** Manda el documento por WhatsApp: es la acción principal. */
  readonly onEnviar: () => Promise<void> | void;
  /** Abre la impresión: siempre disponible, aunque casi nunca haga falta. */
  readonly onImprimir: () => Promise<void> | void;
  /** Se bloquean los dos mientras algo más está ocupando la pantalla (por ejemplo, emitiendo). */
  readonly deshabilitado?: boolean;
}

/** "Enviar por WhatsApp" e "Imprimir" juntos [ADR-0040]. Mientras uno trabaja, ninguno se toca dos veces. */
export function AccionesDelDocumento({
  onEnviar,
  onImprimir,
  deshabilitado = false,
}: AccionesDelDocumentoProps): ReactElement {
  const [ocupado, setOcupado] = useState(false);

  async function correr(accion: () => Promise<void> | void): Promise<void> {
    setOcupado(true);
    try {
      await accion();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="acciones-documento" role="group" aria-label={t.grupo}>
      <Boton
        disabled={deshabilitado || ocupado}
        onClick={() => {
          void correr(onEnviar);
        }}
      >
        <Icono nombre="whatsapp" />
        {t.enviar}
      </Boton>
      <Boton
        variante="secundario"
        disabled={deshabilitado || ocupado}
        onClick={() => {
          void correr(onImprimir);
        }}
      >
        <Icono nombre="imprimir" />
        {t.imprimir}
      </Boton>
    </div>
  );
}
