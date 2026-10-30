import type { CustomerId } from '../../../shared-kernel/id';
import { normalizePhone } from '../../../shared-kernel/phone';
import { err, ok, type Result } from '../../../shared-kernel/result';

/** Datos fiscales del cliente, todos opcionales [RF-M5-01]. La tablet no los guarda de todos los
 *  clientes [RNF-06]: viven en el servidor y solo los ve un administrador. */
export interface FiscalProfile {
  readonly rfc: string | null;
  readonly legalName: string | null;
  /** Código postal fiscal: 5 dígitos [RF-M10-13]. */
  readonly fiscalZip: string | null;
  readonly regime: string | null;
  readonly cfdiUse: string | null;
}

export const NO_FISCAL_PROFILE: FiscalProfile = {
  rfc: null,
  legalName: null,
  fiscalZip: null,
  regime: null,
  cfdiUse: null,
};

/** Un cliente de ZAMMIR [RF-M5-01]. Nombre y WhatsApp son lo único obligatorio. */
export interface Customer {
  readonly id: CustomerId;
  readonly name: string;
  /** WhatsApp o teléfono, ya normalizado a 10 dígitos [RN-22]. */
  readonly phone: string;
  readonly email: string | null;
  readonly notes: string | null;
  readonly fiscal: FiscalProfile;
  /** Versión del aviso de privacidad que se le informó [RF-M9-03]; la registra S1-13. */
  readonly privacyNoticeVersion: number | null;
  /** Si no es `null`, sus datos personales se anonimizaron y ya no se editan [RF-M5-05]. */
  readonly anonymizedAt: Date | null;
}

/** Lo que se captura para dar de alta o corregir a un cliente. */
export type CustomerDraft = Omit<Customer, 'id' | 'anonymizedAt'>;

export type CustomerErrorCode =
  | 'NAME_REQUIRED'
  | 'PHONE_INVALID'
  | 'EMAIL_INVALID'
  | 'RFC_INVALID'
  | 'FISCAL_ZIP_INVALID'
  | 'NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'ANONYMIZED'
  | 'CUSTOMERS_UNAVAILABLE';

export interface CustomerError {
  readonly code: CustomerErrorCode;
}

// RFC de persona moral (12) o física (13): letras, fecha de 6 dígitos y homoclave de 3.
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const CODIGO_POSTAL = /^\d{5}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function vacioANull(texto: string | null): string | null {
  const limpio = texto?.trim() ?? '';
  return limpio === '' ? null : limpio;
}

/** Valida y normaliza a un cliente antes de guardarlo. Falta nombre o WhatsApp: no se guarda; el resto
 *  es opcional pero, si se captura, debe tener el formato correcto. */
export function buildCustomer(
  id: CustomerId,
  borrador: CustomerDraft,
  anonymizedAt: Date | null = null,
): Result<Customer, CustomerError> {
  const name = borrador.name.trim();
  if (name === '') {
    return err({ code: 'NAME_REQUIRED' });
  }
  const telefono = normalizePhone(borrador.phone);
  if (!telefono.ok) {
    return err({ code: 'PHONE_INVALID' });
  }
  const email = vacioANull(borrador.email);
  if (email !== null && !CORREO.test(email)) {
    return err({ code: 'EMAIL_INVALID' });
  }
  const rfc = vacioANull(borrador.fiscal.rfc)?.toUpperCase() ?? null;
  if (rfc !== null && !RFC.test(rfc)) {
    return err({ code: 'RFC_INVALID' });
  }
  const fiscalZip = vacioANull(borrador.fiscal.fiscalZip);
  if (fiscalZip !== null && !CODIGO_POSTAL.test(fiscalZip)) {
    return err({ code: 'FISCAL_ZIP_INVALID' });
  }
  return ok({
    id,
    name,
    phone: telefono.value,
    email,
    notes: vacioANull(borrador.notes),
    fiscal: {
      rfc,
      legalName: vacioANull(borrador.fiscal.legalName),
      fiscalZip,
      regime: vacioANull(borrador.fiscal.regime),
      cfdiUse: vacioANull(borrador.fiscal.cfdiUse),
    },
    privacyNoticeVersion: borrador.privacyNoticeVersion,
    anonymizedAt,
  });
}
