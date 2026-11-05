import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import { SOLICITUD_DE_PRUEBA } from '../contracts/billing-provider.contract';
import type { CancellationMotive } from '../domain/invoice';
import {
  canCancelInvoice,
  cancelInvoice,
  type CancelInvoiceInput,
  type CancelInvoiceStore,
  type CancellableInvoice,
} from './cancel-invoice';
import { simulatedBilling } from './simulated-billing';

const luis = asId<'User'>('u-luis');
const ana = asId<'User'>('u-ana');

interface Cancelacion {
  requestId: string;
  motive: CancellationMotive;
  substituteUuid: string | null;
  by: string;
  pending: boolean;
}

/** Entorno con dos facturas ya timbradas en el simulador (F-2026-0001 y F-2026-0002). */
async function entorno(opciones: { aceptacion?: boolean } = {}) {
  const provider = simulatedBilling({
    clock: fixedClock(new Date('2026-11-20T18:00:00.000Z')),
    idGenerator: sequentialIdGenerator('uuid'),
    ...(opciones.aceptacion === undefined
      ? {}
      : { cancellationNeedsAcceptance: opciones.aceptacion }),
  });
  const a = await provider.stamp({ ...SOLICITUD_DE_PRUEBA, requestId: 'r1' });
  const b = await provider.stamp({ ...SOLICITUD_DE_PRUEBA, requestId: 'r2' });
  if (!a.ok || !b.ok) {
    throw new Error('no timbró');
  }
  const facturas = new Map<string, CancellableInvoice>([
    [
      'F-2026-0001',
      {
        requestId: 'r1',
        status: 'STAMPED',
        uuid: a.value.uuid,
        folio: 'F-2026-0001',
        cancellationRequested: false,
      },
    ],
    [
      'F-2026-0002',
      {
        requestId: 'r2',
        status: 'STAMPED',
        uuid: b.value.uuid,
        folio: 'F-2026-0002',
        cancellationRequested: false,
      },
    ],
    [
      'F-2026-0003',
      {
        requestId: 'r3',
        status: 'IN_PROCESS',
        uuid: null,
        folio: null,
        cancellationRequested: false,
      },
    ],
    [
      'F-2026-0004',
      {
        requestId: 'r4',
        status: 'CANCELLED',
        uuid: 'uuid-x',
        folio: 'F-2026-0004',
        cancellationRequested: false,
      },
    ],
  ]);
  const cancelaciones: Cancelacion[] = [];
  const store: CancelInvoiceStore = {
    findByFolio: (folio) => Promise.resolve(facturas.get(folio) ?? null),
    markCancelled: (requestId, e) => {
      cancelaciones.push({ requestId, ...e });
      return Promise.resolve();
    },
  };
  return {
    deps: { provider, store },
    provider,
    cancelaciones,
    uuids: { a: a.value.uuid, b: b.value.uuid },
  };
}

const admin = { userId: luis, role: 'ADMIN' as const };
const cancelar = (
  folio: string,
  motive: CancellationMotive,
  extra: Partial<CancelInvoiceInput> = {},
): CancelInvoiceInput => ({
  actor: admin,
  folio,
  motive,
  ...extra,
});

describe('quién cancela', () => {
  it('solo un administrador: un cajero no, ni sin rol', () => {
    expect(canCancelInvoice('ADMIN')).toBe(true);
    expect(canCancelInvoice('STAFF')).toBe(false);
    expect(canCancelInvoice(null)).toBe(false);
  });

  it('un cajero no cancela y no se toca ni el PAC ni la bitácora', async () => {
    const { deps, cancelaciones } = await entorno();
    const r = await cancelInvoice(
      deps,
      cancelar('F-2026-0001', '02', { actor: { userId: ana, role: 'STAFF' } }),
    );
    expect(r).toEqual({ kind: 'NOT_AUTHORIZED' });
    expect(cancelaciones).toEqual([]);
    expect((await deps.provider.getStatus('uuid-0001')).ok).toBe(true);
    const estado = await deps.provider.getStatus('uuid-0001');
    expect(estado.ok && estado.value).toBe('VALID');
  });
});

describe('cancelar una factura con los motivos del SAT', () => {
  it.each(['02', '03', '04'] as const)(
    'con el motivo %s se cancela y queda en la bitácora con quién y por qué',
    async (motivo) => {
      const { deps, cancelaciones, provider } = await entorno();
      expect(await cancelInvoice(deps, cancelar('F-2026-0001', motivo))).toEqual({
        kind: 'CANCELLED',
      });
      expect(cancelaciones).toEqual([
        { requestId: 'r1', motive: motivo, substituteUuid: null, by: luis, pending: false },
      ]);
      const estado = await provider.getStatus('uuid-0001');
      expect(estado.ok && estado.value).toBe('CANCELLED');
    },
  );

  it('el motivo 01 exige la factura que la sustituye y manda su UUID al PAC', async () => {
    const { deps, cancelaciones, uuids } = await entorno();
    const sin = await cancelInvoice(deps, cancelar('F-2026-0001', '01'));
    expect(sin).toEqual({ kind: 'INVALID', fields: ['substituteFolio'] });
    const con = await cancelInvoice(
      deps,
      cancelar('F-2026-0001', '01', { substituteFolio: ' F-2026-0002 ' }),
    );
    expect(con).toEqual({ kind: 'CANCELLED' });
    expect(cancelaciones[0]).toMatchObject({ motive: '01', substituteUuid: uuids.b });
  });

  it('la sustituta debe existir, estar timbrada y ser otra factura', async () => {
    const { deps, cancelaciones } = await entorno();
    for (const sustituta of ['F-2026-0099', 'F-2026-0003', 'F-2026-0004', 'F-2026-0001']) {
      expect(
        await cancelInvoice(deps, cancelar('F-2026-0001', '01', { substituteFolio: sustituta })),
      ).toEqual({
        kind: 'INVALID',
        fields: ['substituteFolio'],
      });
    }
    expect(cancelaciones).toEqual([]);
  });

  it('con otro motivo no se admite sustituta', async () => {
    const { deps } = await entorno();
    expect(
      await cancelInvoice(deps, cancelar('F-2026-0001', '02', { substituteFolio: 'F-2026-0002' })),
    ).toEqual({
      kind: 'INVALID',
      fields: ['substituteFolio'],
    });
    expect(
      (await cancelInvoice(deps, cancelar('F-2026-0001', '03', { substituteFolio: '  ' }))).kind,
    ).toBe('CANCELLED');
  });

  it('un motivo que no es del SAT se rechaza', async () => {
    const { deps } = await entorno();
    const r = await cancelInvoice(deps, cancelar('F-2026-0001', '09' as CancellationMotive));
    expect(r).toEqual({ kind: 'INVALID', fields: ['motive'] });
  });

  it('una factura que no existe, o que no está timbrada, no se cancela', async () => {
    const { deps } = await entorno();
    expect(await cancelInvoice(deps, cancelar('F-2026-0099', '02'))).toEqual({ kind: 'NOT_FOUND' });
    expect(await cancelInvoice(deps, cancelar('F-2026-0003', '02'))).toEqual({ kind: 'NOT_FOUND' });
    expect(await cancelInvoice(deps, cancelar('F-2026-0004', '02'))).toEqual({
      kind: 'NOT_CANCELLABLE',
    });
  });

  it('si el receptor debe aceptar, la cancelación queda solicitada y la factura vigente', async () => {
    const { deps, cancelaciones } = await entorno({ aceptacion: true });
    expect(await cancelInvoice(deps, cancelar('F-2026-0001', '02'))).toEqual({
      kind: 'CANCELLATION_PENDING',
    });
    expect(cancelaciones[0]?.pending).toBe(true);
  });

  it('si el PAC ya la tenía cancelada, queda asentada sin error', async () => {
    const { deps, provider, cancelaciones } = await entorno();
    await provider.cancel({ uuid: 'uuid-0001', motive: '02' });
    expect(await cancelInvoice(deps, cancelar('F-2026-0001', '02'))).toEqual({ kind: 'CANCELLED' });
    expect(cancelaciones).toHaveLength(1);
  });

  it('un rechazo del PAC se avisa; que no responda se dice aparte y no deja nada asentado', async () => {
    const { deps, provider, cancelaciones } = await entorno();
    provider.failNext('CANCELLATION_REJECTED');
    expect(await cancelInvoice(deps, cancelar('F-2026-0001', '02'))).toEqual({
      kind: 'REJECTED',
      code: 'CANCELLATION_REJECTED',
    });
    provider.failNext('TIMEOUT');
    expect(await cancelInvoice(deps, cancelar('F-2026-0001', '02'))).toEqual({
      kind: 'UNAVAILABLE',
    });
    expect(cancelaciones).toEqual([]);
  });

  it('si la base falla responde que no está disponible', async () => {
    const { deps } = await entorno();
    const roto = {
      ...deps,
      store: { ...deps.store, findByFolio: () => Promise.reject(new Error('base caída')) },
    };
    expect(await cancelInvoice(roto, cancelar('F-2026-0001', '02'))).toEqual({
      kind: 'UNAVAILABLE',
    });
  });
});
