import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { textos } from '../shared/i18n/textos';
import { AvisoCerrable } from '../shared/ui/AvisoCerrable';
import { useSeccionesVisitadas } from './useSeccionesVisitadas';

/** "Revisa primero tu catálogo": el cotizador y el mostrador venden con sus productos y precios, así que mientras
 *  nadie haya visitado el Catálogo se avisa aquí también, no solo en el inicio. Es el mismo aviso: cerrarlo en un
 *  lado lo cierra en todos, y desaparece al visitar el Catálogo [RF-UX-05]. */
export function AvisoDeCatalogo(): ReactElement | null {
  const { visitadas } = useSeccionesVisitadas();
  const irA = useNavigate();
  if (visitadas.has('catalogo')) {
    return null;
  }
  return (
    <AvisoCerrable
      id="revisar-catalogo"
      accion={{
        texto: textos.inicio.guia.irAlCatalogo,
        alTocar: () => {
          void irA('/catalogo');
        },
      }}
    >
      {textos.inicio.guia.avisoCatalogo}
    </AvisoCerrable>
  );
}
