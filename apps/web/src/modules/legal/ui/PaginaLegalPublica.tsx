import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  currentVersion,
  type LegalDeps,
  type LegalDocument,
  type LegalDocumentType,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { formatearFecha } from '../../../shared/ui/formatos';

const t = textos.legalPublico;

/** Los datos del negocio que se muestran al pie del aviso; nulos mientras no se definan (PD-11). */
export interface ContactoPublico {
  readonly name: string | null;
  readonly phone: string | null;
  readonly address: string | null;
}

export interface PaginaLegalPublicaProps {
  readonly deps: LegalDeps;
  readonly tipo: LegalDocumentType;
  readonly cargarContacto: () => Promise<ContactoPublico | null>;
}

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error' }
  | {
      readonly tipo: 'listo';
      readonly documento: LegalDocument | null;
      readonly contacto: ContactoPublico | null;
    };

/** Página pública que abre el enlace de una cotización o comprobante: el aviso de privacidad o los términos
 *  vigentes y, al pie, el canal para ejercer derechos sobre los datos [RF-M9-01, RF-M9-04, S4-11]. Se ve en
 *  el teléfono del cliente, sin entrar al sistema ni mostrar el marco de la aplicación. */
export function PaginaLegalPublica({
  deps,
  tipo,
  cargarContacto,
}: PaginaLegalPublicaProps): ReactElement {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const textosDelTipo = tipo === 'TERMS' ? t.terminos : t.aviso;

  useEffect(() => {
    const efecto = { cancelado: false };
    void (async () => {
      const [versiones, contacto] = await Promise.all([
        deps.legal.list(tipo),
        cargarContacto().catch(() => null),
      ]);
      if (efecto.cancelado) {
        return;
      }
      setEstado(
        versiones.ok
          ? {
              tipo: 'listo',
              documento: currentVersion(versiones.value, deps.clock.now()),
              contacto,
            }
          : { tipo: 'error' },
      );
    })();
    return () => {
      efecto.cancelado = true;
    };
  }, [deps, tipo, cargarContacto]);

  const canal = estado.tipo === 'listo' ? canalDeContacto(estado.contacto) : null;

  return (
    <main className="publica">
      <article className="publica__hoja">
        <p className="rotulo publica__negocio">
          {estado.tipo === 'listo' &&
          estado.contacto?.name !== null &&
          estado.contacto?.name !== undefined
            ? estado.contacto.name
            : textos.app.nombre}
        </p>
        <h1>{textosDelTipo.titulo}</h1>
        {estado.tipo === 'cargando' ? <p role="status">{t.cargando}</p> : null}
        {estado.tipo === 'error' ? (
          <p role="alert">
            {t.error.mensaje} {t.error.queHacer}
          </p>
        ) : null}
        {estado.tipo === 'listo' && estado.documento === null ? <p>{textosDelTipo.vacio}</p> : null}
        {estado.tipo === 'listo' && estado.documento !== null ? (
          <>
            <p className="publica__version">
              {t.version} {String(estado.documento.version)} · {t.rigeDesde}{' '}
              {formatearFecha(estado.documento.effectiveFrom)}
            </p>
            <p className="publica__texto">{estado.documento.body}</p>
          </>
        ) : null}
        {estado.tipo === 'listo' ? (
          <footer className="publica__pie">
            <h2 className="rotulo">{t.derechos}</h2>
            <p>{canal ?? t.sinCanal}</p>
          </footer>
        ) : null}
      </article>
    </main>
  );
}

function canalDeContacto(contacto: ContactoPublico | null): string | null {
  if (contacto === null) {
    return null;
  }
  const partes: string[] = [];
  if (contacto.phone !== null) {
    partes.push(t.porWhatsApp(contacto.phone));
  }
  if (contacto.address !== null) {
    partes.push(t.enPersona(contacto.address));
  }
  return partes.length === 0 ? null : partes.join(' · ');
}
