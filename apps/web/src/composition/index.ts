import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createActiveUserSession,
  createPriceRegistry,
  defaultRules,
  refreshLogin,
  type ActiveUserSession,
  type AdminAuth,
  type AuditReader,
  type CatalogLocalStore,
  type Clock,
  type DeviceCredentials,
  type DeviceRepository,
  type IdGenerator,
  type ImportCatalogDeps,
  type LegalDeps,
  type ManageCustomersDeps,
  type ManageUsersDeps,
  type RegisterTabletDeps,
  type SignInWithPinDeps,
  type UserPolicy,
} from '@zammir/core';

import {
  actualizarCatalogoLocal,
  type ResultadoDeActualizar,
} from '../modules/catalog/infra/actualizar-catalogo-local';
import { dexieCatalogStore } from '../modules/catalog/infra/dexie-catalog-store';
import { supabaseCatalogReplica } from '../modules/catalog/infra/supabase-catalog';
import { functionDeviceRegistrar } from '../modules/devices/infra/function-device-registrar';
import { localCredentialsStore } from '../modules/devices/infra/local-credentials-store';
import { supabaseDeviceRepository } from '../modules/devices/infra/supabase-device-repository';
import {
  adminAuthNoConfigurada,
  supabaseAdminAuth,
} from '../modules/identity/infra/supabase-admin-auth';
import { supabaseAuditReader } from '../modules/audit/infra/supabase-audit-reader';
import { supabaseCatalog } from '../modules/catalog/infra/supabase-catalog';
import { supabaseCustomers } from '../modules/customers/infra/supabase-customers';
import { supabaseLegal } from '../modules/legal/infra/supabase-legal';
import { dexieIdentity } from '../modules/identity/infra/dexie-identity-store';
import { supabaseLoginSource } from '../modules/identity/infra/supabase-login-source';
import { supabaseUsers } from '../modules/identity/infra/supabase-users';
import { supabaseSettingsRepository } from '../modules/settings/infra/supabase-settings-repository';
import { createSupabaseClient } from '../shared/infra/supabase-client';
import { webCryptoPinHasher } from '../shared/infra/web-crypto-pin-hasher';
import { systemClock } from '../shared/infra/system-clock';
import { uuidIdGenerator } from '../shared/infra/uuid-id-generator';

/** Raíz de composición: el único lugar donde se eligen los adaptadores reales
 *  y se entregan a los casos de uso [00-principios §1.1]. */
export interface Composition {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly adminAuth: AdminAuth;
  /** `null` si no hay servidor configurado. */
  readonly dispositivos: DeviceRepository | null;
  /** Importación del catálogo; `null` si no hay servidor configurado. */
  readonly catalogo: ImportCatalogDeps | null;
  /** Lector de la bitácora; `null` si no hay servidor configurado. */
  readonly bitacora: AuditReader | null;
  /** Nombres de las personas, para mostrarlos en la bitácora en lugar de su identificador. */
  readonly cargarNombres: () => Promise<ReadonlyMap<string, string>>;
  /** Aviso de privacidad versionado; `null` si no hay servidor configurado. */
  readonly legal: LegalDeps | null;
  /** Altas y correcciones de clientes; `null` si no hay servidor configurado. */
  readonly clientes: ManageCustomersDeps | null;
  /** Conexión de esta tablet con un código de registro; `null` si no hay servidor configurado. */
  readonly conectarTablet: RegisterTabletDeps | null;
  /** Catálogo guardado en la tablet para vender sin internet, y cómo ponerlo al día. */
  readonly catalogoLocal: {
    readonly store: CatalogLocalStore;
    readonly actualizar: () => Promise<ResultadoDeActualizar>;
  } | null;
  /** Entrada con PIN en la tablet: personas guardadas, quién está activo y cómo ponerlas al día. */
  readonly entradaConPin: {
    readonly deps: SignInWithPinDeps;
    readonly session: ActiveUserSession;
    readonly actualizar: () => Promise<boolean>;
  } | null;
  /** Altas, PIN y desactivación de personas; `null` si no hay servidor configurado. */
  readonly usuarios: ManageUsersDeps | null;
  /** Mínimo de dígitos del PIN de un administrador y vueltas de PBKDF2, de la configuración. */
  readonly cargarPoliticaDeUsuarios: () => Promise<UserPolicy | null>;
  /** Minutos de inactividad para cerrar la sesión de un administrador; `null` = por definir (PD-21). */
  readonly cargarLimiteInactividad: () => Promise<number | null>;
  /** Minutos sugeridos para la vigencia de un código de registro de tablet (PD-48). */
  readonly cargarVigenciaDeCodigo: () => Promise<number | null>;
}

export interface EntornoSupabase {
  readonly url?: string | undefined;
  readonly anonKey?: string | undefined;
}

const registroDeReglas = createPriceRegistry(defaultRules);
const reglas = registroDeReglas.ok ? registroDeReglas.value : null;

type CredencialesDeLaTablet = ReturnType<typeof localCredentialsStore>;

/** Abre la sesión de la tablet en un cliente aparte, para no mezclarla con la de un administrador.
 *  Si la sesión se renovó, guarda la nueva: la anterior ya no sirve. */
async function abrirSesionDeLaTablet(
  url: string,
  anonKey: string,
  credenciales: CredencialesDeLaTablet,
  c: DeviceCredentials,
): Promise<SupabaseClient | null> {
  const cliente = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await cliente.auth.setSession({
    access_token: c.session.accessToken,
    refresh_token: c.session.refreshToken,
  });
  if (error !== null || data.session === null) {
    return null;
  }
  if (data.session.refresh_token !== c.session.refreshToken) {
    await credenciales.save({
      ...c,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    });
  }
  return cliente;
}

function crearCatalogoLocal(
  url: string,
  anonKey: string,
  credenciales: CredencialesDeLaTablet,
): NonNullable<Composition['catalogoLocal']> {
  const store = dexieCatalogStore();
  async function fuenteConSesion(c: DeviceCredentials) {
    const cliente = await abrirSesionDeLaTablet(url, anonKey, credenciales, c);
    return cliente === null ? null : supabaseCatalogReplica(cliente);
  }
  return {
    store,
    actualizar: () => actualizarCatalogoLocal({ credenciales, fuenteConSesion, store }),
  };
}

/** Minutos de bloqueo por inactividad cuando la tablet todavía no ha bajado la configuración. */
const MINUTOS_DE_BLOQUEO_INICIALES = 5;

function crearEntradaConPin(
  url: string,
  anonKey: string,
  credenciales: CredencialesDeLaTablet,
): NonNullable<Composition['entradaConPin']> {
  const identidad = dexieIdentity();
  let minutosDeBloqueo: number | null = MINUTOS_DE_BLOQUEO_INICIALES;
  void identidad.store.load().then((copia) => {
    if (copia !== null) {
      minutosDeBloqueo = copia.idleLockMinutes;
    }
  });
  return {
    deps: {
      store: identidad.store,
      hasher: webCryptoPinHasher,
      guard: identidad.guard(
        systemClock,
        async () => (await identidad.store.load())?.lockout ?? null,
      ),
      deviceReady: async () => (await credenciales.load()) !== null,
    },
    session: createActiveUserSession(systemClock, () => minutosDeBloqueo),
    actualizar: async () => {
      const c = await credenciales.load();
      if (c === null) {
        return false;
      }
      const cliente = await abrirSesionDeLaTablet(url, anonKey, credenciales, c);
      if (cliente === null) {
        return false;
      }
      const r = await refreshLogin({
        source: supabaseLoginSource(cliente),
        store: identidad.store,
      });
      if (r.ok) {
        minutosDeBloqueo = (await identidad.store.load())?.idleLockMinutes ?? minutosDeBloqueo;
      }
      return r.ok;
    },
  };
}

export function createComposition(entorno: EntornoSupabase = {}): Composition {
  const cliente = createSupabaseClient(entorno.url, entorno.anonKey);
  const ajustes = cliente === null ? null : supabaseSettingsRepository(cliente);
  const legal: LegalDeps | null =
    cliente === null ? null : { legal: supabaseLegal(cliente), clock: systemClock };

  const credencialesDeLaTablet = localCredentialsStore(window.localStorage);
  const catalogoLocal =
    entorno.url === undefined || entorno.anonKey === undefined
      ? null
      : crearCatalogoLocal(entorno.url, entorno.anonKey, credencialesDeLaTablet);
  const entradaConPin =
    entorno.url === undefined || entorno.anonKey === undefined
      ? null
      : crearEntradaConPin(entorno.url, entorno.anonKey, credencialesDeLaTablet);

  return {
    clock: systemClock,
    idGenerator: uuidIdGenerator,
    adminAuth: cliente === null ? adminAuthNoConfigurada : supabaseAdminAuth(cliente),
    dispositivos: cliente === null ? null : supabaseDeviceRepository(cliente),
    catalogo:
      cliente === null || reglas === null
        ? null
        : {
            products: supabaseCatalog(cliente),
            categories: supabaseCatalog(cliente),
            idGenerator: uuidIdGenerator,
            priceRules: reglas,
          },
    bitacora: cliente === null ? null : supabaseAuditReader(cliente),
    cargarNombres: async () => {
      if (cliente === null) {
        return new Map();
      }
      const personas = await supabaseUsers(cliente).list();
      return new Map(personas.ok ? personas.value.map((p) => [p.id, p.name]) : []);
    },
    legal,
    clientes:
      cliente === null
        ? null
        : {
            customers: supabaseCustomers(cliente, { conDatosFiscales: true }),
            idGenerator: uuidIdGenerator,
            ...(legal === null ? {} : { privacy: legal }),
          },
    usuarios:
      cliente === null
        ? null
        : {
            users: supabaseUsers(cliente),
            hasher: webCryptoPinHasher,
            idGenerator: uuidIdGenerator,
          },
    conectarTablet:
      cliente === null || entorno.url === undefined || entorno.anonKey === undefined
        ? null
        : {
            registrar: functionDeviceRegistrar({ url: entorno.url, anonKey: entorno.anonKey }),
            store: localCredentialsStore(window.localStorage),
            clock: systemClock,
          },
    catalogoLocal,
    entradaConPin,
    cargarPoliticaDeUsuarios: async () => {
      if (ajustes === null) {
        return null;
      }
      const resultado = await ajustes.load();
      return resultado.ok
        ? {
            adminMinDigits: resultado.value.admin_pin_min_digits,
            pbkdf2Iterations: resultado.value.pin_pbkdf2_iterations,
          }
        : null;
    },
    cargarLimiteInactividad: async () => {
      if (ajustes === null) {
        return null;
      }
      const resultado = await ajustes.load();
      return resultado.ok ? resultado.value.admin_idle_logout_minutes : null;
    },
    cargarVigenciaDeCodigo: async () => {
      if (ajustes === null) {
        return null;
      }
      const resultado = await ajustes.load();
      return resultado.ok ? resultado.value.device_code_validity_minutes : null;
    },
  };
}
