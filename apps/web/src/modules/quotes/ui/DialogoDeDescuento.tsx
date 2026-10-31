import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  parseMoney,
  type Authorization,
  type AuthorizationError,
  type QuoteLine,
  type Result,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';

const t = textos.cotizador.descuento;

export interface AdministradorElegible {
  readonly id: string;
  readonly name: string;
}

export interface AutorizacionDeAdministrador {
  readonly administradores: () => Promise<readonly AdministradorElegible[]>;
  readonly autorizar: (
    adminId: string,
    pin: string,
  ) => Promise<Result<Authorization, AuthorizationError>>;
}

export interface DialogoDeDescuentoProps {
  readonly linea: QuoteLine;
  /** Un administrador no necesita PIN: él mismo autoriza. */
  readonly pedirPin: boolean;
  readonly autorizacion: AutorizacionDeAdministrador;
  /** Aplica el descuento; devuelve el código de error si no se pudo. */
  readonly onAplicar: (
    nuevoPrecioCents: number,
    autorizacion?: Authorization,
  ) => Promise<string | null>;
  readonly onCancelar: () => void;
}

/** Pide el precio nuevo y, a un cajero, el PIN de un administrador [RF-M2-03, PD-45]. */
export function DialogoDeDescuento({
  linea,
  pedirPin,
  autorizacion,
  onAplicar,
  onCancelar,
}: DialogoDeDescuentoProps): ReactElement {
  const [precio, setPrecio] = useState('');
  const [admins, setAdmins] = useState<readonly AdministradorElegible[]>([]);
  const [adminId, setAdminId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<{ mensaje: string; queHacer: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (pedirPin) {
      void autorizacion.administradores().then((lista) => {
        setAdmins(lista);
        setAdminId(lista[0]?.id ?? '');
      });
    }
  }, [pedirPin, autorizacion]);

  async function aplicar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    const monto = parseMoney(precio);
    if (!monto.ok) {
      setError(textos.cotizador.errores.PRICE_INVALID);
      return;
    }
    setTrabajando(true);
    let permiso: Authorization | undefined;
    if (pedirPin) {
      const r = await autorizacion.autorizar(adminId, pin);
      if (!r.ok) {
        setTrabajando(false);
        setPin('');
        setError({
          mensaje:
            r.error.code === 'LOCKED'
              ? `${textos.personas.errores.LOCKED.mensaje} ${textos.personas.esperaSegundos(r.error.retryAfterSeconds)}`
              : textos.personas.errores.AUTH_FAILED.mensaje,
          queHacer: textos.personas.errores[r.error.code].queHacer,
        });
        return;
      }
      permiso = r.value;
    }
    const falla = await onAplicar(monto.value, permiso);
    setTrabajando(false);
    if (falla !== null) {
      const conocido = falla in textos.cotizador.errores;
      setError(
        conocido
          ? textos.cotizador.errores[falla as keyof typeof textos.cotizador.errores]
          : textos.cotizador.errores.PRICE_INVALID,
      );
    }
  }

  return (
    <form
      role="dialog"
      aria-label={`${t.titulo}: ${linea.name}`}
      className="dialogo"
      onSubmit={(e) => void aplicar(e)}
    >
      <h3>
        {t.titulo}: {linea.name}
      </h3>
      {pedirPin ? <p>{t.pedirPin}</p> : null}
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      <CampoNumerico
        etiqueta={t.nuevoPrecio}
        value={precio}
        onChange={(e) => {
          setPrecio(e.target.value);
        }}
      />
      {pedirPin ? (
        <>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="admin-descuento">
              {t.administrador}
            </label>
            <select
              id="admin-descuento"
              value={adminId}
              onChange={(e) => {
                setAdminId(e.target.value);
              }}
            >
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <Campo
            etiqueta={t.pin}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
            }}
          />
        </>
      ) : null}
      <Boton type="submit" disabled={trabajando}>
        {t.aplicar}
      </Boton>
      <Boton variante="secundario" onClick={onCancelar}>
        {t.cancelar}
      </Boton>
    </form>
  );
}
