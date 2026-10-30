import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator, type CustomerId } from '../../../shared-kernel/id';
import {
  inMemoryAuditLog,
  type InMemoryAuditLog,
} from '../../audit/application/in-memory-audit-log';
import {
  ANONYMIZED_NAME,
  ANONYMIZED_PHONE,
  inMemoryCustomers,
} from '../application/in-memory-customers';
import type { CustomerRepository } from '../application/ports';
import { NO_FISCAL_PROFILE, type Customer } from '../domain/customer';

export interface CustomerRepositoryDelContrato {
  readonly customers: CustomerRepository;
  /** Un identificador nuevo, válido para el almacén (UUID en Supabase). */
  readonly nuevoId: () => CustomerId;
  /** Un teléfono de 10 dígitos que no se ha usado en esta ejecución. */
  readonly telefonoNuevo: () => string;
  /** Entradas de bitácora de un cliente, leídas por un camino independiente del puerto. */
  readonly bitacoraDe: (id: CustomerId) => Promise<readonly EntradaDeBitacoraDeCliente[]>;
}

export interface EntradaDeBitacoraDeCliente {
  readonly action: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

/** Clientes en memoria con su bitácora y un reloj fijo, para pruebas. */
export function clientesEnMemoriaDePrueba(): {
  readonly customers: CustomerRepository;
  readonly auditLog: InMemoryAuditLog;
} {
  const auditLog = inMemoryAuditLog();
  const customers = inMemoryCustomers({
    clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')),
    idGenerator: sequentialIdGenerator('b'),
    auditLog,
  });
  return { customers, auditLog };
}

/** Cliente de prueba completo; `cambios` sobreescribe lo que haga falta. */
export function clienteDePrueba(
  id: CustomerId,
  telefono: string,
  cambios: Partial<Customer> = {},
): Customer {
  return {
    id,
    name: 'Cliente de prueba',
    phone: telefono,
    email: 'cliente@ejemplo.invalid',
    notes: 'Prefiere que le llamen por la tarde',
    fiscal: {
      rfc: 'XAXX010101000',
      legalName: 'Cliente de Prueba SA de CV',
      fiscalZip: '55600',
      regime: '601',
      cfdiUse: 'G03',
    },
    privacyNoticeVersion: 1,
    anonymizedAt: null,
    ...cambios,
  };
}

/** Batería de contrato del repositorio de clientes: la pasan todos los adaptadores
 *  (memoria, Supabase y, con S1-09, IndexedDB). */
export function customerRepositoryContract(
  nombre: string,
  crear: () => CustomerRepositoryDelContrato | Promise<CustomerRepositoryDelContrato>,
): void {
  describe(`contrato de CustomerRepository: ${nombre}`, () => {
    it('guarda un cliente con todos sus datos y lo devuelve igual', async () => {
      const h = await crear();
      const cliente = clienteDePrueba(h.nuevoId(), h.telefonoNuevo());
      const creado = await h.customers.create(cliente);
      expect(creado.ok && creado.value).toEqual(cliente);
      const leido = await h.customers.get(cliente.id);
      expect(leido.ok && leido.value).toEqual(cliente);
    });

    it('conserva los datos opcionales vacíos como null', async () => {
      const h = await crear();
      const cliente = clienteDePrueba(h.nuevoId(), h.telefonoNuevo(), {
        email: null,
        notes: null,
        fiscal: NO_FISCAL_PROFILE,
        privacyNoticeVersion: null,
      });
      await h.customers.create(cliente);
      const leido = await h.customers.get(cliente.id);
      expect(leido.ok && leido.value).toEqual(cliente);
    });

    it('aparece en la lista', async () => {
      const h = await crear();
      const cliente = clienteDePrueba(h.nuevoId(), h.telefonoNuevo());
      await h.customers.create(cliente);
      const lista = await h.customers.list();
      expect(lista.ok && lista.value.some((c) => c.id === cliente.id)).toBe(true);
    });

    it('guarda los cambios', async () => {
      const h = await crear();
      const original = clienteDePrueba(h.nuevoId(), h.telefonoNuevo());
      await h.customers.create(original);
      const cambiado = {
        ...original,
        name: 'Nombre corregido',
        email: null,
        fiscal: { ...original.fiscal, rfc: null },
      };
      const r = await h.customers.update(cambiado);
      expect(r.ok && r.value).toEqual(cambiado);
      const leido = await h.customers.get(original.id);
      expect(leido.ok && leido.value).toEqual(cambiado);
    });

    it('un cliente que no existe no se encuentra ni se edita', async () => {
      const h = await crear();
      const id = h.nuevoId();
      const leido = await h.customers.get(id);
      expect(!leido.ok && leido.error.code).toBe('NOT_FOUND');
      const editado = await h.customers.update(clienteDePrueba(id, h.telefonoNuevo()));
      expect(!editado.ok && editado.error.code).toBe('NOT_FOUND');
    });

    it('el teléfono no es único: dos clientes pueden compartirlo y se encuentran los dos', async () => {
      const h = await crear();
      const telefono = h.telefonoNuevo();
      const a = clienteDePrueba(h.nuevoId(), telefono, { name: 'Ana' });
      const b = clienteDePrueba(h.nuevoId(), telefono, { name: 'Ana (esposo)' });
      expect((await h.customers.create(a)).ok).toBe(true);
      expect((await h.customers.create(b)).ok).toBe(true);
      const encontrados = await h.customers.findByPhone(telefono);
      expect(encontrados.ok && encontrados.value.map((c) => c.id).sort()).toEqual(
        [a.id, b.id].sort(),
      );
    });

    it('un teléfono que nadie tiene no encuentra a nadie', async () => {
      const h = await crear();
      const r = await h.customers.findByPhone(h.telefonoNuevo());
      expect(r.ok && r.value).toEqual([]);
    });

    describe('anonimización', () => {
      async function conCliente(h: CustomerRepositoryDelContrato) {
        const cliente = clienteDePrueba(h.nuevoId(), h.telefonoNuevo());
        await h.customers.create(cliente);
        return cliente;
      }

      it('borra los datos personales y conserva el identificador y la versión del aviso', async () => {
        const h = await crear();
        const original = await conCliente(h);
        const r = await h.customers.anonymize(original.id);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toMatchObject({
          id: original.id,
          name: ANONYMIZED_NAME,
          phone: ANONYMIZED_PHONE,
          email: null,
          notes: null,
          fiscal: NO_FISCAL_PROFILE,
          privacyNoticeVersion: original.privacyNoticeVersion,
        });
        expect(r.value.anonymizedAt).toBeInstanceOf(Date);
        const leido = await h.customers.get(original.id);
        expect(leido.ok && leido.value).toEqual(r.value);
      });

      it('deja su entrada de bitácora sin ningún dato personal, una sola vez', async () => {
        const h = await crear();
        const original = await conCliente(h);
        await h.customers.anonymize(original.id);
        await h.customers.anonymize(original.id);
        const bitacora = await h.bitacoraDe(original.id);
        expect(bitacora).toEqual([
          {
            action: 'CUSTOMER_ANONYMIZED',
            oldValue: { anonimizado: false },
            newValue: { anonimizado: true },
          },
        ]);
        const texto = JSON.stringify(bitacora);
        for (const personal of [original.name, original.phone, original.email ?? '', 'XAXX']) {
          expect(texto).not.toContain(personal);
        }
      });

      it('anonimizar dos veces no cambia nada', async () => {
        const h = await crear();
        const original = await conCliente(h);
        const primera = await h.customers.anonymize(original.id);
        const segunda = await h.customers.anonymize(original.id);
        expect(segunda.ok && primera.ok && segunda.value.anonymizedAt).toEqual(
          primera.ok ? primera.value.anonymizedAt : null,
        );
      });

      it('un cliente anonimizado ya no se edita', async () => {
        const h = await crear();
        const original = await conCliente(h);
        await h.customers.anonymize(original.id);
        const r = await h.customers.update({ ...original, name: 'Intento de volver a escribirlo' });
        expect(!r.ok && r.error.code).toBe('ANONYMIZED');
      });

      it('ya no se encuentra por su teléfono de antes', async () => {
        const h = await crear();
        const original = await conCliente(h);
        await h.customers.anonymize(original.id);
        const r = await h.customers.findByPhone(original.phone);
        expect(r.ok && r.value.some((c) => c.id === original.id)).toBe(false);
      });

      it('un cliente que no existe no se anonimiza', async () => {
        const h = await crear();
        const r = await h.customers.anonymize(h.nuevoId());
        expect(!r.ok && r.error.code).toBe('NOT_FOUND');
      });
    });

    it('el puerto no tiene operación de borrado', async () => {
      const h = await crear();
      for (const operacion of ['delete', 'remove', 'destroy']) {
        expect(operacion in h.customers).toBe(false);
      }
    });
  });
}
