import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, SyntheticEvent } from 'react';
import {
  currentVersion,
  publishLegalDocument,
  type LegalDeps,
  type LegalDocument,
  type LegalError,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { Aviso } from '../../../shared/ui/Aviso';
import { AreaDeTexto } from '../../../shared/ui/AreaDeTexto';
import { Boton } from '../../../shared/ui/Boton';
import { formatearFecha } from '../../../shared/ui/formatos';
import { useSesionAdmin } from '../../identity/ui/SesionAdmin';

const t = textos.legal;

export interface AvisoDePrivacidadProps {
  readonly deps: LegalDeps;
}

/** Editor del aviso de privacidad: muestra la versión vigente y las anteriores, y publica una versión
 *  nueva en lugar de modificar la existente [RF-M9-01]. */
export function AvisoDePrivacidad({ deps }: AvisoDePrivacidadProps): ReactElement {
  const { usuario } = useSesionAdmin();
  const actor = { role: usuario?.role ?? null };

  const [versiones, setVersiones] = useState<readonly LegalDocument[] | null>(null);
  const [error, setError] = useState<LegalError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);

  const cargar = useCallback(async () => {
    const resultado = await deps.legal.list('PRIVACY_NOTICE');
    if (resultado.ok) {
      setVersiones(resultado.value);
    } else {
      setError(resultado.error);
    }
  }, [deps.legal]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function publicar(evento: SyntheticEvent): Promise<void> {
    evento.preventDefault();
    setError(null);
    setAviso(null);
    setPublicando(true);
    const resultado = await publishLegalDocument(deps, actor, {
      type: 'PRIVACY_NOTICE',
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
    <section className="anima-entrada" aria-labelledby="titulo-aviso">
      <h2 id="titulo-aviso">{t.titulo}</h2>
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
