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
