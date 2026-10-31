import { describe, expect, it } from 'vitest';

import type { OperationReceiver } from '../application/operation-receiver';
import type { IssueQuotePayload, OperationResult } from '../domain/operation';

export interface DispositivoDelContrato {
  readonly id: string;
  /** El receptor tal como lo ve la sesión de ese dispositivo. */
  readonly receiver: OperationReceiver;
}

export interface ReceptorDelContrato {
  newDevice(): Promise<DispositivoDelContrato>;
  /** Una persona (con PIN) de la tablet; `activa = false` simula a alguien ya desactivado. */
  newUser(activa: boolean): Promise<string>;
  newCustomer(): Promise<string>;
  revokeDevice(id: string): Promise<void>;
  newUuid(): string;
  /** Un código público de 8 caracteres que nadie haya usado antes (el servidor real los conserva). */
  newPublicCode(): string;
  /** Un año que ninguna otra prueba haya usado: el servidor real conserva sus contadores. */
  newYear(): Promise<number>;
  /** Cuántas cotizaciones y operaciones hay guardadas para esos dispositivos (lectura independiente). */
  countsFor(deviceIds: readonly string[]): Promise<{ quotes: number; operations: number }>;
}

export interface OpcionesDeOperacion {
  readonly opId: string;
  readonly deviceId: string;
  readonly seq: number;
  readonly userId: string;
  readonly customerId: string;
  readonly year: number;
  readonly newUuid: () => string;
  readonly publicCode: string;
  readonly tempFolio?: string;
  readonly type?: string;
  readonly totalCents?: number;
}

/** Una operación IssueQuote completa y consistente (una línea de 1 m² a $116.00 con IVA incluido). */
export function issueQuoteOperation(o: OpcionesDeOperacion): Record<string, unknown> {
  const issuedAt = `${String(o.year)}-06-15T18:00:00.000Z`;
  const payload: IssuePayloadCrudo = {
    id: o.newUuid(),
    tempFolio: o.tempFolio ?? `T1-${String(o.seq).padStart(4, '0')}`,
    publicCode: o.publicCode,
    customerId: o.customerId,
    issuedAt,
    validUntil: `${String(o.year)}-06-30`,
    conditionsText: 'Condiciones de prueba',
    subtotalCents: 10_000,
    taxCents: 1_600,
    totalCents: o.totalCents ?? 11_600,
    lines: [
      {
        id: o.newUuid(),
        name: 'Vidrio claro 6 mm',
        chargeUnit: 'SQUARE_METER',
        unitPriceCents: 11_600,
        ruleId: 'AREA',
        widthMm: 1000,
        heightMm: 1000,
        quantity: 1,
        lineTotalCents: 11_600,
        baseCents: 10_000,
        taxCents: 1_600,
        detail: '1 m²',
      },
    ],
  };
  return {
    opId: o.opId,
    deviceId: o.deviceId,
    seq: o.seq,
    type: o.type ?? 'IssueQuote',
    schemaVersion: 1,
    userId: o.userId,
    clientCreatedAt: issuedAt,
    payload,
  };
}

type IssuePayloadCrudo = Omit<IssueQuotePayload, 'privacyNoticeVersion' | 'catalogVersion'>;

const CODIGOS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código público de 8 caracteres que depende solo de `n`: números distintos dan códigos distintos. */
export function codigoPublicoDePrueba(n: number): string {
  let resto = n;
  let texto = '';
  for (let i = 0; i < 8; i += 1) {
    texto = (CODIGOS[resto % CODIGOS.length] ?? 'A') + texto;
    resto = Math.floor(resto / CODIGOS.length);
  }
  return texto;
}

function folioDe(r: OperationResult): string | undefined {
  return r.ok ? r.folio : undefined;
}

function numeroDeFolio(r: OperationResult): number {
  const folio = folioDe(r);
  return Number(folio?.split('-')[2]);
}

/** Batería de contrato del receptor de operaciones: la pasan el adaptador en memoria y el de Supabase
 *  (que es el mismo servidor real: función de borde + `receive_operation`). */
export function operationReceiverContract(
  nombre: string,
  crear: () => ReceptorDelContrato | Promise<ReceptorDelContrato>,
): void {
  describe(`contrato del receptor de operaciones: ${nombre}`, () => {
    async function entorno() {
      const h = await crear();
      const dispositivo = await h.newDevice();
      const usuario = await h.newUser(true);
      const cliente = await h.newCustomer();
      const year = await h.newYear();
      const operacion = (
        d: DispositivoDelContrato,
        seq: number,
        extra: Partial<OpcionesDeOperacion> = {},
      ) =>
        issueQuoteOperation({
          opId: h.newUuid(),
          deviceId: d.id,
          seq,
          userId: usuario,
          customerId: cliente,
          year,
          newUuid: () => h.newUuid(),
          publicCode: h.newPublicCode(),
          ...extra,
        });
      return { h, dispositivo, usuario, cliente, year, operacion };
    }

    it('aplica la operación y devuelve el folio definitivo del año de emisión', async () => {
      const { dispositivo, operacion, year } = await entorno();
      const r = await dispositivo.receiver.receive(operacion(dispositivo, 1));
      expect(r.ok && r.status).toBe('APPLIED');
      expect(folioDe(r)).toBe(`COT-${String(year)}-0001`);
    });

    it('reenviar la misma operación devuelve el mismo resultado y no duplica nada', async () => {
      const { h, dispositivo, operacion } = await entorno();
      const op = operacion(dispositivo, 1);
      const primero = await dispositivo.receiver.receive(op);
      const segundo = await dispositivo.receiver.receive(op);
      const tercero = await dispositivo.receiver.receive(op);
      expect(segundo).toEqual(primero);
      expect(tercero).toEqual(primero);
      expect(await h.countsFor([dispositivo.id])).toEqual({ quotes: 1, operations: 1 });
      const siguiente = await dispositivo.receiver.receive(operacion(dispositivo, 2));
      expect(numeroDeFolio(siguiente)).toBe(2);
    });

    it('un salto de seq responde fuera de orden y dice cuál esperaba; reenviar en orden funciona', async () => {
      const { dispositivo, operacion } = await entorno();
      const saltada = await dispositivo.receiver.receive(operacion(dispositivo, 2));
      expect(saltada).toEqual({ ok: false, code: 'OUT_OF_ORDER', expectedSeq: 1 });
      const primera = await dispositivo.receiver.receive(operacion(dispositivo, 1));
      expect(primera.ok).toBe(true);
      const segunda = await dispositivo.receiver.receive(operacion(dispositivo, 2));
      expect(segunda.ok).toBe(true);
    });

    it('un dispositivo revocado se rechaza y no guarda nada', async () => {
      const { h, dispositivo, operacion } = await entorno();
      await h.revokeDevice(dispositivo.id);
      const r = await dispositivo.receiver.receive(operacion(dispositivo, 1));
      expect(r).toEqual({ ok: false, code: 'DEVICE_REVOKED' });
      expect(await h.countsFor([dispositivo.id])).toEqual({ quotes: 0, operations: 0 });
    });

    it('un dispositivo no puede mandar operaciones a nombre de otro', async () => {
      const { h, dispositivo, operacion } = await entorno();
      const otro = await h.newDevice();
      const r = await otro.receiver.receive(operacion(dispositivo, 1));
      expect(r).toEqual({ ok: false, code: 'DEVICE_REVOKED' });
    });

    it('un tipo desconocido se rechaza de forma estructural', async () => {
      const { dispositivo, operacion } = await entorno();
      const r = await dispositivo.receiver.receive(
        operacion(dispositivo, 1, { type: 'Inventada' }),
      );
      expect(r).toEqual({ ok: false, code: 'UNKNOWN_TYPE' });
    });

    it('una carga con totales que no cuadran se rechaza y no consume folio', async () => {
      const { dispositivo, operacion } = await entorno();
      const mala = await dispositivo.receiver.receive(
        operacion(dispositivo, 1, { totalCents: 99_999 }),
      );
      expect(!mala.ok && mala.code).toBe('INVALID_PAYLOAD');
      const buena = await dispositivo.receiver.receive(operacion(dispositivo, 1));
      expect(numeroDeFolio(buena)).toBe(1);
    });

    it('un cliente que el servidor no conoce se rechaza como carga inválida', async () => {
      const { h, dispositivo, operacion } = await entorno();
      const r = await dispositivo.receiver.receive(
        operacion(dispositivo, 1, { customerId: h.newUuid() }),
      );
      expect(!r.ok && r.code).toBe('INVALID_PAYLOAD');
    });

    it('una persona desactivada no rechaza: se aplica, con folio, y queda por revisar', async () => {
      const { h, dispositivo, operacion } = await entorno();
      const baja = await h.newUser(false);
      const r = await dispositivo.receiver.receive(operacion(dispositivo, 1, { userId: baja }));
      expect(r.ok && r.status).toBe('TO_REVIEW');
      expect(r.ok && r.reason).toBe('USER_INACTIVE');
      expect(folioDe(r)).toBeDefined();
    });

    it('un código público repetido no se aplica: queda por revisar y no consume folio', async () => {
      const { dispositivo, operacion } = await entorno();
      const codigo = (await entorno()).h.newPublicCode();
      const a = await dispositivo.receiver.receive(
        operacion(dispositivo, 1, { publicCode: codigo }),
      );
      const b = await dispositivo.receiver.receive(
        operacion(dispositivo, 2, { publicCode: codigo }),
      );
      expect(a.ok && a.status).toBe('APPLIED');
      expect(b.ok && b.status).toBe('TO_REVIEW');
      expect(b.ok && b.reason).toBe('PUBLIC_CODE_CONFLICT');
      const c = await dispositivo.receiver.receive(operacion(dispositivo, 3));
      expect(numeroDeFolio(c)).toBe(2);
    });

    it('dos dispositivos a la vez: 40 cotizaciones dan los folios 1..40 sin huecos ni repetidos', async () => {
      const h = await crear();
      const [d1, d2] = [await h.newDevice(), await h.newDevice()];
      const usuario = await h.newUser(true);
      const cliente = await h.newCustomer();
      const year = await h.newYear();
      const enviar = (d: DispositivoDelContrato) =>
        (async () => {
          const folios: number[] = [];
          for (let seq = 1; seq <= 20; seq += 1) {
            const r = await d.receiver.receive(
              issueQuoteOperation({
                opId: h.newUuid(),
                deviceId: d.id,
                seq,
                userId: usuario,
                customerId: cliente,
                year,
                newUuid: () => h.newUuid(),
                publicCode: h.newPublicCode(),
              }),
            );
            folios.push(numeroDeFolio(r));
          }
          return folios;
        })();
      const [a, b] = await Promise.all([enviar(d1), enviar(d2)]);
      const todos = [...a, ...b].sort((x, y) => x - y);
      expect(todos).toEqual(Array.from({ length: 40 }, (_v, i) => i + 1));
      expect(a).toEqual([...a].sort((x, y) => x - y));
      expect(b).toEqual([...b].sort((x, y) => x - y));
      expect(await h.countsFor([d1.id, d2.id])).toEqual({ quotes: 40, operations: 40 });
    });

    it('cada operación reenviada 2 o 3 veces y en desorden deja un solo registro por opId', async () => {
      const { h, dispositivo, operacion } = await entorno();
      const ops = Array.from({ length: 15 }, (_v, i) => operacion(dispositivo, i + 1));
      const envios = ops.flatMap((op, i) => Array.from({ length: 2 + (i % 2) }, () => op));
      for (const op of envios) {
        await dispositivo.receiver.receive(op);
      }
      expect(await h.countsFor([dispositivo.id])).toEqual({ quotes: 15, operations: 15 });
    });
  });
}
