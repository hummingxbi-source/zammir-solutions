import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  anonymizeCustomer,
  createCustomer,
  findPossibleDuplicates,
  getCurrentLegalDocument,
  type LegalDocument,
  NO_FISCAL_PROFILE,
  searchCustomers,
  type Customer,
  type CustomerError,
  type CustomerHistory,
  type CustomerId,
  type ManageCustomersDeps,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { EncabezadoDePagina } from '../../../shared/ui/EncabezadoDePagina';
import { EstadoVacio } from '../../../shared/ui/EstadoVacio';
import { Tabla } from '../../../shared/ui/Tabla';
import { Tarjeta } from '../../../shared/ui/Tarjeta';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';
import { Confirmacion } from '../../../shared/ui/Confirmacion';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';
import { FichaDelCliente } from './FichaDelCliente';

const t = textos.clientes;

export interface ClientesProps {
  readonly deps: ManageCustomersDeps;
  /** Historial de un cliente desde lo guardado en la tablet; sin esto no se ofrece la ficha [S3-25]. */
  readonly historial?: (id: CustomerId) => Promise<CustomerHistory>;
}

/** Clientes: lista y alta con lo mínimo (nombre y WhatsApp) [RF-M5-01]. La búsqueda y el aviso de
 *  duplicados llegan con S1-11. */
export function Clientes({ deps, historial }: ClientesProps): ReactElement {
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
  const [busqueda, setBusqueda] = useState('');
  const [porAnonimizar, setPorAnonimizar] = useState<Customer | null>(null);
  const [avisoVigente, setAvisoVigente] = useState<LegalDocument | null>(null);
  const [repetidos, setRepetidos] = useState<readonly Customer[]>([]);
  const [ficha, setFicha] = useState<Customer | null>(null);

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

  // El aviso de privacidad vigente se muestra al capturar: es el que se le informa al cliente.
  const privacidad = deps.privacy;
  useEffect(() => {
    if (privacidad === undefined) {
      return;
    }
    void getCurrentLegalDocument(privacidad, 'PRIVACY_NOTICE').then((r) => {
      setAvisoVigente(r.ok ? r.value : null);
    });
  }, [privacidad]);

  // Al completar el teléfono (en cualquier formato) se avisa si ya lo tiene otro cliente; no bloquea.
  useEffect(() => {
    let vigente = true;
    void findPossibleDuplicates(deps, telefono).then((r) => {
      if (vigente) {
        setRepetidos(r.ok ? r.value : []);
      }
    });
    return () => {
      vigente = false;
    };
  }, [deps, telefono]);

  async function anonimizar(cliente: Customer): Promise<void> {
    setPorAnonimizar(null);
    setError(null);
    setAviso(null);
    const resultado = await anonymizeCustomer(deps, actor, cliente.id);
    if (resultado.ok) {
      setAviso(t.anonimizado_ok);
    } else {
      setError(resultado.error);
    }
    await cargar();
  }

  const visibles = lista === null ? [] : searchCustomers(lista, busqueda);

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
    <section className="anima-entrada clientes">
      <EncabezadoDePagina titulo={t.titulo} descripcion={t.descripcion} />

      {error !== null ? (
        <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
          {t.errores[error.code].mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      <Tarjeta rotulo={t.alta.titulo}>
        <form className="formulario" onSubmit={(e) => void guardar(e)}>
          <div className="formulario__par">
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
          </div>
          {repetidos.length > 0 ? (
            <Aviso tipo="error" queHacer={t.duplicado.ayuda}>
              {t.duplicado.aviso} {repetidos.map((r) => r.name).join(', ')}
            </Aviso>
          ) : null}
          <div className="formulario__par">
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
          </div>
          {avisoVigente !== null ? (
            <details className="plegable">
              <summary>
                {t.avisoVigente} {String(avisoVigente.version)}): {t.verAviso}
              </summary>
              <p style={{ whiteSpace: 'pre-wrap' }}>{avisoVigente.body}</p>
            </details>
          ) : null}
          <details className="plegable">
            <summary>{t.alta.fiscalTitulo}</summary>
            <div className="formulario__par">
              <Campo
                etiqueta={t.alta.rfc}
                value={rfc}
                autoComplete="off"
                onChange={(e) => {
                  setRfc(e.target.value);
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
            </div>
            <Campo
              etiqueta={t.alta.razonSocial}
              value={razonSocial}
              autoComplete="off"
              onChange={(e) => {
                setRazonSocial(e.target.value);
              }}
            />
          </details>
          <div className="formulario__acciones">
            <Boton type="submit" disabled={guardando}>
              {guardando ? t.alta.guardando : t.alta.guardar}
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta rotulo={t.lista}>
        {lista !== null && lista.length > 0 ? (
          <Campo
            etiqueta={t.buscar}
            type="search"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
            }}
          />
        ) : null}

        {lista === null ? (
          error === null ? (
            <p role="status">{t.cargando}</p>
          ) : null
        ) : lista.length === 0 ? (
          <EstadoVacio titulo={t.vacioTitulo} descripcion={t.sinClientes} icono="clientes" />
        ) : visibles.length === 0 ? (
          <p className="mostrador__vacio">{t.sinResultados}</p>
        ) : (
          <Tabla
            descripcion={t.lista}
            claveDeFila={(c) => c.id}
            filas={visibles}
            columnas={[
              {
                clave: 'nombre',
                rotulo: t.columnas.nombre,
                celda: (c) => (
                  <>
                    {c.name}
                    {c.anonymizedAt !== null ? <small> ({t.anonimizado})</small> : null}
                  </>
                ),
              },
              { clave: 'whatsapp', rotulo: t.columnas.whatsapp, celda: (c) => c.phone },
              {
                clave: 'correo',
                rotulo: t.columnas.correo,
                celda: (c) => c.email ?? t.sinCorreo,
              },
              {
                clave: 'acciones',
                rotulo: t.columnas.acciones,
                celda: (c) =>
                  c.anonymizedAt === null ? (
                    <span className="tabla__acciones">
                      {historial !== undefined ? (
                        <Boton
                          variante="secundario"
                          aria-label={`${t.ficha.ver} ${c.name}`}
                          onClick={() => {
                            setFicha(c);
                          }}
                        >
                          {t.ficha.ver}
                        </Boton>
                      ) : null}
                      <Boton
                        variante="peligro"
                        aria-label={`${t.anonimizar} ${c.name}`}
                        onClick={() => {
                          setPorAnonimizar(c);
                        }}
                      >
                        {t.anonimizar}
                      </Boton>
                    </span>
                  ) : null,
              },
            ]}
          />
        )}
      </Tarjeta>

      {ficha !== null && historial !== undefined ? (
        <FichaDelCliente
          cliente={ficha}
          cargar={() => historial(ficha.id)}
          onCerrar={() => {
            setFicha(null);
          }}
        />
      ) : null}

      {porAnonimizar !== null ? (
        <Confirmacion
          peligrosa
          titulo={`${t.confirmarAnonimizar.titulo} ${porAnonimizar.name}`}
          mensaje={t.confirmarAnonimizar.mensaje}
          textoConfirmar={t.confirmarAnonimizar.confirmar}
          textoCancelar={t.confirmarAnonimizar.cancelar}
          onConfirmar={() => void anonimizar(porAnonimizar)}
          onCancelar={() => {
            setPorAnonimizar(null);
          }}
        />
      ) : null}
    </section>
  );
}
