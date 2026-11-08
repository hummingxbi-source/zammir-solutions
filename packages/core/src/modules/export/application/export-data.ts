import type { ExportDataset } from '../domain/export-dataset';
import { buildExportPackage, type ExportPackage } from './build-export';

/** Puerto: de dónde salen los datos a exportar (el servidor, solo para administradores) [S5-08]. */
export interface DataExportSource {
  load(): Promise<
    | { readonly kind: 'OK'; readonly dataset: ExportDataset }
    | { readonly kind: 'NOT_AUTHORIZED' }
    | { readonly kind: 'NO_NETWORK' }
    | { readonly kind: 'UNAVAILABLE' }
  >;
}

export type ExportDataResult =
  | { readonly kind: 'READY'; readonly package: ExportPackage }
  | { readonly kind: 'NOT_AUTHORIZED' }
  | { readonly kind: 'NO_NETWORK' }
  | { readonly kind: 'UNAVAILABLE' };

/** Pide los datos al servidor y arma el paquete de la exportación. Todo lo que no sea un administrador con
 *  conexión termina en un resultado claro, nunca en una excepción [RNF-22]. */
export async function exportData(
  source: DataExportSource,
  opciones: { readonly businessName?: string } = {},
): Promise<ExportDataResult> {
  try {
    const r = await source.load();
    return r.kind === 'OK'
      ? { kind: 'READY', package: buildExportPackage(r.dataset, opciones) }
      : r;
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
}
