import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import { Link } from 'react-router';
import {
  registerTablet,
  type DeviceCredentials,
  type RegisterTabletDeps,
  type RegisterTabletError,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { Icono } from '../../../shared/ui/Icono';

const t = textos.conectar;

export interface ConectarTabletProps {
  readonly deps: RegisterTabletDeps;
  /** Se avisa cuando la tablet quedó conectada o cuando se olvidó su registro. */
  readonly onCambio?: (credenciales: DeviceCredentials | null) => void;
}

/** Pantalla de la tablet para conectarse: el administrador genera un código en Usuarios y aquí se
 *  teclea una sola vez [RF-M8-02, ADR-0013]. Funciona sin sesión de administrador. */
export function ConectarTablet({ deps, onCambio }: ConectarTabletProps): ReactElement {
  const [actual, setActual] = useState<DeviceCredentials | null>(null);
  const [cargado, setCargado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<RegisterTabletError | null>(null);
  const [conectando, setConectando] = useState(false);
  const [recienConectada, setRecienConectada] = useState(false);
  const [olvidada, setOlvidada] = useState(false);

  useEffect(() => {
    void deps.store.load().then((c) => {
      setActual(c);
      setCargado(true);
    });
  }, [deps.store]);

  async function conectar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setOlvidada(false);
    setConectando(true);
    const resultado = await registerTablet(deps, { code: codigo, name: nombre });
    setConectando(false);
    if (resultado.ok) {
      setActual(resultado.value);
      setRecienConectada(true);
      setCodigo('');
      onCambio?.(resultado.value);
    } else {
      setError(resultado.error);
    }
  }

  async function olvidar(): Promise<void> {
    await deps.store.clear();
    setActual(null);
    setRecienConectada(false);
    setOlvidada(true);
    onCambio?.(null);
  }

  if (!cargado) {
    return <p role="status">{textos.conectar.conectando}</p>;
  }

  return (
    <section className="acceso-pagina anima-entrada" aria-labelledby="titulo-conectar">
      <div className="acceso-tarjeta">
        <div className="acceso-encabezado">
          <span
            className={`acceso-sello${actual !== null ? ' acceso-sello--exito' : ''}`}
            aria-hidden="true"
          >
            <Icono nombre={actual !== null ? 'verificar' : 'nube'} tamano={24} />
          </span>
          <h1 id="titulo-conectar">{t.titulo}</h1>
        </div>

        {olvidada ? <Aviso tipo="exito">{t.olvidada}</Aviso> : null}

        {actual !== null ? (
          <>
            <Aviso tipo="exito">
              {recienConectada ? t.listo : t.yaConectada} <strong>{actual.device.name}</strong>.
            </Aviso>
            <div className="acceso-acciones">
              <Link to="/" className="boton">
                {t.irAlInicio}
              </Link>
            </div>
            <div className="acceso-aparte">
              <p>{t.olvidarAyuda}</p>
              <div className="acceso-acciones">
                <Boton variante="peligro-suave" onClick={() => void olvidar()}>
                  {t.olvidar}
                </Boton>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="acceso-ayuda">{t.descripcion}</p>
            {error !== null ? (
              <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
                {t.errores[error.code].mensaje}
              </Aviso>
            ) : null}
            <form className="formulario" onSubmit={(e) => void conectar(e)}>
              <Campo
                etiqueta={t.codigo}
                autoCapitalize="characters"
                autoComplete="off"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                }}
              />
              <Campo
                etiqueta={t.nombre}
                autoComplete="off"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                }}
              />
              <div className="formulario__acciones">
                <Boton type="submit" disabled={conectando}>
                  {conectando ? t.conectando : t.boton}
                </Boton>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
