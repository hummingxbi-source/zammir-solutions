import { useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import { parseMoney, type PaymentRowInput } from '@zammir/core';

import { formatearPesos } from '../../../shared/ui/formatos';
import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';

const t = textos.ordenes.cobro;

export interface DialogoDeCobroProps {
  /** Saldo por cobrar, en centavos. */
  readonly saldoCents: number;
  /** Anticipo sugerido (solo en el primer cobro). */
  readonly sugeridoCents: number | null;
  /** Registra el cobro; devuelve el código de error o `null` si salió bien. */
  readonly onRegistrar: (filas: readonly PaymentRowInput[]) => Promise<string | null>;
  readonly onCancelar: () => void;
}

/** Centavos enteros como texto editable ("58.00"), sin pasar por decimales flotantes. */
function centavosATexto(centavos: number): string {
  return `${String(Math.floor(centavos / 100))}.${String(centavos % 100).padStart(2, '0')}`;
}

function aCentavos(texto: string): number | null {
  if (texto.trim() === '') {
    return 0;
  }
  const r = parseMoney(texto);
  return r.ok ? (r.value as number) : null;
}

/** Cobro de una orden: efectivo con cambio, transferencia con referencia, o las dos [RN-10, RF-M3-03].
 *  El anticipo sugerido es el porcentaje configurado; se puede editar. */
export function DialogoDeCobro({
  saldoCents,
  sugeridoCents,
  onRegistrar,
  onCancelar,
}: DialogoDeCobroProps): ReactElement {
  const inicial = sugeridoCents ?? saldoCents;
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [efectivoAplicar, setEfectivoAplicar] = useState('');
  const [transferencia, setTransferencia] = useState(centavosATexto(inicial));
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const recibido = aCentavos(efectivoRecibido) ?? 0;
  const aplicarEfectivo = aCentavos(efectivoAplicar) ?? 0;
  const cambio = recibido > aplicarEfectivo ? recibido - aplicarEfectivo : 0;

  async function registrar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    const efectivo = aCentavos(efectivoAplicar);
    const efectivoEntregado = aCentavos(efectivoRecibido);
    const banco = aCentavos(transferencia);
    if (efectivo === null || efectivoEntregado === null || banco === null) {
      setError(textos.ordenes.errores.AMOUNT_INVALID);
      return;
    }
    const filas: PaymentRowInput[] = [];
    if (efectivo > 0 || efectivoEntregado > 0) {
      filas.push({
        method: 'CASH',
        amountCents: efectivo,
        cashReceivedCents: efectivoEntregado,
      });
    }
    if (banco > 0) {
      filas.push({ method: 'TRANSFER', amountCents: banco, reference: referencia });
    }
    setTrabajando(true);
    const falla = await onRegistrar(filas);
    setTrabajando(false);
    if (falla !== null) {
      const clave = (
        falla in textos.ordenes.errores ? falla : 'STORAGE_FAILED'
      ) as keyof typeof textos.ordenes.errores;
      setError(textos.ordenes.errores[clave]);
    }
  }

  return (
    <form
      role="dialog"
      aria-label={t.titulo}
      className="dialogo"
      onSubmit={(e) => {
        void registrar(e);
      }}
    >
      <h3>{t.titulo}</h3>
      <p>
        {t.aCobrar}: <strong>{formatearPesos(saldoCents)}</strong>
      </p>
      {sugeridoCents !== null ? (
        <p>
          {t.sugerido}: <strong>{formatearPesos(sugeridoCents)}</strong>
        </p>
      ) : null}
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      <CampoNumerico
        etiqueta={t.efectivoRecibido}
        value={efectivoRecibido}
        onChange={(e) => {
          setEfectivoRecibido(e.target.value);
          if (efectivoAplicar === '') {
            setEfectivoAplicar(e.target.value);
          }
        }}
      />
      <CampoNumerico
        etiqueta={t.efectivoAplicar}
        value={efectivoAplicar}
        onChange={(e) => {
          setEfectivoAplicar(e.target.value);
        }}
      />
      {cambio > 0 ? (
        <p role="status">
          {t.cambioDe}: <strong>{formatearPesos(cambio)}</strong>
        </p>
      ) : null}
      <CampoNumerico
        etiqueta={t.transferenciaMonto}
        value={transferencia}
        onChange={(e) => {
          setTransferencia(e.target.value);
        }}
      />
      <Campo
        etiqueta={t.referencia}
        value={referencia}
        onChange={(e) => {
          setReferencia(e.target.value);
        }}
      />
      <Boton type="submit" disabled={trabajando}>
        {trabajando ? t.registrando : t.registrar}
      </Boton>
      <Boton variante="secundario" onClick={onCancelar}>
        {t.cancelar}
      </Boton>
    </form>
  );
}
