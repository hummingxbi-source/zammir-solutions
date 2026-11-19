const CLAVE = 'zammir-ventas-impresas';
/** Cuántas ventas se recuerdan: las más recientes; lo viejo se olvida. */
const MAXIMO = 300;

function leer(): string[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const datos: unknown = crudo === null ? [] : JSON.parse(crudo);
    return Array.isArray(datos) ? datos.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** ¿Esta venta ya se imprimió en esta tablet? Una segunda impresión sale marcada COPIA [ADR-0040]. Si el
 *  navegador no deja guardar, no se sabe y se trata como primera vez. */
export function yaSeImprimio(idDeVenta: string): boolean {
  return leer().includes(idDeVenta);
}

/** Anota que la venta ya se imprimió. */
export function marcarComoImpresa(idDeVenta: string): void {
  try {
    const ids = leer().filter((x) => x !== idDeVenta);
    ids.push(idDeVenta);
    localStorage.setItem(CLAVE, JSON.stringify(ids.slice(-MAXIMO)));
  } catch {
    // Sin almacenamiento: la próxima impresión no saldrá marcada.
  }
}
