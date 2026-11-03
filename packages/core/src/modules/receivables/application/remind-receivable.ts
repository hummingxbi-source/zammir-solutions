import { formatMoney, money } from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import { whatsappUrl } from '../../documents/application/share-quote';
import { fillTemplate, type ReceivableRow } from '../domain/receivables';

export type ReminderErrorCode = 'NO_PHONE';

export interface ReminderError {
  readonly code: ReminderErrorCode;
}

export interface ReminderDeps {
  /** Abre un enlace en otra pestaña o aplicación (WhatsApp). */
  readonly openLink: (url: string) => void;
}

/** Abre WhatsApp con un recordatorio amable ya escrito, con el folio y el saldo [RF-M6-03]. El mensaje sale
 *  de una plantilla; el teléfono son los 10 dígitos del cliente. Sin teléfono no hay a quién avisar. */
export function remindReceivable(
  deps: ReminderDeps,
  entrada: {
    readonly row: Pick<ReceivableRow, 'folio' | 'balanceCents'>;
    readonly customerName: string;
    readonly phone: string | null;
    readonly businessName: string;
    readonly template: string;
  },
): Result<string, ReminderError> {
  if (entrada.phone === null || entrada.phone.trim() === '') {
    return err({ code: 'NO_PHONE' });
  }
  const saldo = money(entrada.row.balanceCents);
  const mensaje = fillTemplate(entrada.template, {
    cliente: entrada.customerName,
    folio: entrada.row.folio,
    saldo: saldo.ok ? formatMoney(saldo.value) : '',
    negocio: entrada.businessName,
  });
  const url = whatsappUrl(entrada.phone, mensaje);
  deps.openLink(url);
  return ok(url);
}
