import { err, ok, type Result } from '../../../shared-kernel/result';
import {
  buildQuoteLine,
  recalculateQuoteLine,
  type LineDeps,
  type LineInput,
  type QuoteLineError,
  type QuoteProduct,
} from '../../quotes/domain/quote-line';
import { quoteTotals, type QuoteLine, type QuoteTotals } from '../../quotes/domain/quote';

/** El ticket actual del mostrador: lo que se está vendiendo antes de cobrar [RF-M4-01]. Es un valor puro:
 *  cada cambio devuelve un ticket nuevo, con los importes recalculados por las reglas de precio y el IVA
 *  del dominio, nunca con otra fórmula. */
export interface Ticket {
  readonly lines: readonly QuoteLine[];
}

export const EMPTY_TICKET: Ticket = { lines: [] };

export type TicketErrorCode = QuoteLineError['code'] | 'LINE_NOT_FOUND' | 'QUANTITY_INVALID';

export interface TicketError {
  readonly code: TicketErrorCode;
}

/** Agrega un producto al ticket. El mismo producto con las mismas medidas suma cantidad en lugar de
 *  repetirse. */
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
      l.unitPriceCents === producto.listPrice,
  );
  if (existente !== undefined) {
    return setTicketQuantity(ticket, existente.id, existente.quantity + entrada.quantity, deps);
  }
  const linea = buildQuoteLine(producto, entrada, deps);
  return linea.ok ? ok({ lines: [...ticket.lines, linea.value] }) : err(linea.error);
}

/** Cambia la cantidad de una línea (entera, de 1 en adelante) y recalcula su importe. */
export function setTicketQuantity(
  ticket: Ticket,
  lineId: string,
  cantidad: number,
  deps: LineDeps,
): Result<Ticket, TicketError> {
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) {
    return err({ code: 'QUANTITY_INVALID' });
  }
  const actual = ticket.lines.find((l) => l.id === lineId);
  if (actual === undefined) {
    return err({ code: 'LINE_NOT_FOUND' });
  }
  const nueva = recalculateQuoteLine(actual, { quantity: cantidad }, deps);
  if (!nueva.ok) {
    return err(nueva.error);
  }
  return ok({ lines: ticket.lines.map((l) => (l.id === lineId ? nueva.value : l)) });
}

export function removeFromTicket(ticket: Ticket, lineId: string): Ticket {
  return { lines: ticket.lines.filter((l) => l.id !== lineId) };
}

/** Total del ticket: suma de sus líneas, con el IVA ya desglosado por línea [ADR-0011]. */
export function ticketTotals(ticket: Ticket): QuoteTotals {
  return quoteTotals(ticket.lines);
}
