import {
  err,
  refreshCatalog,
  type CatalogError,
  type CatalogLocalStore,
  type CatalogReplicaSource,
  type DeviceCredentials,
  type DeviceCredentialsStore,
  type Result,
} from '@zammir/core';

export interface ActualizarCatalogoLocalDeps {
  readonly credenciales: DeviceCredentialsStore;
  /** Abre la sesión de la tablet y devuelve la fuente del catálogo; `null` si no se pudo. */
  readonly fuenteConSesion: (c: DeviceCredentials) => Promise<CatalogReplicaSource | null>;
  readonly store: CatalogLocalStore;
}

export type ResultadoDeActualizar = Result<
  { readonly received: number },
  CatalogError | { readonly code: 'NOT_REGISTERED' }
>;

/** Baja los cambios del catálogo a la tablet. Sin tablet registrada, o sin poder abrir su sesión, no
 *  hace nada y lo guardado se queda para seguir vendiendo sin internet. */
export async function actualizarCatalogoLocal(
  deps: ActualizarCatalogoLocalDeps,
): Promise<ResultadoDeActualizar> {
  const credenciales = await deps.credenciales.load();
  if (credenciales === null) {
    return err({ code: 'NOT_REGISTERED' });
  }
  const fuente = await deps.fuenteConSesion(credenciales);
  if (fuente === null) {
    return err({ code: 'CATALOG_UNAVAILABLE' });
  }
  return refreshCatalog({ source: fuente, store: deps.store });
}
