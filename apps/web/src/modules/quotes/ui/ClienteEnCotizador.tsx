import { useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  createCustomer,
  NO_FISCAL_PROFILE,
  normalizePhone,
  searchCustomers,
  type Customer,
  type ManageCustomersDeps,
  type UserRole,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { Boton } from '../../../shared/ui/Boton';
import { Campo, CampoNumerico } from '../../../shared/ui/Campo';

const t = textos.cotizador.cliente;

export interface ClienteEnCotizadorProps {
  readonly clientes: ManageCustomersDeps;
  readonly rol: UserRole | null;
  readonly onElegir: (cliente: Customer, domicilioDeLaObra: string | null) => void;
}

/** Buscar o capturar al cliente sin salir del cotizador [RF-M2-01]: nombre y WhatsApp como mínimo y,
 *  si se quiere, el domicilio de la obra. Un cliente nuevo queda con el aviso de privacidad informado. */
export function ClienteEnCotizador({
  clientes,
  rol,
  onElegir,
}: ClienteEnCotizadorProps): ReactElement {
  const [lista, setLista] = useState<readonly Customer[]>([]);
  const [texto, setTexto] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [obra, setObra] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void clientes.customers.list().then((r) => {
      setLista(r.ok ? r.value : []);
    });
  }, [clientes]);

  const encontrados = searchCustomers(lista, texto).slice(0, 8);

  async function guardar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    const telefono = normalizePhone(whatsapp);
    if (nombre.trim() === '' || !telefono.ok) {
      setError(textos.clientes.errores.PHONE_INVALID.mensaje);
      return;
    }
    const existente = lista.find((c) => c.phone === telefono.value);
    if (existente !== undefined) {
      setError(t.posibleDuplicado);
    }
    const r = await createCustomer(
      clientes,
      { role: rol },
      {
        name: nombre.trim(),
        phone: telefono.value,
        email: null,
        notes: null,
        fiscal: NO_FISCAL_PROFILE,
        privacyNoticeVersion: null,
      },
    );
    if (!r.ok) {
      setError(textos.clientes.errores.PHONE_INVALID.mensaje);
      return;
    }
    onElegir(r.value, obra.trim() === '' ? null : obra.trim());
  }

  return (
    <section aria-labelledby="titulo-cliente-cotizador">
      <h2 id="titulo-cliente-cotizador">{t.titulo}</h2>
      <p>{t.elegir}</p>
      {!nuevo ? (
        <>
          <Campo
            etiqueta={t.buscar}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
            }}
          />
          {encontrados.length === 0 && texto !== '' ? <p>{t.sinResultados}</p> : null}
          <ul className="accesos">
            {encontrados.map((c) => (
              <li key={c.id}>
                <Boton
                  variante="secundario"
                  onClick={() => {
                    onElegir(c, null);
                  }}
                >
                  {c.name} · {c.phone}
                </Boton>
              </li>
            ))}
          </ul>
          <Boton
            onClick={() => {
              setNuevo(true);
            }}
          >
            {t.nuevo}
          </Boton>
        </>
      ) : (
        <form onSubmit={(e) => void guardar(e)}>
          {error !== null ? <Aviso tipo="error">{error}</Aviso> : null}
          <Campo
            etiqueta={t.nombre}
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
            }}
          />
          <CampoNumerico
            etiqueta={t.whatsapp}
            entero
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
            }}
          />
          <Campo
            etiqueta={t.obra}
            value={obra}
            onChange={(e) => {
              setObra(e.target.value);
            }}
          />
          <Boton type="submit">{t.guardar}</Boton>
        </form>
      )}
    </section>
  );
}
