import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  signInWithPin,
  type ActiveUser,
  type ActiveUserSession,
  type AppUser,
  type SignInError,
  type SignInWithPinDeps,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';

const t = textos.personas;
const MAX_DIGITOS = 6;
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export interface EntrarConPinProps {
  readonly deps: SignInWithPinDeps;
  readonly session: ActiveUserSession;
  /** Se avisa cuando alguien entra. */
  readonly onEntrar?: (persona: ActiveUser) => void;
  /** Muestra el aviso de que la tablet se bloqueó por no usarse. */
  readonly bloqueadaPorInactividad?: boolean;
}

/** Pantalla de la tablet para entrar: se toca el nombre y se teclea el PIN en un teclado grande.
 *  La comparación es local, así que funciona sin internet [RF-M8-03, ADR-0013]. */
export function EntrarConPin({
  deps,
  session,
  onEntrar,
  bloqueadaPorInactividad = false,
}: EntrarConPinProps): ReactElement {
  const [personas, setPersonas] = useState<readonly AppUser[] | null>(null);
  const [cargado, setCargado] = useState(false);
  const [elegida, setElegida] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<SignInError | null>(null);
  const [revisando, setRevisando] = useState(false);

  useEffect(() => {
    void deps.store.load().then((copia) => {
      setPersonas(copia === null ? null : copia.users.filter((u) => u.isActive));
      setCargado(true);
    });
  }, [deps.store]);

  async function entrar(): Promise<void> {
    if (elegida === null || pin === '') {
      return;
    }
    setRevisando(true);
    setError(null);
    const resultado = await signInWithPin(deps, { userId: elegida.id, pin });
    setRevisando(false);
    setPin('');
    if (resultado.ok) {
      session.enter(resultado.value);
      onEntrar?.(resultado.value);
    } else {
      setError(resultado.error);
    }
  }

  function volver(): void {
    setElegida(null);
    setPin('');
    setError(null);
  }

  if (!cargado) {
    return <p role="status">{t.cargando}</p>;
  }

  const fallo = error === null ? null : t.errores[error.code];

  return (
    <section className="anima-entrada" aria-labelledby="titulo-personas">
      <h1 id="titulo-personas">{t.titulo}</h1>
      {bloqueadaPorInactividad ? <p role="status">{t.bloqueadaPorInactividad}</p> : null}

      {fallo !== null && (error?.code === 'DEVICE_NOT_READY' || error?.code === 'NO_USERS_YET') ? (
        <Aviso tipo="error" queHacer={fallo.queHacer}>
          {fallo.mensaje}
        </Aviso>
      ) : null}

      {personas === null || personas.length === 0 ? (
        <Aviso tipo="error" queHacer={t.errores.NO_USERS_YET.queHacer}>
          {personas === null ? t.errores.NO_USERS_YET.mensaje : t.sinPersonas}
        </Aviso>
      ) : elegida === null ? (
        <>
          <p>{t.descripcion}</p>
          <ul className="accesos">
            {personas.map((persona) => (
              <li key={persona.id}>
                <Boton
                  variante="secundario"
                  onClick={() => {
                    setElegida(persona);
                  }}
                >
                  {persona.name}
                </Boton>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div>
          <h2>{elegida.name}</h2>
          {fallo !== null &&
          error !== null &&
          (error.code === 'AUTH_FAILED' || error.code === 'LOCKED') ? (
            <Aviso tipo="error" queHacer={fallo.queHacer}>
              {fallo.mensaje}
              {error.code === 'LOCKED' ? ` ${t.esperaSegundos(error.retryAfterSeconds)}` : ''}
            </Aviso>
          ) : null}
          <p aria-label={t.pin} role="status" className="pin-puntos">
            {pin === '' ? '·' : '●'.repeat(pin.length)}
          </p>
          <div role="group" aria-label={t.teclado} className="teclado">
            {TECLAS.map((tecla) => (
              <Boton
                key={tecla}
                variante="secundario"
                onClick={() => {
                  setPin((actual) => (actual.length < MAX_DIGITOS ? actual + tecla : actual));
                }}
              >
                {tecla}
              </Boton>
            ))}
            <Boton
              variante="secundario"
              onClick={() => {
                setPin((actual) => actual.slice(0, -1));
              }}
            >
              {t.borrar}
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                setPin((actual) => (actual.length < MAX_DIGITOS ? `${actual}0` : actual));
              }}
            >
              0
            </Boton>
            <Boton
              disabled={revisando || pin === ''}
              onClick={() => {
                void entrar();
              }}
            >
              {revisando ? t.verificando : t.entrar}
            </Boton>
          </div>
          <Boton variante="secundario" onClick={volver}>
            {t.cambiarDePersona}
          </Boton>
        </div>
      )}
    </section>
  );
}
