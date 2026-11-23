import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { useSesionAdmin } from '../modules/identity/ui/SesionAdmin';
import { textos } from '../shared/i18n/textos';
import { Boton } from '../shared/ui/Boton';
import { Icono } from '../shared/ui/Icono';

const t = textos.cuenta;

/** Quién tiene la sesión de administrador, arriba a la derecha de todas las pantallas. Sin sesión ofrece
 *  entrar; con sesión muestra el correo y permite salir. Una sola entrada sirve para todas las secciones de
 *  administración [RF-UX-01]. */
export function CuentaAdmin(): ReactElement | null {
  const { usuario, cargando, salir } = useSesionAdmin();
  if (cargando) {
    return null;
  }
  if (usuario === null) {
    return (
      <div className="cuenta" data-recorrido="cuenta">
        <Link to="/administrador" className="boton boton--secundario">
          <Icono nombre="usuarios" />
          {t.entrar}
        </Link>
      </div>
    );
  }
  return (
    <div className="cuenta" data-recorrido="cuenta">
      <span className="cuenta__texto">
        <span className="rotulo cuenta__rotulo">
          {usuario.role === 'ADMIN' ? t.rotulo : t.cuenta}
        </span>
        <span className="cuenta__correo" title={usuario.email}>
          {usuario.email}
        </span>
      </span>
      <Boton
        variante="secundario"
        onClick={() => {
          void salir();
        }}
      >
        {usuario.role === 'ADMIN' ? t.salir : t.salirDeLaCuenta}
      </Boton>
    </div>
  );
}
