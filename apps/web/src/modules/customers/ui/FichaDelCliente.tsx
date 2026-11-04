import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { Customer, CustomerHistory } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Boton } from '../../../shared/ui/Boton';
import { formatearPesos } from '../../../shared/ui/formatos';
import { Icono } from '../../../shared/ui/Icono';
import { Indicador } from '../../../shared/ui/Indicador';
import { Tarjeta } from '../../../shared/ui/Tarjeta';

const t = textos.clientes.ficha;

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export interface FichaDelClienteProps {
  readonly cliente: Customer;
  readonly cargar: () => Promise<CustomerHistory>;
  readonly onCerrar: () => void;
}

/** Ficha de un cliente: sus cotizaciones, órdenes, ventas, pagos y garantías, y si es recurrente [S3-25]. */
export function FichaDelCliente({ cliente, cargar, onCerrar }: FichaDelClienteProps): ReactElement {
  const [historial, setHistorial] = useState<CustomerHistory | null>(null);

  useEffect(() => {
    let vigente = true;
    void cargar().then((h) => {
      if (vigente) {
        setHistorial(h);
      }
    });
    return () => {
      vigente = false;
    };
  }, [cargar]);

  return (
    <Tarjeta
      rotulo={`${t.titulo} ${cliente.name}`}
      acciones={
        <Boton variante="secundario" onClick={onCerrar}>
          {t.cerrar}
        </Boton>
      }
    >
      {historial === null ? (
        <p role="status">{t.cargando}</p>
      ) : (
        <>
          {historial.recurring ? (
            <p className="ficha__recurrente">
              <Icono nombre="verificar" />
              {t.recurrente}
            </p>
          ) : null}
          <div className="indicadores">
            <Indicador rotulo={t.entregadas} valor={String(historial.deliveredOrders)} />
            <Indicador rotulo={t.comprado} valor={formatearPesos(historial.totalPurchasedCents)} />
          </div>

          <h3 className="rotulo ficha__subtitulo">{t.cotizaciones}</h3>
          {historial.quotes.length === 0 ? (
            <p>{t.sin}</p>
          ) : (
            <ul className="lineas">
              {historial.quotes.map((q) => (
                <li key={q.id}>
                  {q.folio ?? q.tempFolio} · {t.estadoCotizacion[q.status]}
                </li>
              ))}
            </ul>
          )}

          <h3 className="rotulo ficha__subtitulo">{t.ordenes}</h3>
          {historial.orders.length === 0 ? (
            <p>{t.sin}</p>
          ) : (
            <ul className="lineas">
              {historial.orders.map((o) => (
                <li key={o.id}>
                  {o.folio ?? o.tempFolio} · {t.estadoOrden[o.status]} ·{' '}
                  {formatearPesos(o.totalCents)}
                </li>
              ))}
            </ul>
          )}

          <h3 className="rotulo ficha__subtitulo">{t.ventas}</h3>
          {historial.sales.length === 0 ? (
            <p>{t.sin}</p>
          ) : (
            <ul className="lineas">
              {historial.sales.map((v) => (
                <li key={v.id}>
                  {v.folio ?? v.tempFolio} · {fecha(v.issuedAt)} · {formatearPesos(v.totalCents)}
                  {v.status === 'CANCELLED' ? ` · ${t.cancelada}` : ''}
                </li>
              ))}
            </ul>
          )}

          <h3 className="rotulo ficha__subtitulo">{t.pagos}</h3>
          {historial.payments.length === 0 ? (
            <p>{t.sin}</p>
          ) : (
            <ul className="lineas">
              {historial.payments.map((p) => (
                <li key={p.id}>
                  {fecha(p.paidAt)} · {t.tipoDePago[p.kind]} · {t.metodo[p.method]} ·{' '}
                  {formatearPesos(p.amountCents)}
                </li>
              ))}
            </ul>
          )}

          <h3 className="rotulo ficha__subtitulo">{t.garantias}</h3>
          {historial.warranties.length === 0 ? (
            <p>{t.sin}</p>
          ) : (
            <ul className="lineas">
              {historial.warranties.map((w) => (
                <li key={w.workOrderId}>
                  {t.desde} {w.startsOn}
                  {w.durationMonths === null ? '' : ` · ${String(w.durationMonths)} ${t.meses}`}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Tarjeta>
  );
}
