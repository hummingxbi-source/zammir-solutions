import { useCallback, useEffect, useId, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  currentVersion,
  publishLegalDocument,
  type LegalDeps,
  type LegalDocument,
  type LegalDocumentType,
  type LegalError,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Boton } from '../../../shared/ui/Boton';
import { formatearFecha } from '../../../shared/ui/formatos';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

export interface AvisoDePrivacidadProps {
  readonly deps: LegalDeps;
  /** Qué documento se edita; por omisión, el aviso de privacidad. */
  readonly tipo?: LegalDocumentType;
}

/** Editor del aviso de privacidad: muestra la versión vigente y las anteriores, y publica una versión
 *  nueva en lugar de modificar la existente [RF-M9-01]. */
export function AvisoDePrivacidad({
  deps,
  tipo = 'PRIVACY_NOTICE',
}: AvisoDePrivacidadProps): ReactElement {
  const t = tipo === 'TERMS' ? textos.terminos : textos.legal;
  const idTitulo = useId();
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };

  const [versiones, setVersiones] = useState<readonly LegalDocument[] | null>(null);
  const [error, setError] = useState<LegalError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);

  const cargar = useCallback(async () => {
    const resultado = await deps.legal.list(tipo);
    if (resultado.ok) {
      setVersiones(resultado.value);
    } else {
      setError(resultado.error);
    }
  }, [deps.legal, tipo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function publicar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setAviso(null);
    setPublicando(true);
    const resultado = await publishLegalDocument(deps, actor, {
      type: tipo,
      body: texto,
    });
    setPublicando(false);
    if (resultado.ok) {
      setTexto('');
      setAviso(t.publicado);
      await cargar();
    } else {
      setError(resultado.error);
    }
  }

  const vigente = versiones === null ? null : currentVersion(versiones, deps.clock.now());
  const anteriores = (versiones ?? []).filter((v) => v.id !== vigente?.id);
  const esBorrador = vigente?.body.includes('BORRADOR') === true;

  return (
    <section className="anima-entrada" aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{t.titulo}</h2>
      <p>{t.descripcion}</p>

      {error !== null ? (
        <Aviso tipo="error" queHacer={t.errores[error.code].queHacer}>
          {t.errores[error.code].mensaje}
        </Aviso>
      ) : null}
      {aviso !== null ? <Aviso tipo="exito">{aviso}</Aviso> : null}

      {versiones === null ? (
        error === null ? (
          <p role="status">{t.cargando}</p>
        ) : null
      ) : vigente === null ? (
        <p>{t.sinAviso}</p>
      ) : (
        <article>
          <h3>
            {t.vigente}: {t.versionN} {String(vigente.version)} ({t.desde}{' '}
            {formatearFecha(vigente.effectiveFrom)})
          </h3>
          {esBorrador ? <Aviso tipo="error">{t.borradorAviso}</Aviso> : null}
          <p style={{ whiteSpace: 'pre-wrap' }}>{vigente.body}</p>
        </article>
      )}

      <form onSubmit={(e) => void publicar(e)}>
        <h3>{t.nuevaVersion}</h3>
        <AreaDeTexto
          etiqueta={t.texto}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
          }}
        />
        <Boton type="submit" disabled={publicando}>
          {publicando ? t.publicando : t.publicar}
        </Boton>
      </form>

      {anteriores.length > 0 ? (
        <details>
          <summary>{t.historial}</summary>
          <ul>
            {[...anteriores]
              .sort((a, b) => b.version - a.version)
              .map((v) => (
                <li key={v.id}>
                  {t.versionN} {String(v.version)} ({t.desde} {formatearFecha(v.effectiveFrom)})
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Editor de los términos del servicio: el mismo mecanismo de versiones que el aviso de privacidad
 *  [RF-M9-02]. */
export function TerminosDelServicio({ deps }: { readonly deps: LegalDeps }): ReactElement {
  return <AvisoDePrivacidad deps={deps} tipo="TERMS" />;
}
