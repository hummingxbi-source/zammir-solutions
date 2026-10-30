import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  createCustomer,
  NO_FISCAL_PROFILE,
  type Customer,
  type CustomerError,
  type ManageCustomersDeps,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.clientes;

export interface ClientesProps {
  readonly deps: ManageCustomersDeps;
}

/** Clientes: lista y alta con lo mínimo (nombre y WhatsApp) [RF-M5-01]. La búsqueda y el aviso de
 *  duplicados llegan con S1-11. */
export function Clientes({ deps }: ClientesProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };

  const [lista, setLista] = useState<readonly Customer[] | null>(null);
  const [error, setError] = useState<CustomerError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [notas, setNotas] = useState('');
  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const resultado = await deps.customers.list();
    if (resultado.ok) {
      setLista([...resultado.value].sort((a, b) => a.name.localeCompare(b.name, 'es')));
    } else {
      setError(resultado.error);
    }
  }, [deps.customers]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setAviso(null);
    setGuardando(true);
    const resultado = await createCustomer(deps, actor, {
      name: nombre,
      phone: telefono,
      email: correo,
      notes: notas,
      fiscal: { ...NO_FISCAL_PROFILE, rfc, legalName: razonSocial, fiscalZip: codigoPostal },
      privacyNoticeVersion: null,
    });
    setGuardando(false);
    if (resultado.ok) {
      setNombre('');
      setTelefono('');
      setCorreo('');
      setNotas('');
      setRfc('');
      setRazonSocial('');
      setCodigoPostal('');
      setAviso(t.alta.listo);
      await cargar();
    } else {
      setError(resultado.error);
    }
  }

  return (
    <section className="anima-entrada" aria-labelledby="titulo-clientes">
      <h1 id="titulo-clientes">{t.titulo}</h1>
      <p>{t.descripcion}</p>

      {error !== null ? (
        <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
          {t.errores[error.code].mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <form onSubmit={(e) => void guardar(e)}>
        <h2>{t.alta.titulo}</h2>
        <Campo
          etiqueta={t.alta.nombre}
          value={nombre}
          autoComplete="off"
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
        <CampoNumerico
          entero
          etiqueta={t.alta.whatsapp}
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value);
          }}
        />
        <Campo
          etiqueta={t.alta.correo}
          type="email"
          autoComplete="off"
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value);
          }}
        />
        <Campo
          etiqueta={t.alta.notas}
          value={notas}
          autoComplete="off"
          onChange={(e) => {
            setNotas(e.target.value);
          }}
        />
        <details>
          <summary>{t.alta.fiscalTitulo}</summary>
          <Campo
            etiqueta={t.alta.rfc}
            value={rfc}
            autoComplete="off"
            onChange={(e) => {
              setRfc(e.target.value);
            }}
          />
          <Campo
            etiqueta={t.alta.razonSocial}
            value={razonSocial}
            autoComplete="off"
            onChange={(e) => {
              setRazonSocial(e.target.value);
            }}
          />
          <CampoNumerico
            entero
            etiqueta={t.alta.codigoPostalFiscal}
            value={codigoPostal}
            onChange={(e) => {
              setCodigoPostal(e.target.value);
            }}
          />
        </details>
        <Boton type="submit" disabled={guardando}>
          {guardando ? t.alta.guardando : t.alta.guardar}
        </Boton>
      </form>

      {lista === null ? (
        error === null ? (
          <p role="status">{t.cargando}</p>
        ) : null
      ) : lista.length === 0 ? (
        <p>{t.sinClientes}</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">{t.columnas.nombre}</th>
              <th scope="col">{t.columnas.whatsapp}</th>
              <th scope="col">{t.columnas.correo}</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((cliente) => (
              <tr key={cliente.id}>
                <th scope="row">
                  {cliente.name}
                  {cliente.anonymizedAt !== null ? <small> ({t.anonimizado})</small> : null}
                </th>
                <td>{cliente.phone}</td>
                <td>{cliente.email ?? t.sinCorreo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
