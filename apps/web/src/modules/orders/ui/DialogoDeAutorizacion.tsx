import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import type { Authorization } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { Seleccion } from '../../../shared/ui/Seleccion';
import type { AutorizacionDeAdministrador } from '../../quotes/ui/DialogoDeDescuento';

const t = textos.ordenes.autorizacion;

export interface DialogoDeAutorizacionProps {
  readonly titulo: string;
  /** Qué se está autorizando, en una frase. */
  readonly explicacion: string;
  /** `true` si la acción pide también un motivo escrito. */
  readonly pedirMotivo: boolean;
  /** Un administrador no necesita PIN: él mismo autoriza. */
  readonly pedirPin: boolean;
  readonly autorizacion: AutorizacionDeAdministrador;
  /** Continúa con la acción; devuelve el mensaje de error si no se pudo. */
  readonly onContinuar: (motivo: string, autorizacion?: Authorization) => Promise<string | null>;
  readonly onCancelar: () => void;
}

/** Pide el PIN de un administrador (a un cajero) y, si hace falta, un motivo [RF-M3-04, RN-19]. */
export function DialogoDeAutorizacion({
  titulo,
  explicacion,
  pedirMotivo,
  pedirPin,
  autorizacion,
  onContinuar,
  onCancelar,
}: DialogoDeAutorizacionProps): ReactElement {
  const [admins, setAdmins] = useState<readonly { id: string; name: string }[]>([]);
  const [adminId, setAdminId] = useState('');
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
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

  async function continuar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
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
    const falla = await onContinuar(motivo, permiso);
    setTrabajando(false);
    if (falla !== null) {
      const conocido = falla in textos.ordenes.errores;
      setError(
        textos.ordenes.errores[
          (conocido ? falla : 'NOT_AUTHORIZED') as keyof typeof textos.ordenes.errores
        ],
      );
    }
  }

  return (
    <form
      role="dialog"
      aria-label={titulo}
      className="dialogo"
      onSubmit={(e) => {
        void continuar(e);
      }}
    >
      <h3>{titulo}</h3>
      <p>{explicacion}</p>
      {error !== null ? (
        <Aviso tipo="error" queHacer={error.queHacer}>
          {error.mensaje}
        </Aviso>
      ) : null}
      {pedirMotivo ? (
        <AreaDeTexto
          etiqueta={t.motivo}
          rows={3}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
          }}
        />
      ) : null}
      {pedirPin ? (
        <>
          <Seleccion
            etiqueta={t.administrador}
            value={adminId}
            opciones={admins.map((a) => ({ valor: a.id, texto: a.name }))}
            onChange={(e) => {
              setAdminId(e.target.value);
            }}
          />
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
        {t.continuar}
      </Boton>
      <Boton variante="secundario" onClick={onCancelar}>
        {t.cancelar}
      </Boton>
    </form>
  );
}
