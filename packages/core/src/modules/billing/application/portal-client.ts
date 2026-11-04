import type { PortalLookupOutcome } from './portal-lookup';

/** Lo que el portal pregunta: folio y código como los tecleó la persona y las señales contra automatización. */
export interface PortalConsultaEntrada {
  readonly folio: string;
  readonly code: string;
  /** Campo trampa: una persona lo deja vacío. */
  readonly honeypot: string;
  /** Milisegundos que el formulario estuvo abierto antes de enviarse. */
  readonly elapsedMs: number;
  /** Respuesta del servicio externo contra automatización, si está configurado. */
  readonly token: string | null;
}

/** Cómo termina una consulta del navegador al servidor; incluye el caso de que ni siquiera haya red. */
export type PortalConsultaResultado = PortalLookupOutcome | { readonly kind: 'NO_NETWORK' };

/** Puerto del navegador hacia el portal: la consulta que hace la página `/factura` a la función del servidor. */
export type PortalConsulta = (entrada: PortalConsultaEntrada) => Promise<PortalConsultaResultado>;

/** Los datos fiscales que la persona captura en el portal. */
export interface PortalSolicitudReceptor {
  readonly rfc: string;
  readonly name: string;
  readonly fiscalZip: string;
  readonly regime: string;
  readonly cfdiUse: string;
}

/** Lo que el portal manda para pedir la factura. */
export interface PortalSolicitudEntrada extends PortalConsultaEntrada {
  /** Identificador de esta solicitud, generado al abrir el formulario: reenviarla no duplica el timbre. */
  readonly requestId: string;
  readonly recipient: PortalSolicitudReceptor;
  readonly acceptedPrivacy: boolean;
}

/** Cómo termina pedir la factura, visto desde el navegador. */
export type PortalSolicitudResultado =
  | { readonly kind: 'STAMPED'; readonly folio: string; readonly uuid: string }
  | { readonly kind: 'IN_PROCESS' }
  | { readonly kind: 'PRIVACY_NOT_ACCEPTED' }
  | { readonly kind: 'INVALID'; readonly fields: readonly string[] }
  | { readonly kind: 'PAYMENT_FORM_UNDEFINED' }
  | { readonly kind: 'NOT_BILLABLE' }
  | { readonly kind: 'INELIGIBLE'; readonly reason: string }
  | { readonly kind: 'REJECTED' }
  | { readonly kind: 'NOT_AVAILABLE' }
  | { readonly kind: 'BLOCKED'; readonly retryAfterSeconds: number }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'NO_NETWORK' };

export type PortalSolicitud = (
  entrada: PortalSolicitudEntrada,
) => Promise<PortalSolicitudResultado>;

/** Un archivo de la factura listo para guardar: el XML como texto y el PDF en base64. */
export interface PortalArchivo {
  readonly filename: string;
  readonly contentType: string;
  readonly encoding: 'utf8' | 'base64';
  readonly content: string;
}

export type PortalDescargaResultado =
  | { readonly kind: 'FILE'; readonly file: PortalArchivo }
  | { readonly kind: 'NOT_AVAILABLE' }
  | { readonly kind: 'BLOCKED'; readonly retryAfterSeconds: number }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'NO_NETWORK' };

export type PortalDescarga = (
  entrada: PortalConsultaEntrada,
  formato: 'xml' | 'pdf',
) => Promise<PortalDescargaResultado>;
