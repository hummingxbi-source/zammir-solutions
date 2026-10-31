import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  authorizeWithAdminPin,
  createActiveUserSession,
  localProductReader,
  outboxCustomers,
  attachOrderPhoto,
  outboxPaymentStore,
  outboxWorkOrderStore,
  outboxQuoteStore,
  reconcileOrders,
  reconcileQuotes,
  reconcileSales,
  refreshDocuments,
  uploadPendingPhotos,
  refreshCustomers,
  err,
  ok,
  createSyncEngine,
  exponentialBackoff,
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
  type OrderDeps,
  type PhotoStore,
  type QuoteConditionsStore,
  type RegisterTabletDeps,
  type SignInWithPinDeps,
  type SyncEngine,
  type SyncOutbox,
  type AppUser,
  type UserId,
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
import { supabaseDocumentReplica } from '../modules/orders/infra/supabase-document-replica';
import { supabaseCustomerReplica } from '../modules/customers/infra/supabase-customer-replica';
import { supabaseCustomers } from '../modules/customers/infra/supabase-customers';
import { supabaseLegal } from '../modules/legal/infra/supabase-legal';
import { supabaseQuoteConditions } from '../modules/settings/infra/supabase-quote-conditions';
import { pdfLibRenderer } from '../modules/documents/infra/pdf-lib-renderer';
import { entornoDelNavegador, webShareService } from '../modules/documents/infra/web-share-service';
import type { PrepararCotizador } from '../modules/quotes/ui/CotizadorEnLaTablet';
import { canvasImageCompressor } from '../modules/orders/infra/canvas-image-compressor';
import { dexiePhotoStore } from '../modules/orders/infra/dexie-photo-store';
import { supabasePhotoUploader } from '../modules/orders/infra/supabase-photo-uploader';
import { compartirComprobante } from '../modules/orders/ui/comprobante';
import { qrMatrix } from '../modules/documents/infra/qr-matrix';
import type { PrepararOrdenes } from '../modules/orders/ui/OrdenesEnLaTablet';
import { cryptoRandom } from '../shared/infra/crypto-random';
import { browserTimer } from '../shared/infra/sync/browser-timer';
import { dexieOperaciones } from '../shared/infra/sync/dexie-operaciones';
import { functionOperationReceiver } from '../shared/infra/sync/function-operation-receiver';
import { httpOperationTransport } from '../shared/infra/sync/http-operation-transport';
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
  /** Condiciones de la cotización; `null` si no hay servidor configurado. */
  readonly condiciones: QuoteConditionsStore | null;
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
  /** Cola de salida y envío automático de lo guardado en la tablet; `null` si no hay servidor. */
  readonly envio: {
    readonly outbox: SyncOutbox;
    readonly engine: SyncEngine;
    /** Baja los clientes nuevos o corregidos desde otras tablets (sin datos fiscales). */
    readonly actualizarClientes: () => Promise<void>;
    /** Baja las órdenes y los pagos hechos en otras tablets. */
    readonly actualizarDocumentos: () => Promise<void>;
    /** Sube las fotos de medición que quedaron guardadas en la tablet. */
    readonly subirFotos: () => Promise<void>;
    /** Fotos de la medición guardadas en la tablet. */
    readonly fotos: PhotoStore;
    /** Para el indicador de estado: horas sin enviar antes de avisar (de la configuración bajada). */
    readonly visible: {
      readonly engine: SyncEngine;
      readonly staleHours: number | null;
      readonly ahora: () => Date;
    };
  } | null;
  /** Cómo reunir lo que el cotizador necesita; `null` si no hay servidor configurado. */
  readonly prepararCotizador: PrepararCotizador | null;
  /** Cómo reunir lo que las órdenes de trabajo necesitan; `null` si no hay servidor configurado. */
  readonly prepararOrdenes: PrepararOrdenes | null;
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

function crearEnvio(
  url: string,
  anonKey: string,
  credenciales: CredencialesDeLaTablet,
): NonNullable<Composition['envio']> {
  const outbox = dexieOperaciones({ clock: systemClock });
  const receiver = functionOperationReceiver({
    url,
    anonKey,
    accessToken: async () => {
      const c = await credenciales.load();
      const cliente =
        c === null ? null : await abrirSesionDeLaTablet(url, anonKey, credenciales, c);
      const sesion = cliente === null ? null : (await cliente.auth.getSession()).data.session;
      // Sin sesión de la tablet el servidor responderá "dispositivo no válido": se detiene la cola.
      return sesion?.access_token ?? '';
    },
  });
  const engine = createSyncEngine({
    outbox,
    transport: httpOperationTransport(receiver),
    backoff: exponentialBackoff(),
    random: cryptoRandom,
    timer: browserTimer,
    clock: systemClock,
    afterPass: async () => {
      await reconcileQuotes(outbox);
      await reconcileOrders(outbox);
      await reconcileSales(outbox);
    },
  });
  const fotos = dexiePhotoStore();
  const identidad = dexieIdentity();
  let horas: number | null = null;
  const leerHoras = (): void => {
    void identidad.store.load().then((copia) => {
      horas = copia?.syncStaleHours ?? null;
    });
  };
  leerHoras();
  engine.subscribe(leerHoras);
  return {
    outbox,
    engine,
    async actualizarClientes() {
      const c = await credenciales.load();
      const sesion = c === null ? null : await abrirSesionDeLaTablet(url, anonKey, credenciales, c);
      if (sesion !== null) {
        await refreshCustomers({ source: supabaseCustomerReplica(sesion), outbox });
      }
    },
    fotos,
    async subirFotos() {
      const c = await credenciales.load();
      const sesion = c === null ? null : await abrirSesionDeLaTablet(url, anonKey, credenciales, c);
      if (sesion !== null) {
        await uploadPendingPhotos({ photos: fotos, uploader: supabasePhotoUploader(sesion) });
      }
    },
    async actualizarDocumentos() {
      const c = await credenciales.load();
      const sesion = c === null ? null : await abrirSesionDeLaTablet(url, anonKey, credenciales, c);
      if (sesion !== null) {
        await refreshDocuments({
          source: supabaseDocumentReplica(sesion),
          outbox,
          clock: systemClock,
        });
      }
    },
    visible: {
      engine,
      get staleHours() {
        return horas;
      },
      ahora: () => systemClock.now(),
    },
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

/** Lo que el cotizador toma de la tablet: configuración y personas bajadas, catálogo local, cola de salida. */
function crearPreparadorDelCotizador(d: {
  readonly envio: NonNullable<Composition['envio']>;
  readonly catalogoLocal: NonNullable<Composition['catalogoLocal']>;
  readonly entradaConPin: NonNullable<Composition['entradaConPin']>;
  readonly credenciales: CredencialesDeLaTablet;
  readonly reglas: NonNullable<typeof reglas>;
}): PrepararCotizador {
  const identidad = dexieIdentity();
  return async () => {
    const credenciales = await d.credenciales.load();
    const copia = await identidad.store.load();
    if (credenciales === null || copia?.quote === undefined) {
      return null;
    }
    const personas = copia.users;
    const usuarios = {
      get: (id: UserId) => {
        const p = personas.find((u: AppUser) => u.id === id);
        return Promise.resolve(p === undefined ? err({ code: 'NOT_FOUND' as const }) : ok(p));
      },
    };
    return {
      deps: {
        store: outboxQuoteStore(d.envio.outbox),
        idGenerator: uuidIdGenerator,
        clock: systemClock,
        registry: d.reglas,
        taxRateBps: copia.quote.taxRateBps,
        outbox: d.envio.outbox,
        random: cryptoRandom,
        device: { id: credenciales.device.id, series: credenciales.device.tempSeries },
        settings: {
          validityDays: copia.quote.validityDays,
          conditionsText: copia.quote.conditionsText,
          privacyNoticeVersion: null,
          catalogVersion: await d.catalogoLocal.store.cursor(),
        },
      },
      catalogo: localProductReader(d.catalogoLocal.store),
      // Los clientes viven en la tablet y cada alta o corrección sale como operación [S2-10].
      clientes: {
        customers: outboxCustomers({
          outbox: d.envio.outbox,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
          device: { id: credenciales.device.id },
          currentUserId: () => {
            const estado = d.entradaConPin.session.state();
            return estado.kind === 'ACTIVE' ? estado.user.id : null;
          },
        }),
        idGenerator: uuidIdGenerator,
      },
      renderer: pdfLibRenderer(),
      share: webShareService(entornoDelNavegador()),
      negocio: {
        name: copia.business?.name ?? 'ZAMMIR (datos de prueba)',
        phone: copia.business?.phone ?? null,
        address: copia.business?.address ?? null,
      },
      condicionesPorDefecto: copia.quote.conditionsText,
      autorizacion: {
        administradores: () =>
          Promise.resolve(
            personas
              .filter((u: AppUser) => u.role === 'ADMIN' && u.isActive)
              .map((u: AppUser) => ({ id: u.id, name: u.name })),
          ),
        autorizar: (adminId: string, pin: string) =>
          authorizeWithAdminPin(
            {
              users: usuarios,
              hasher: d.entradaConPin.deps.hasher,
              guard: d.entradaConPin.deps.guard,
              clock: systemClock,
            },
            { adminId: adminId as UserId, pin },
          ),
      },
      alCambiarElEnvio: (aviso: () => void) => d.envio.engine.subscribe(aviso),
      onPorEnviar: () => {
        void d.envio.engine.trigger();
      },
    };
  };
}

/** Lo que las órdenes toman de la tablet: configuración y personas bajadas, la cola de salida y lo ya
 *  guardado de órdenes y pagos [S3-*]. */
function crearPreparadorDeOrdenes(d: {
  readonly envio: NonNullable<Composition['envio']>;
  readonly entradaConPin: NonNullable<Composition['entradaConPin']>;
  readonly credenciales: CredencialesDeLaTablet;
}): PrepararOrdenes {
  const identidad = dexieIdentity();
  return async () => {
    const credenciales = await d.credenciales.load();
    const copia = await identidad.store.load();
    if (credenciales === null || copia?.orders === undefined) {
      return null;
    }
    const personas = copia.users;
    const usuarios = {
      get: (id: UserId) => {
        const p = personas.find((u: AppUser) => u.id === id);
        return Promise.resolve(p === undefined ? err({ code: 'NOT_FOUND' as const }) : ok(p));
      },
    };
    const orderDeps: OrderDeps = {
      orders: outboxWorkOrderStore(d.envio.outbox),
      payments: outboxPaymentStore(d.envio.outbox),
      quotes: outboxQuoteStore(d.envio.outbox),
      outbox: d.envio.outbox,
      idGenerator: uuidIdGenerator,
      clock: systemClock,
      random: cryptoRandom,
      device: { id: credenciales.device.id, series: credenciales.device.tempSeries },
      settings: {
        depositPercentBps: copia.orders.depositPercentBps,
        requireDepositToStart: copia.orders.requireDepositToStart,
        warrantyMonthsDefault: copia.orders.warrantyMonthsDefault,
      },
    };
    return {
      deps: orderDeps,
      clientes: {
        customers: outboxCustomers({
          outbox: d.envio.outbox,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
          device: { id: credenciales.device.id },
          currentUserId: () => {
            const estado = d.entradaConPin.session.state();
            return estado.kind === 'ACTIVE' ? estado.user.id : null;
          },
        }),
        idGenerator: uuidIdGenerator,
      },
      personas: personas
        .filter((u: AppUser) => u.isActive)
        .map((u: AppUser) => ({ id: u.id, name: u.name })),
      autorizacion: {
        administradores: () =>
          Promise.resolve(
            personas
              .filter((u: AppUser) => u.role === 'ADMIN' && u.isActive)
              .map((u: AppUser) => ({ id: u.id, name: u.name })),
          ),
        autorizar: (adminId: string, pin: string) =>
          authorizeWithAdminPin(
            {
              users: usuarios,
              hasher: d.entradaConPin.deps.hasher,
              guard: d.entradaConPin.deps.guard,
              clock: systemClock,
            },
            { adminId: adminId as UserId, pin },
          ),
      },
      fotos: {
        listar: (orderId) => d.envio.fotos.listByOrder(orderId),
        agregar: async (orderId, archivo) => {
          const estado = d.entradaConPin.session.state();
          if (estado.kind !== 'ACTIVE') {
            return 'NOT_AUTHORIZED';
          }
          const r = await attachOrderPhoto(
            {
              orders: orderDeps.orders,
              photos: d.envio.fotos,
              compressor: canvasImageCompressor(),
              idGenerator: uuidIdGenerator,
              clock: systemClock,
            },
            { userId: estado.user.id, role: estado.user.role },
            orderId,
            archivo,
          );
          if (r.ok) {
            void d.envio.subirFotos();
          }
          return r.ok ? null : r.error.code;
        },
      },
      onComprobante: compartirComprobante({
        orderDeps,
        renderer: pdfLibRenderer(),
        share: webShareService(entornoDelNavegador()),
        negocio: {
          name: copia.business?.name ?? 'ZAMMIR (datos de prueba)',
          phone: copia.business?.phone ?? null,
          address: copia.business?.address ?? null,
        },
        condiciones: copia.quote?.conditionsText ?? '',
        leyendaDeAutofacturacion: copia.orders.selfInvoicingLegend,
        direccionBase: copia.orders.publicBaseUrl,
        qrMatrix,
      }),
      alCambiarElEnvio: (aviso: () => void) => d.envio.engine.subscribe(aviso),
      onPorEnviar: () => {
        void d.envio.engine.trigger();
      },
    };
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

  const envio =
    entorno.url === undefined || entorno.anonKey === undefined
      ? null
      : crearEnvio(entorno.url, entorno.anonKey, credencialesDeLaTablet);

  const prepararCotizador: PrepararCotizador | null =
    envio === null || catalogoLocal === null || entradaConPin === null || reglas === null
      ? null
      : crearPreparadorDelCotizador({
          envio,
          catalogoLocal,
          entradaConPin,
          credenciales: credencialesDeLaTablet,
          reglas,
        });

  const prepararOrdenes: PrepararOrdenes | null =
    envio === null || entradaConPin === null
      ? null
      : crearPreparadorDeOrdenes({
          envio,
          entradaConPin,
          credenciales: credencialesDeLaTablet,
        });

  return {
    clock: systemClock,
    idGenerator: uuidIdGenerator,
    prepararCotizador,
    prepararOrdenes,
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
    condiciones: cliente === null ? null : supabaseQuoteConditions(cliente),
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
    envio,
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
