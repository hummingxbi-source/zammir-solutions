import fs from 'node:fs';

function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`no encontrado en ${p}: ${a.slice(0, 70)}`);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(p, s);
}

edit('apps/web/src/App.tsx', [
  [
    'readonly portal?: { readonly consultar: PortalConsulta; readonly siteKey?: string | null } | null;',
    `readonly portal?: {
    readonly consultar: PortalConsulta;
    readonly solicitar: PortalSolicitud;
    readonly descargar: PortalDescarga;
    readonly siteKey?: string | null;
  } | null;`,
  ],
  [
    '<PortalDeFactura consultar={portal.consultar} siteKey={portal.siteKey ?? null} />',
    '<PortalDeFactura {...portal} siteKey={portal.siteKey ?? null} />',
  ],
  [
    'element={<PortalPorQr consultar={portal.consultar} siteKey={portal.siteKey ?? null} />}',
    'element={<PortalPorQr {...portal} siteKey={portal.siteKey ?? null} />}',
  ],
  [
    `function PortalPorQr({
  consultar,
  siteKey,
}: {
  readonly consultar: PortalConsulta;
  readonly siteKey: string | null;
}): ReactElement {
  const { folio = '', codigo = '' } = useParams();
  return (
    <PortalDeFactura consultar={consultar} siteKey={siteKey} inicial={{ folio, code: codigo }} />
  );
}`,
    `function PortalPorQr({
  consultar,
  solicitar,
  descargar,
  siteKey,
}: {
  readonly consultar: PortalConsulta;
  readonly solicitar: PortalSolicitud;
  readonly descargar: PortalDescarga;
  readonly siteKey: string | null;
}): ReactElement {
  const { folio = '', codigo = '' } = useParams();
  return (
    <PortalDeFactura
      consultar={consultar}
      solicitar={solicitar}
      descargar={descargar}
      siteKey={siteKey}
      inicial={{ folio, code: codigo }}
    />
  );
}`,
  ],
  ['  PortalConsulta,\n', '  PortalConsulta,\n  PortalDescarga,\n  PortalSolicitud,\n'],
]);

edit('apps/web/src/composition/index.ts', [
  [
    'readonly portal: { readonly consultar: PortalConsulta; readonly siteKey: string | null } | null;',
    `readonly portal: {
    readonly consultar: PortalConsulta;
    readonly solicitar: PortalSolicitud;
    readonly descargar: PortalDescarga;
    readonly siteKey: string | null;
  } | null;`,
  ],
  [
    'consultar: functionPortalConsulta({ url: entorno.url, anonKey: entorno.anonKey }),',
    `consultar: functionPortalConsulta({ url: entorno.url, anonKey: entorno.anonKey }),
            solicitar: functionPortalSolicitud({ url: entorno.url, anonKey: entorno.anonKey }),
            descargar: functionPortalDescarga({ url: entorno.url, anonKey: entorno.anonKey }),`,
  ],
  [
    "import { functionPortalConsulta } from '../modules/billing/infra/function-portal-consulta';",
    `import { functionPortalConsulta } from '../modules/billing/infra/function-portal-consulta';
import {
  functionPortalDescarga,
  functionPortalSolicitud,
} from '../modules/billing/infra/function-portal-solicitud';`,
  ],
  ['  PortalConsulta,\n', '  PortalConsulta,\n  PortalDescarga,\n  PortalSolicitud,\n'],
]);

let css = fs.readFileSync('apps/web/src/shared/ui/componentes.css', 'utf8');
css += `
/* Portal: pasos, botones grandes y mensajes claros para personas mayores [RF-M10-16] */
.portal__pasos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin: 0 0 1.25rem;
  padding: 0;
  list-style: none;
}

.portal__paso {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--tinta-suave);
}

.portal__paso--actual {
  color: var(--tinta);
  font-weight: 600;
}

.portal__numero {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 1.75rem;
  block-size: 1.75rem;
  border-radius: 50%;
  background: var(--borde-suave);
  font-size: 1rem;
}

.portal__paso--actual .portal__numero {
  background: var(--acento);
  color: #ffffff;
}

.portal .boton {
  min-block-size: 3.5rem;
  padding-inline: 1.5rem;
  font-size: 1.125rem;
}

.portal__subtitulo {
  margin: 2rem 0 0.5rem;
  font-family: var(--fuente-titulo);
}

.portal__aviso {
  margin-block: 1rem 0.5rem;
  font-size: 1.0625rem;
}

.portal__error {
  margin: -0.25rem 0 0.75rem;
  color: var(--peligro);
  font-weight: 600;
}

.portal__folio {
  margin: 0 0 1rem;
  font-size: 2rem;
}
`;
fs.writeFileSync('apps/web/src/shared/ui/componentes.css', css);
