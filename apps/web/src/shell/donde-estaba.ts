/** Recuerda en qué sección estaba la persona para devolverla ahí después de entrar con su PIN, en lugar de
 *  mandarla siempre al inicio. Solo vive en la pestaña (sessionStorage) y, si el navegador no lo permite,
 *  la aplicación sigue funcionando y vuelve al inicio. */
const CLAVE = 'zammir-donde-estaba';

export function recordarDondeEstaba(ruta: string | null): void {
  try {
    if (ruta === null) {
      sessionStorage.removeItem(CLAVE);
    } else {
      sessionStorage.setItem(CLAVE, ruta);
    }
  } catch {
    // Sin almacenamiento: se vuelve al inicio.
  }
}

/** La sección donde estaba la persona, o el inicio (`/`) si no hay ninguna. */
export function dondeEstaba(): string {
  try {
    const guardada = sessionStorage.getItem(CLAVE);
    return guardada !== null && guardada.startsWith('/') && !guardada.startsWith('//')
      ? guardada
      : '/';
  } catch {
    return '/';
  }
}
