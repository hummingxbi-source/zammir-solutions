import type { ErrorReport, ErrorReporter } from '@zammir/core';

export interface EnvioDeErroresOptions {
  /** Dirección de Supabase, sin diagonal final. Sin ella no se envía nada (por ejemplo, en desarrollo sin base). */
  readonly url: string | undefined;
  readonly anonKey: string | undefined;
  /** Solo para pruebas. */
  readonly fetchImpl?: typeof fetch;
}

/** Entrega un error ya limpio a la función `registrar-error`. Sin internet simplemente no se envía: un error del
 *  navegador no vale una cola de reintentos ni datos guardados en la tablet [RNF-34, ADR-0034]. */
export function envioDeErrores(
  opciones: EnvioDeErroresOptions,
): (reporte: ErrorReport) => Promise<void> {
  const peticion = opciones.fetchImpl ?? fetch;
  return async (reporte) => {
    if (opciones.url === undefined || opciones.url === '') {
      return;
    }
    try {
      await peticion(`${opciones.url}/functions/v1/registrar-error`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'content-type': 'application/json',
          ...(opciones.anonKey === undefined
            ? {}
            : { apikey: opciones.anonKey, authorization: `Bearer ${opciones.anonKey}` }),
        },
        body: JSON.stringify(reporte),
      });
    } catch {
      // Sin conexión: el error se pierde, pero la aplicación sigue funcionando.
    }
  };
}

export interface VentanaDeErrores {
  addEventListener(tipo: 'error', fn: (e: ErrorEvent) => void): void;
  addEventListener(tipo: 'unhandledrejection', fn: (e: PromiseRejectionEvent) => void): void;
  removeEventListener(tipo: 'error', fn: (e: ErrorEvent) => void): void;
  removeEventListener(tipo: 'unhandledrejection', fn: (e: PromiseRejectionEvent) => void): void;
  readonly location: { readonly pathname: string };
}

/** Atrapa los errores que nadie atrapó (`error` y promesas rechazadas) y los manda al reportero. Devuelve cómo
 *  quitar la captura. */
export function instalarCapturaDeErrores(
  reportero: ErrorReporter,
  ventana: VentanaDeErrores,
): () => void {
  const alError = (e: ErrorEvent): void => {
    void reportero.report(e.error ?? e.message, ventana.location.pathname);
  };
  const alRechazo = (e: PromiseRejectionEvent): void => {
    void reportero.report(e.reason, ventana.location.pathname);
  };
  ventana.addEventListener('error', alError);
  ventana.addEventListener('unhandledrejection', alRechazo);
  return () => {
    ventana.removeEventListener('error', alError);
    ventana.removeEventListener('unhandledrejection', alRechazo);
  };
}
