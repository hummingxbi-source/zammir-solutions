import { useId } from 'react';
import type { ReactElement } from 'react';

import { Boton } from './Boton';

export interface ConfirmacionProps {
  readonly titulo: string;
  readonly mensaje: string;
  readonly textoConfirmar: string;
  readonly textoCancelar: string;
  /** Acción que no se puede deshacer: el botón de confirmar se muestra como peligro. */
  readonly peligrosa?: boolean;
  readonly onConfirmar: () => void;
  readonly onCancelar: () => void;
}

/** Confirmación de una acción destructiva [RF-UX-08]. Nada se ejecuta sin que la persona confirme. */
export function Confirmacion({
  titulo,
  mensaje,
  textoConfirmar,
  textoCancelar,
  peligrosa = false,
  onConfirmar,
  onCancelar,
}: ConfirmacionProps): ReactElement {
  const idTitulo = useId();
  const idMensaje = useId();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      aria-describedby={idMensaje}
      className="confirmacion anima-entrada"
    >
      <h2 id={idTitulo}>{titulo}</h2>
      <p id={idMensaje}>{mensaje}</p>
      <div className="confirmacion__acciones">
        <Boton variante="secundario" onClick={onCancelar}>
          {textoCancelar}
        </Boton>
        <Boton variante={peligrosa ? 'peligro' : 'primario'} onClick={onConfirmar}>
          {textoConfirmar}
        </Boton>
      </div>
    </div>
  );
}
