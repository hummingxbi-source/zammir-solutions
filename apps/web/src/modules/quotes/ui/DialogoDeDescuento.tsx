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
import { formatearPesos } from '../../../shared/ui/formatos';

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

/** Pide el precio nuevo y, a un cajero, el PIN de un administrador [RF-M2-03, PD-45]. Con precio abierto
 *  [RF-M1-10, ADR-0048] el precio del catálogo es la referencia: fijarlo en ella o arriba no pide PIN; bajar de
 *  ella es un descuento y sí lo pide. */
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
  const abierto = linea.isOpenPrice === true;
  const capturado = parseMoney(precio);
  // Con precio abierto, el PIN solo hace falta si el precio queda debajo de la referencia.
  const necesitaPin =
    pedirPin && (!abierto || (capturado.ok && capturado.value < linea.catalogPriceCents));

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
    if (necesitaPin) {
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
      aria-label={`${abierto ? t.tituloAbierto : t.titulo}: ${linea.name}`}
      className="dialogo"
      onSubmit={(e) => void aplicar(e)}
    >
      <h3>
        {abierto ? t.tituloAbierto : t.titulo}: {linea.name}
      </h3>
      {abierto ? <p>{t.referencia(formatearPesos(linea.catalogPriceCents))}</p> : null}
      {necesitaPin ? <p>{t.pedirPin}</p> : null}
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      <CampoNumerico
        etiqueta={abierto ? t.precioAbierto : t.nuevoPrecio}
        value={precio}
        onChange={(e) => {
          setPrecio(e.target.value);
        }}
      />
      {necesitaPin ? (
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
        {abierto ? t.aplicarAbierto : t.aplicar}
      </Boton>
      <Boton variante="secundario" onClick={onCancelar}>
        {t.cancelar}
      </Boton>
    </form>
  );
}
