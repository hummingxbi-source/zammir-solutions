import {
  createPriceRegistry,
  defaultRules,
  type AdminAuth,
  type AuditReader,
  type Clock,
  type DeviceRepository,
  type IdGenerator,
  type ImportCatalogDeps,
  type LegalDeps,
  type ManageCustomersDeps,
  type ManageUsersDeps,
  type RegisterTabletDeps,
  type UserPolicy,
} from '@zammir/core';

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

export function createComposition(entorno: EntornoSupabase = {}): Composition {
  const cliente = createSupabaseClient(entorno.url, entorno.anonKey);
  const ajustes = cliente === null ? null : supabaseSettingsRepository(cliente);
  const legal: LegalDeps | null =
    cliente === null ? null : { legal: supabaseLegal(cliente), clock: systemClock };

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
