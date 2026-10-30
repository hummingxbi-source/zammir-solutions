import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  createUser,
  resetPin,
  setUserActive,
  type AppUser,
  type ManageUsersDeps,
  type ManageUsersError,
  type StaffRole,
  type UserPolicy,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { Confirmacion } from '../../../shared/ui/Confirmacion';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { useSesionAdmin } from './SesionAdmin';

const t = textos.usuarios;

export interface UsuariosProps {
  readonly deps: ManageUsersDeps;
  /** Mínimo de dígitos del administrador y vueltas de PBKDF2, tomados de la configuración. */
  readonly cargarPolitica: () => Promise<UserPolicy | null>;
}

const OPCIONES_DE_ROL = [
  { valor: 'STAFF', texto: t.roles.STAFF },
  { valor: 'ADMIN', texto: t.roles.ADMIN },
];

/** Personas que usan la tablet: alta con rol y PIN, desactivar y restablecer el PIN [RF-M8-01].
 *  El PIN se convierte en verificador aquí mismo y nunca se guarda ni se muestra. */
export function Usuarios({ deps, cargarPolitica }: UsuariosProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };

  const [lista, setLista] = useState<readonly AppUser[] | null>(null);
  const [politica, setPolitica] = useState<UserPolicy | null>(null);
  const [error, setError] = useState<ManageUsersError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<StaffRole>('STAFF');
  const [pin, setPin] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [porDesactivar, setPorDesactivar] = useState<AppUser | null>(null);
  const [restableciendo, setRestableciendo] = useState<AppUser | null>(null);
  const [pinNuevo, setPinNuevo] = useState('');

  const cargar = useCallback(async () => {
    const resultado = await deps.users.list();
    if (resultado.ok) {
      setLista([...resultado.value].sort((a, b) => a.name.localeCompare(b.name, 'es')));
    } else {
      setError(resultado.error);
    }
  }, [deps.users]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void cargarPolitica().then(setPolitica);
  }, [cargarPolitica]);

  async function darDeAlta(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    if (politica === null) {
      setError({ code: 'USERS_UNAVAILABLE' });
      return;
    }
    setError(null);
    setAviso(null);
    setGuardando(true);
    const resultado = await createUser(deps, politica, actor, { name: nombre, role: rol, pin });
    setGuardando(false);
    if (resultado.ok) {
      setNombre('');
      setPin('');
      setRol('STAFF');
      setAviso(t.alta.listo);
      await cargar();
    } else {
      setError(resultado.error);
    }
  }

  async function cambiarEstado(persona: AppUser, activo: boolean): Promise<void> {
    setPorDesactivar(null);
    setError(null);
    setAviso(null);
    const resultado = await setUserActive(deps, actor, persona.id, activo);
    if (!resultado.ok) {
      setError(resultado.error);
    }
    await cargar();
  }

  async function guardarPin(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    if (restableciendo === null || politica === null) {
      return;
    }
    setError(null);
    setAviso(null);
    const resultado = await resetPin(deps, politica, actor, restableciendo.id, pinNuevo);
    if (resultado.ok) {
      setRestableciendo(null);
      setPinNuevo('');
      setAviso(t.pinRestablecido);
    } else {
      setError(resultado.error);
    }
  }

  return (
    <section className="anima-entrada" aria-labelledby="titulo-personas">
      <h2 id="titulo-personas">{t.titulo}</h2>
      <p>{t.descripcion}</p>

      {error !== null ? (
        <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
          {t.errores[error.code].mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <form onSubmit={(e) => void darDeAlta(e)}>
        <h3>{t.alta.titulo}</h3>
        <Campo
          etiqueta={t.alta.nombre}
          value={nombre}
          autoComplete="off"
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
        <Seleccion
          etiqueta={t.alta.rol}
          opciones={OPCIONES_DE_ROL}
          value={rol}
          onChange={(e) => {
            setRol(e.target.value === 'ADMIN' ? 'ADMIN' : 'STAFF');
          }}
        />
        <Campo
          etiqueta={t.alta.pin}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
          }}
        />
        <p>
          {t.alta.ayudaPin} {String(politica?.adminMinDigits ?? 6)} {t.alta.digitos}.
        </p>
        <Boton type="submit" disabled={guardando}>
          {guardando ? t.alta.guardando : t.alta.guardar}
        </Boton>
      </form>

      {lista === null ? (
        error === null ? (
          <p role="status">{t.cargando}</p>
        ) : null
      ) : lista.length === 0 ? (
        <p>{t.sinPersonas}</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">{t.columnas.nombre}</th>
              <th scope="col">{t.columnas.rol}</th>
              <th scope="col">{t.columnas.estado}</th>
              <th scope="col">{t.columnas.acciones}</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((persona) => (
              <tr key={persona.id}>
                <th scope="row">{persona.name}</th>
                <td>{t.roles[persona.role]}</td>
                <td>{persona.isActive ? t.estados.activo : t.estados.inactivo}</td>
                <td>
                  <Boton
                    variante="secundario"
                    aria-label={`${t.restablecerPin} ${persona.name}`}
                    onClick={() => {
                      setRestableciendo(persona);
                      setPinNuevo('');
                    }}
                  >
                    {t.restablecerPin}
                  </Boton>{' '}
                  {persona.isActive ? (
                    <Boton
                      variante="peligro"
                      aria-label={`${t.desactivar} ${persona.name}`}
                      onClick={() => {
                        setPorDesactivar(persona);
                      }}
                    >
                      {t.desactivar}
                    </Boton>
                  ) : (
                    <Boton
                      variante="secundario"
                      aria-label={`${t.activar} ${persona.name}`}
                      onClick={() => void cambiarEstado(persona, true)}
                    >
                      {t.activar}
                    </Boton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {restableciendo !== null ? (
        <form onSubmit={(e) => void guardarPin(e)}>
          <h3>{`${t.restablecerPin}: ${restableciendo.name}`}</h3>
          <Campo
            etiqueta={t.nuevoPin}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pinNuevo}
            onChange={(e) => {
              setPinNuevo(e.target.value);
            }}
          />
          <Boton type="submit">{t.guardarPin}</Boton>{' '}
          <Boton
            variante="secundario"
            onClick={() => {
              setRestableciendo(null);
            }}
          >
            {t.cancelar}
          </Boton>
        </form>
      ) : null}

      {porDesactivar !== null ? (
        <Confirmacion
          peligrosa
          titulo={`${t.confirmarDesactivar.titulo} ${porDesactivar.name}`}
          mensaje={t.confirmarDesactivar.mensaje}
          textoConfirmar={t.confirmarDesactivar.confirmar}
          textoCancelar={t.confirmarDesactivar.cancelar}
          onConfirmar={() => void cambiarEstado(porDesactivar, false)}
          onCancelar={() => {
            setPorDesactivar(null);
          }}
        />
      ) : null}
    </section>
  );
}
