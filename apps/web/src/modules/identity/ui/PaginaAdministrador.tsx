import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { dondeEstaba } from '../../../shell/donde-estaba';
import { textos } from '../../../shared/i18n/textos';
import { ProtegidaAdmin } from './ProtegidaAdmin';
import { useSesionAdmin } from './SesionAdmin';

/** La única puerta de entrada del administrador (correo y contraseña). Al entrar, devuelve a la persona a la
 *  sección donde estaba; la misma sesión abre todas las secciones de administración. */
export function PaginaAdministrador(): ReactElement {
  const { usuario, cargando } = useSesionAdmin();
  const navegar = useNavigate();

  useEffect(() => {
    if (usuario?.role === 'ADMIN') {
      void navegar(dondeEstaba(), { replace: true });
    }
  }, [usuario, navegar]);

  if (cargando) {
    return <p role="status">{textos.entrada.cargando}</p>;
  }
  return <ProtegidaAdmin>{null}</ProtegidaAdmin>;
}
