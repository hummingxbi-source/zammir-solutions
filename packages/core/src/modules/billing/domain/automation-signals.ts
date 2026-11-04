// Verificación ligera contra automatización del portal público [RF-M10-11, RNF-12].

/** Tiempo mínimo que una persona tarda en llenar el formulario; menos que esto es un programa. */
export const MIN_HUMAN_FILL_MS = 1_500;

/** Señales baratas de que quien manda el formulario no es una persona: el campo trampa (oculto para las
 *  personas) viene con algo, o se envió demasiado rápido. Es un primer filtro; la verificación del servicio
 *  externo (Turnstile) va aparte [S4-18]. */
export function looksAutomated(senales: {
  readonly honeypot: string | null | undefined;
  readonly elapsedMs: number | null | undefined;
}): boolean {
  if ((senales.honeypot ?? '').trim() !== '') {
    return true;
  }
  const transcurrido = senales.elapsedMs;
  return (
    transcurrido === null || transcurrido === undefined || !(transcurrido >= MIN_HUMAN_FILL_MS)
  );
}
