import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  issueRegistrationCode,
  listDevices,
  revokeDevice,
  type Device,
  type DeviceError,
  type DeviceId,
  type DeviceRepository,
  type IssuedRegistrationCode,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { CampoNumerico } from '../../../shared/ui/Campo';
import { Confirmacion } from '../../../shared/ui/Confirmacion';
import { formatearFecha } from '../../../shared/ui/formatos';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.dispositivos;

export interface DispositivosProps {
  readonly dispositivos: DeviceRepository;
}

/** Tablets registradas: ver, generar el código de registro de una nueva y revocar [RF-M8-02]. */
export function Dispositivos({ dispositivos }: DispositivosProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };

  const [lista, setLista] = useState<readonly Device[] | null>(null);
  const [error, setError] = useState<DeviceError | null>(null);
  const [minutos, setMinutos] = useState('');
  const [generando, setGenerando] = useState(false);
  const [codigo, setCodigo] = useState<IssuedRegistrationCode | null>(null);
  const [porRevocar, setPorRevocar] = useState<Device | null>(null);

  const rol = actor.role;
  const cargar = useCallback(async () => {
    const resultado = await listDevices({ devices: dispositivos }, { role: rol });
    if (resultado.ok) {
      setLista(resultado.value);
    } else {
      setError(resultado.error);
    }
  }, [dispositivos, rol]);

  useEffect(() => {
    // Carga inicial de la lista; el estado se llena cuando responde el servidor.
    void cargar();
  }, [cargar]);

  async function generar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setGenerando(true);
    const numero = /^\d+$/.test(minutos.trim()) ? Number(minutos.trim()) : Number.NaN;
    const resultado = await issueRegistrationCode({ devices: dispositivos }, actor, numero);
    setGenerando(false);
    if (resultado.ok) {
      setCodigo(resultado.value);
    } else {
      setCodigo(null);
      setError(resultado.error);
    }
  }

  async function revocar(id: DeviceId): Promise<void> {
    setPorRevocar(null);
    setError(null);
    const resultado = await revokeDevice({ devices: dispositivos }, actor, id);
    if (!resultado.ok) {
      setError(resultado.error);
    }
    await cargar();
  }

  return (
    <section className="anima-entrada" aria-labelledby="titulo-tablets">
      <h2 id="titulo-tablets">{t.titulo}</h2>
      <p>{t.descripcion}</p>

      {error !== null ? (
        <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
          {t.errores[error.code].mensaje}
        </Aviso>
      ) : null}

      <form onSubmit={(e) => void generar(e)}>
        <h3>{t.registrar.titulo}</h3>
        <CampoNumerico
          entero
          etiqueta={t.registrar.vigencia}
          value={minutos}
          onChange={(e) => {
            setMinutos(e.target.value);
          }}
        />
        <p>{t.registrar.ayudaVigencia}</p>
        <Boton type="submit" disabled={generando}>
          {generando ? t.registrar.generando : t.registrar.generar}
        </Boton>
      </form>

      {codigo !== null ? (
        <Aviso tipo="exito">
          <p>{t.registrar.codigoGenerado}</p>
          <p className="codigo-registro" aria-label={t.registrar.codigoGenerado}>
            <strong>{codigo.code}</strong>
          </p>
          <p>
            {t.registrar.instruccion} {t.registrar.venceA}{' '}
            {codigo.expiresAt.toLocaleTimeString('es-MX', {
              timeZone: 'America/Mexico_City',
              hour: '2-digit',
              minute: '2-digit',
            })}
            .
          </p>
        </Aviso>
      ) : null}

      {lista === null ? (
        error === null ? (
          <p role="status">{t.cargando}</p>
        ) : null
      ) : lista.length === 0 ? (
        <p>{t.sinTablets}</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">{t.columnas.nombre}</th>
              <th scope="col">{t.columnas.alta}</th>
              <th scope="col">{t.columnas.ultimoEnvio}</th>
              <th scope="col">{t.columnas.estado}</th>
              <th scope="col">{t.columnas.acciones}</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((d) => (
              <tr key={d.id}>
                <th scope="row">{d.name}</th>
                <td>{formatearFecha(d.createdAt)}</td>
                <td>{d.lastSentAt === null ? t.sinEnvios : formatearFecha(d.lastSentAt)}</td>
                <td>{t.estados[d.status]}</td>
                <td>
                  {d.status === 'ACTIVE' ? (
                    <Boton
                      variante="peligro"
                      aria-label={`${t.revocar} ${d.name}`}
                      onClick={() => {
                        setPorRevocar(d);
                      }}
                    >
                      {t.revocar}
                    </Boton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {porRevocar !== null ? (
        <Confirmacion
          peligrosa
          titulo={`${t.confirmarRevocar.titulo}: ${porRevocar.name}`}
          mensaje={t.confirmarRevocar.mensaje}
          textoConfirmar={t.confirmarRevocar.confirmar}
          textoCancelar={t.confirmarRevocar.cancelar}
          onConfirmar={() => void revocar(porRevocar.id)}
          onCancelar={() => {
            setPorRevocar(null);
          }}
        />
      ) : null}
    </section>
  );
}
