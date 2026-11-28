import type { ProductId } from '../../../shared-kernel/id';
import { addQuantities } from '../../../shared-kernel/measure/quantity';
import { err, ok, type Result } from '../../../shared-kernel/result';
import {
  addLineExtra,
  buildQuoteLine,
  recalculateQuoteLine,
  removeLineExtra,
  repriceQuoteLine,
  type LineDeps,
  type LineInput,
  type QuoteLineError,
  type QuoteProduct,
} from '../../quotes/domain/quote-line';
import { quoteTotals, type QuoteLine, type QuoteTotals } from '../../quotes/domain/quote';
import {
  expandBundle,
  type BundleComponent,
  type BundleError,
  type BundleInput,
} from '../../catalog/domain/bundle';
import type { BundleItem } from '../../catalog/domain/product';

/** El ticket actual del mostrador: lo que se está vendiendo antes de cobrar [RF-M4-01]. Es un valor puro:
 *  cada cambio devuelve un ticket nuevo, con los importes recalculados por las reglas de precio y el IVA
 *  del dominio, nunca con otra fórmula. */
export interface Ticket {
  readonly lines: readonly QuoteLine[];
}

export const EMPTY_TICKET: Ticket = { lines: [] };

export type TicketErrorCode =
  QuoteLineError['code'] | BundleError['code'] | 'LINE_NOT_FOUND' | 'QUANTITY_INVALID';

export interface TicketError {
  readonly code: TicketErrorCode;
}

/** Agrega un producto al ticket. El mismo producto con las mismas medidas suma cantidad en lugar de
 *  repetirse, salvo que esa línea ya lleve cargos extra: la pieza nueva no los trae [RF-M1-17]. */
export function addToTicket(
  ticket: Ticket,
  producto: QuoteProduct,
  entrada: LineInput,
  deps: LineDeps,
): Result<Ticket, TicketError> {
  const existente = ticket.lines.find(
    (l) =>
      l.productId === producto.id &&
      l.widthMm === (entrada.widthMm ?? null) &&
      l.heightMm === (entrada.heightMm ?? null) &&
      l.unitPriceCents === producto.listPrice &&
      (l.extras ?? []).length === 0,
  );
  if (existente !== undefined) {
    // En milésimas, para que 0.1 kg + 0.2 kg den 0.3 kg [RF-M1-12].
    const suma = addQuantities(existente.quantity, entrada.quantity);
    if (suma === null) {
      return err({ code: 'QUANTITY_INVALID' });
    }
    return setTicketQuantity(ticket, existente.id, suma, deps);
  }
  const linea = buildQuoteLine(producto, entrada, deps);
  return linea.ok ? ok({ lines: [...ticket.lines, linea.value] }) : err(linea.error);
}

/** Cambia la cantidad de una línea y recalcula su importe: entera de 1 en adelante, o con hasta 3 decimales si
 *  el producto se vende así [RF-M1-12]. */
export function setTicketQuantity(
  ticket: Ticket,
  lineId: string,
  cantidad: number,
  deps: LineDeps,
): Result<Ticket, TicketError> {
  const actual = ticket.lines.find((l) => l.id === lineId);
  if (actual === undefined) {
    return err({ code: 'LINE_NOT_FOUND' });
  }
  // Que la cantidad valga (entera o con decimales, según el producto) lo revisa el renglón: una sola regla.
  const nueva = recalculateQuoteLine(actual, { quantity: cantidad }, deps);
  if (!nueva.ok) {
    return err(nueva.error);
  }
  return ok({ lines: ticket.lines.map((l) => (l.id === lineId ? nueva.value : l)) });
}

/** Fija el precio de una línea con precio abierto [RF-M1-10, ADR-0048]: en la referencia o arriba. En el
 *  mostrador no hay descuentos (se dan en el cotizador, con el PIN de un administrador), así que bajar de la
 *  referencia o cambiar el precio de un producto de precio fijo no se acepta. */
export function setTicketLinePrice(
  ticket: Ticket,
  lineId: string,
  precioCents: number,
  deps: LineDeps,
): Result<Ticket, TicketError> {
  const actual = ticket.lines.find((l) => l.id === lineId);
  if (actual === undefined) {
    return err({ code: 'LINE_NOT_FOUND' });
  }
  if (actual.isOpenPrice !== true || precioCents < actual.catalogPriceCents) {
    return err({ code: 'PRICE_INVALID' });
  }
  const nueva = repriceQuoteLine(actual, precioCents, deps);
  if (!nueva.ok) {
    return err(nueva.error);
  }
  return ok({ lines: ticket.lines.map((l) => (l.id === lineId ? nueva.value : l)) });
}

/** Agrega un paquete al ticket [RF-M1-18, ADR-0048]: un renglón normal por componente, igual que si se
 *  agregaran uno por uno (las piezas iguales suman cantidad). Todo o nada: el ticket solo cambia si todos los
 *  componentes se pudieron agregar. `nuevoId` da el identificador de cada renglón nuevo. */
export function addBundleToTicket(
  ticket: Ticket,
  paquete: { readonly bundleItems?: readonly BundleItem[] },
  catalogo: readonly (QuoteProduct & BundleComponent)[],
  entrada: BundleInput,
  nuevoId: () => string,
  deps: LineDeps,
): Result<Ticket, TicketError> {
  const renglones = expandBundle(paquete.bundleItems ?? [], catalogo, entrada);
  if (!renglones.ok) {
    return renglones;
  }
  let actual = ticket;
  for (const r of renglones.value) {
    const siguiente = addToTicket(actual, r.product, { ...r.input, id: nuevoId() }, deps);
    if (!siguiente.ok) {
      return siguiente;
    }
    actual = siguiente.value;
  }
  return ok(actual);
}

function cambiarLinea(
  ticket: Ticket,
  lineId: string,
  cambio: (linea: QuoteLine) => Result<QuoteLine, QuoteLineError>,
): Result<Ticket, TicketError> {
  const actual = ticket.lines.find((l) => l.id === lineId);
  if (actual === undefined) {
    return err({ code: 'LINE_NOT_FOUND' });
  }
  const nueva = cambio(actual);
  if (!nueva.ok) {
    return err(nueva.error);
  }
  return ok({ lines: ticket.lines.map((l) => (l.id === lineId ? nueva.value : l)) });
}

/** Agrega a una línea del ticket un cargo extra del catálogo (canto, perforación, biselado), igual que en el
 *  cotizador: con la misma función y las mismas reglas [RF-M1-17, RF-M1-09]. Si ya estaba, se reemplaza. */
export function addTicketLineExtra(
  ticket: Ticket,
  lineId: string,
  extra: QuoteProduct & { readonly kind?: string },
  cantidad: number,
  deps: LineDeps,
): Result<Ticket, TicketError> {
  return cambiarLinea(ticket, lineId, (l) => addLineExtra(l, extra, cantidad, deps));
}

/** Quita un cargo extra de una línea del ticket y recalcula su importe [RF-M1-17]. */
export function removeTicketLineExtra(
  ticket: Ticket,
  lineId: string,
  productId: ProductId,
  deps: LineDeps,
): Result<Ticket, TicketError> {
  return cambiarLinea(ticket, lineId, (l) => removeLineExtra(l, productId, deps));
}

export function removeFromTicket(ticket: Ticket, lineId: string): Ticket {
  return { lines: ticket.lines.filter((l) => l.id !== lineId) };
}

/** Total del ticket: suma de sus líneas, con el IVA ya desglosado por línea [ADR-0011]. */
export function ticketTotals(ticket: Ticket): QuoteTotals {
  return quoteTotals(ticket.lines);
}
