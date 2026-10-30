import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  listAuditEntries,
  type AuditAction,
  type AuditCursor,
  type AuditEntry,
  type AuditError,
  type AuditQuery,
  type AuditReader,
  type Json,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo } from '../../../shared/ui/Campo';
import { formatearFechaHora, formatearPesos } from '../../../shared/ui/formatos';
import { Seleccion } from '../../../shared/ui/Seleccion';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.bitacora;
const PAGINA = 25;

export interface BitacoraProps {
  readonly reader: AuditReader;
  /** Nombres para mostrar en lugar de identificadores (personas y tablets), si se conocen. */
  readonly cargarNombres?: () => Promise<ReadonlyMap<string, string>>;
}

const ACCIONES = Object.keys(t.acciones) as AuditAction[];

// México no tiene horario de verano desde octubre de 2022: el día de México empieza a las 00:00 en UTC−6.
function inicioDelDia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-06:00`);
}

function sumarUnDia(fecha: Date): Date {
  return new Date(fecha.getTime() + 86_400_000);
}

function textoDe(valor: Json): string {
  if (valor === null) {
    return t.sinValor;
  }
  if (typeof valor === 'boolean') {
    return valor ? 'sí' : 'no';
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  return String(valor);
}

/** Valor anterior o nuevo, legible: `Nombre: Tablet; Estado: activo`. */
export function describirValor(valor: Json): string {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return textoDe(valor);
  }
  const pares = Object.entries(valor).map(([clave, v]) => {
    const etiqueta = clave in t.campos ? t.campos[clave as keyof typeof t.campos] : clave;
    const texto =
      clave === 'precio_centavos' && typeof v === 'number' ? formatearPesos(v) : textoDe(v);
    return `${etiqueta}: ${texto}`;
  });
  return pares.join('; ');
}

/** Bitácora consultable: usuario, tablet, fecha en hora de México, acción y valores anterior y nuevo,
 *  con filtros y paginación [RF-M8-03]. Solo la ve un administrador. */
export function Bitacora({ reader, cargarNombres }: BitacoraProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const rol = usuario?.role ?? null;

  const [entradas, setEntradas] = useState<readonly AuditEntry[] | null>(null);
  const [siguiente, setSiguiente] = useState<AuditCursor | null>(null);
  const [error, setError] = useState<AuditError | null>(null);
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtros, setFiltros] = useState<AuditQuery>({});
  const [nombres, setNombres] = useState<ReadonlyMap<string, string>>(new Map());

  const cargar = useCallback(
    async (
      consulta: AuditQuery,
      despuesDe: AuditCursor | null,
      acumular: readonly AuditEntry[],
    ) => {
      const r = await listAuditEntries(
        { reader },
        { role: rol },
        {
          ...consulta,
          limit: PAGINA,
          ...(despuesDe === null ? {} : { after: despuesDe }),
        },
      );
      if (r.ok) {
        setEntradas([...acumular, ...r.value.entries]);
        setSiguiente(r.value.next);
      } else {
        setError(r.error);
      }
    },
    [reader, rol],
  );

  useEffect(() => {
    if (cargarNombres !== undefined) {
      void cargarNombres().then(setNombres);
    }
  }, [cargarNombres]);

  useEffect(() => {
    void cargar(filtros, null, []);
  }, [cargar, filtros]);

  function buscar(evento: SyntheticEvent): void {
    evento.preventDefault();
    setError(null);
    setEntradas(null);
    setFiltros({
      ...(accion === '' ? {} : { action: accion as AuditAction }),
      ...(desde === '' ? {} : { from: inicioDelDia(desde) }),
      ...(hasta === '' ? {} : { to: sumarUnDia(inicioDelDia(hasta)) }),
    });
  }

  const quien = (id: string | null): string =>
    id === null ? t.sistema : (nombres.get(id) ?? `${id.slice(0, 8)}…`);

  return (
    <section className="anima-entrada" aria-labelledby="titulo-bitacora">
      <h2 id="titulo-bitacora">{t.titulo}</h2>
      <p>{t.descripcion}</p>

      {error !== null ? (
        <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
          {t.errores[error.code].mensaje}
        </Aviso>
      ) : null}

      <form onSubmit={buscar}>
        <Seleccion
          etiqueta={t.filtros.accion}
          value={accion}
          opciones={[
            { valor: '', texto: t.filtros.todas },
            ...ACCIONES.map((a) => ({ valor: a, texto: t.acciones[a] })),
          ]}
          onChange={(e) => {
            setAccion(e.target.value);
          }}
        />
        <Campo
          etiqueta={t.filtros.desde}
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
          }}
        />
        <Campo
          etiqueta={t.filtros.hasta}
          type="date"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
          }}
        />
        <Boton type="submit">{t.filtros.aplicar}</Boton>
      </form>

      {entradas === null ? (
        error === null ? (
          <p role="status">{t.cargando}</p>
        ) : null
      ) : entradas.length === 0 ? (
        <p>{t.vacia}</p>
      ) : (
        <>
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">{t.columnas.fecha}</th>
                <th scope="col">{t.columnas.persona}</th>
                <th scope="col">{t.columnas.tablet}</th>
                <th scope="col">{t.columnas.accion}</th>
                <th scope="col">{t.columnas.antes}</th>
                <th scope="col">{t.columnas.despues}</th>
                <th scope="col">{t.columnas.autorizo}</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.id}>
                  <th scope="row">{formatearFechaHora(e.occurredAt)}</th>
                  <td>{quien(e.userId)}</td>
                  <td>{e.deviceId === null ? t.sinValor : quien(e.deviceId)}</td>
                  <td>{t.acciones[e.action]}</td>
                  <td>{describirValor(e.oldValue)}</td>
                  <td>{describirValor(e.newValue)}</td>
                  <td>
                    {e.authorizedBy === undefined || e.authorizedBy === null
                      ? t.sinValor
                      : quien(e.authorizedBy)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {siguiente !== null ? (
            <Boton variante="secundario" onClick={() => void cargar(filtros, siguiente, entradas)}>
              {t.cargarMas}
            </Boton>
          ) : null}
        </>
      )}
    </section>
  );
}
