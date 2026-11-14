import { createContext } from 'react';

/** La sección donde está la persona (`catalogo`, `cotizador`…), para que el encabezado de cada pantalla
 *  muestre la ilustración de su sección. Fuera de la barra de navegación vale `null` y no hay ilustración. */
export const ContextoDeSeccion = createContext<string | null>(null);
