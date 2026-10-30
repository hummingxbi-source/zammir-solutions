import { describe, expect, it } from 'vitest';

import { fixedClock } from '../shared-kernel/clock';
import { asId, sequentialIdGenerator } from '../shared-kernel/id';
import { inMemoryAuditLog } from '../modules/audit/application/in-memory-audit-log';
import { createProduct } from '../modules/catalog/application/create-product';
import { inMemoryCatalog } from '../modules/catalog/application/in-memory-catalog';
import { updateProduct } from '../modules/catalog/application/update-product';
import { borradorDePrueba } from '../modules/catalog/contracts/catalog.contract';
import { createPriceRegistry, defaultRules } from '../modules/catalog/domain/pricing/registry';
import {
  anonymizeCustomer,
  createCustomer,
} from '../modules/customers/application/manage-customers';
import {
  clienteDePrueba,
  clientesEnMemoriaDePrueba,
} from '../modules/customers/contracts/customer-repository.contract';
import { NO_FISCAL_PROFILE } from '../modules/customers/domain/customer';
import { fakePinHasher, inMemoryUsers } from '../modules/identity/application/in-memory-users';
import {
  createUser,
  resetPin,
  setUserActive,
  updateUser,
} from '../modules/identity/application/manage-users';
import {
  PERMISSION_MATRIX,
  defaultPermissionPolicy,
  type Permission,
} from '../modules/identity/domain/permissions';

/** E8 · Permisos [PRUEBAS_DE_ACEPTACION.md]: el cajero queda limitado en el dominio. Cada fila de la matriz
 *  con acción ya construida se prueba con la acción real; las que esperan a un sprint posterior quedan
 *  listadas con su sprint y la prueba de la matriz las cubre. El lado de la base de datos lo prueban las
 *  pruebas de permisos con Supabase real (`*.integracion.test.ts`) y `pgTAP`. */

const reglas = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro de reglas');
  }
  return r.value;
})();

const POLITICA = { adminMinDigits: 6, pbkdf2Iterations: 1000 };

function entorno() {
  const clock = fixedClock(new Date('2026-10-30T12:00:00.000Z'));
  const auditLog = inMemoryAuditLog();
  const idGenerator = sequentialIdGenerator('x');
  const catalog = inMemoryCatalog({ idGenerator, clock, auditLog });
  const users = inMemoryUsers({ clock, idGenerator, auditLog });
  const { customers } = clientesEnMemoriaDePrueba();
  return {
    catalog,
    gestion: { users, hasher: fakePinHasher(), idGenerator },
    products: { products: catalog, idGenerator, priceRules: reglas },
    customers,
  };
}

async function primeraCategoria(catalog: ReturnType<typeof entorno>['catalog']) {
  const r = await catalog.listCategories();
  if (!r.ok || r.value[0] === undefined) {
    throw new Error('sin categorías');
  }
  return r.value[0].id;
}

describe('E8 · el cajero queda limitado por el dominio', () => {
  it('CATALOG_EDIT: el cajero no da de alta ni cambia productos; el administrador sí', async () => {
    const e = entorno();
    const borrador = borradorDePrueba(await primeraCategoria(e.catalog));
    const comoCajero = await createProduct(e.products, { role: 'STAFF' }, borrador);
    expect(!comoCajero.ok && comoCajero.error.code).toBe('NOT_AUTHORIZED');

    const alta = await createProduct(e.products, { role: 'ADMIN' }, borrador);
    expect(alta.ok).toBe(true);
    if (!alta.ok) {
      return;
    }
    const cambio = { ...borrador, name: 'Otro nombre' };
    const intento = await updateProduct(e.products, { role: 'STAFF' }, alta.value.id, cambio);
    expect(!intento.ok && intento.error.code).toBe('NOT_AUTHORIZED');
    const bien = await updateProduct(e.products, { role: 'ADMIN' }, alta.value.id, cambio);
    expect(bien.ok).toBe(true);
  });

  it('USERS_AND_DEVICES: el cajero no administra personas; el administrador sí', async () => {
    const e = entorno();
    const entrada = { name: 'Nuevo', role: 'STAFF' as const, pin: '4829' };
    const comoCajero = await createUser(e.gestion, POLITICA, { role: 'STAFF' }, entrada);
    expect(!comoCajero.ok && comoCajero.error.code).toBe('NOT_AUTHORIZED');

    const alta = await createUser(e.gestion, POLITICA, { role: 'ADMIN' }, entrada);
    expect(alta.ok).toBe(true);
    if (!alta.ok) {
      return;
    }
    const id = alta.value.id;
    const cajero = { role: 'STAFF' as const };
    const edicion = await updateUser(e.gestion, POLITICA, cajero, id, { name: 'Otro' });
    const desactivar = await setUserActive(e.gestion, cajero, id, false);
    const pin = await resetPin(e.gestion, POLITICA, cajero, id, '7391');
    for (const r of [edicion, desactivar, pin]) {
      expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    }
    const sigue = await e.gestion.users.get(id);
    expect(sigue.ok && sigue.value.isActive).toBe(true);
  });

  it('PRIVACY_NOTICE_EDIT: el cajero no anonimiza clientes; el administrador sí', async () => {
    const e = entorno();
    const alta = await createCustomer(
      { customers: e.customers, idGenerator: sequentialIdGenerator('c') },
      { role: 'STAFF' },
      {
        name: 'Ana López',
        phone: '55 1234 5678',
        email: null,
        notes: null,
        fiscal: NO_FISCAL_PROFILE,
        privacyNoticeVersion: null,
      },
    );
    expect(alta.ok).toBe(true);
    const id = alta.ok ? alta.value.id : asId<'Customer'>('x');
    const comoCajero = await anonymizeCustomer({ customers: e.customers }, { role: 'STAFF' }, id);
    expect(!comoCajero.ok && comoCajero.error.code).toBe('NOT_AUTHORIZED');
    const comoAdmin = await anonymizeCustomer({ customers: e.customers }, { role: 'ADMIN' }, id);
    expect(comoAdmin.ok).toBe(true);
    expect(clienteDePrueba).toBeDefined();
  });

  it('la tablet sola (sin persona) y nadie no pueden nada de la matriz', () => {
    for (const permiso of Object.keys(PERMISSION_MATRIX) as Permission[]) {
      expect(defaultPermissionPolicy.check('DEVICE', permiso)).toBe('DENY');
      expect(defaultPermissionPolicy.check(null, permiso)).toBe('DENY');
    }
  });

  it('todo lo que la matriz le niega al cajero lo niega la política, fila por fila', () => {
    const negadas: Permission[] = [
      'CATALOG_EDIT',
      'ORDER_DELIVER_WITH_BALANCE',
      'CANCEL_SALE_OR_ORDER',
      'OTHERS_CASH_VIEW',
      'REPORTS_AND_RECEIVABLES',
      'USERS_AND_DEVICES',
      'PRIVACY_NOTICE_EDIT',
    ];
    for (const permiso of Object.keys(PERMISSION_MATRIX) as Permission[]) {
      expect(defaultPermissionPolicy.check('STAFF', permiso) === 'DENY').toBe(
        negadas.includes(permiso),
      );
      expect(defaultPermissionPolicy.check('ADMIN', permiso)).not.toBe('DENY');
    }
  });
});
