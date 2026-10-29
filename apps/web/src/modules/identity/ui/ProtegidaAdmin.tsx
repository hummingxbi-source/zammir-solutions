import type { ReactElement, ReactNode } from 'react';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { EntrarAdministrador } from './EntrarAdministrador';
import { useSesionAdmin } from './SesionAdmin';

/** Pantallas solo para administradores. Sin sesión pide entrar; con una cuenta que no es de
 *  administrador no muestra nada de la pantalla [matriz de permisos, REQUERIMIENTOS.md]. */
export function ProtegidaAdmin({ children }: { readonly children: ReactNode }): ReactElement {
  const { usuario, cargando, salir } = useSesionAdmin();
  const t = textos.entrada;

  if (cargando) {
    return <p>{t.cargando}</p>;
  }
  if (usuario === null) {
    return <EntrarAdministrador />;
  }
  if (usuario.role !== 'ADMIN') {
    return (
      <section>
        <Aviso tipo="error" queHacer={t.sinPermiso.queHacer}>
          {t.sinPermiso.mensaje}
        </Aviso>
        <Boton
          variante="secundario"
          onClick={() => {
            void salir();
          }}
        >
          {t.salir}
        </Boton>
      </section>
    );
  }
  return <>{children}</>;
}
