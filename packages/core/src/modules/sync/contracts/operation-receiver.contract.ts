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
  newUser(activa: boolean, administrador?: boolean): Promise<string>;
  newCustomer(): Promise<string>;
  /** Estado de un turno de caja en el servidor (lectura independiente); `undefined` si no existe. */
  shiftState(id: string): Promise<
    | {
        readonly status: string;
        readonly expectedCents: number | null;
        readonly differenceCents: number | null;
      }
    | undefined
  >;
  /** Estado de una venta de mostrador en el servidor y lo cobrado; `undefined` si no existe. */
  saleState(
    id: string,
  ): Promise<
    { readonly status: string; readonly paidCents: number; readonly folio: string } | undefined
  >;
  /** Estado de una orden en el servidor y lo pagado (lectura independiente); `undefined` si no existe. */
  orderState(
    id: string,
  ): Promise<
    { readonly status: string; readonly paidCents: number; readonly folio: string } | undefined
  >;
  /** Nombre con que quedó un cliente en el servidor (lectura independiente); `undefined` si no existe. */
  customerName(id: string): Promise<string | undefined>;
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
  /** Administrador que autorizó un descuento. */
  readonly authorizedBy?: string;
  /** La línea se cobra a la mitad ($58.00) en lugar del precio de catálogo ($116.00): un descuento. */
  readonly discounted?: boolean;
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
    subtotalCents: o.discounted === true ? 5_000 : 10_000,
    taxCents: o.discounted === true ? 800 : 1_600,
    totalCents: o.totalCents ?? (o.discounted === true ? 5_800 : 11_600),
    lines: [
      {
        id: o.newUuid(),
        name: 'Vidrio claro 6 mm',
        chargeUnit: 'SQUARE_METER',
        unitPriceCents: o.discounted === true ? 5_800 : 11_600,
        catalogPriceCents: 11_600,
        ruleId: 'AREA',
        widthMm: 1000,
        heightMm: 1000,
        quantity: 1,
        lineTotalCents: o.discounted === true ? 5_800 : 11_600,
        baseCents: o.discounted === true ? 5_000 : 10_000,
        taxCents: o.discounted === true ? 800 : 1_600,
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
    ...(o.authorizedBy === undefined ? {} : { authorizedBy: o.authorizedBy }),
    clientCreatedAt: issuedAt,
    payload,
  };
}

type IssuePayloadCrudo = Omit<IssueQuotePayload, 'privacyNoticeVersion' | 'catalogVersion'>;

/** Operación para aceptar o rechazar una cotización ya emitida. */
export function markQuoteOperation(o: {
  readonly opId: string;
  readonly deviceId: string;
  readonly seq: number;
  readonly userId: string;
  readonly quoteId: string;
  readonly accepted: boolean;
}): Record<string, unknown> {
  return {
    opId: o.opId,
    deviceId: o.deviceId,
    seq: o.seq,
    type: o.accepted ? 'MarkQuoteAccepted' : 'MarkQuoteRejected',
    schemaVersion: 1,
    userId: o.userId,
    clientCreatedAt: '2090-06-16T18:00:00.000Z',
    payload: { quoteId: o.quoteId },
  };
}

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

    it('un descuento con quien lo autorizó se aplica normalmente', async () => {
      const { h, dispositivo, operacion } = await entorno();
      const autoriza = await h.newUser(true);
      const r = await dispositivo.receiver.receive(
        operacion(dispositivo, 1, { discounted: true, authorizedBy: autoriza }),
      );
      expect(r.ok && r.status).toBe('APPLIED');
    });

    it('un descuento sin quien lo autorice no se rechaza: queda por revisar y conserva su folio', async () => {
      const { dispositivo, operacion } = await entorno();
      const r = await dispositivo.receiver.receive(operacion(dispositivo, 1, { discounted: true }));
      expect(r.ok && r.status).toBe('TO_REVIEW');
      expect(r.ok && r.reason).toBe('DISCOUNT_WITHOUT_AUTHORIZATION');
      expect(folioDe(r)).toBeDefined();
    });

    describe('aceptar y rechazar', () => {
      async function conCotizacionEmitida() {
        const e = await entorno();
        const emitida = await e.dispositivo.receiver.receive(e.operacion(e.dispositivo, 1));
        if (!emitida.ok || emitida.documentId === undefined) {
          throw new Error('no se emitió');
        }
        const marcar = (d: DispositivoDelContrato, seq: number, aceptar: boolean) =>
          d.receiver.receive(
            markQuoteOperation({
              opId: e.h.newUuid(),
              deviceId: d.id,
              seq,
              userId: e.usuario,
              quoteId: emitida.documentId ?? '',
              accepted: aceptar,
            }),
          );
        return { ...e, quoteId: emitida.documentId, folio: folioDe(emitida), marcar };
      }

      it('aceptar una cotización enviada se aplica y devuelve su folio', async () => {
        const { dispositivo, marcar, folio } = await conCotizacionEmitida();
        const r = await marcar(dispositivo, 2, true);
        expect(r.ok && r.status).toBe('APPLIED');
        expect(folioDe(r)).toBe(folio);
      });

      it('rechazarla también, y reenviar la operación no repite nada', async () => {
        const { h, dispositivo, usuario, quoteId } = await conCotizacionEmitida();
        const op = markQuoteOperation({
          opId: h.newUuid(),
          deviceId: dispositivo.id,
          seq: 2,
          userId: usuario,
          quoteId,
          accepted: false,
        });
        const a = await dispositivo.receiver.receive(op);
        const b = await dispositivo.receiver.receive(op);
        expect(a.ok && a.status).toBe('APPLIED');
        expect(b).toEqual(a);
      });

      it('si otra tablet ya la cambió, la segunda se aplica como por revisar y la cotización no cambia', async () => {
        const { h, dispositivo, usuario, quoteId } = await conCotizacionEmitida();
        const otra = await h.newDevice();
        const primera = await dispositivo.receiver.receive(
          markQuoteOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: 2,
            userId: usuario,
            quoteId,
            accepted: true,
          }),
        );
        const segunda = await otra.receiver.receive(
          markQuoteOperation({
            opId: h.newUuid(),
            deviceId: otra.id,
            seq: 1,
            userId: usuario,
            quoteId,
            accepted: false,
          }),
        );
        expect(primera.ok && primera.status).toBe('APPLIED');
        expect(segunda.ok && segunda.status).toBe('TO_REVIEW');
        expect(segunda.ok && segunda.reason).toBe('INVALID_TRANSITION');
      });

      it('una cotización que el servidor no conoce se rechaza como carga inválida', async () => {
        const { h, dispositivo, usuario } = await entorno();
        const r = await dispositivo.receiver.receive(
          markQuoteOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: 1,
            userId: usuario,
            quoteId: h.newUuid(),
            accepted: true,
          }),
        );
        expect(!r.ok && r.code).toBe('INVALID_PAYLOAD');
      });
    });

    describe('órdenes de trabajo y pagos', () => {
      async function conOrden(extra: { admin?: boolean } = {}) {
        const e = await entorno();
        const admin = extra.admin === true ? await e.h.newUser(true, true) : undefined;
        let seq = 0;
        const siguiente = () => {
          seq += 1;
          return seq;
        };
        const instante = `${String(e.year)}-06-16T18:00:00.000Z`;
        const crear = async (d: DispositivoDelContrato, opciones: { quoteId?: string } = {}) => {
          const id = e.h.newUuid();
          const r = await d.receiver.receive(
            createWorkOrderOperation({
              opId: e.h.newUuid(),
              deviceId: d.id,
              seq: siguiente(),
              userId: e.usuario,
              customerId: e.cliente,
              year: e.year,
              newUuid: () => e.h.newUuid(),
              publicCode: e.h.newPublicCode(),
              orderId: id,
              ...opciones,
            }),
          );
          return { id, r };
        };
        const enviar = (
          d: DispositivoDelContrato,
          tipo: string,
          payload: Record<string, unknown>,
          extra: Record<string, unknown> = {},
          op: string = e.h.newUuid(),
        ) =>
          d.receiver.receive({
            opId: op,
            deviceId: d.id,
            seq: siguiente(),
            type: tipo,
            schemaVersion: 1,
            userId: e.usuario,
            clientCreatedAt: instante,
            payload,
            ...extra,
          });
        const cobro = (orderId: string, centavos: number, kind = 'DEPOSIT') => ({
          groupId: e.h.newUuid(),
          target: { type: 'WORK_ORDER', id: orderId },
          kind,
          paidAt: instante,
          rows: [
            { id: e.h.newUuid(), method: 'TRANSFER', amountCents: centavos, reference: 'REF-1' },
          ],
        });
        const pagar = (
          d: DispositivoDelContrato,
          orderId: string,
          centavos: number,
          kind?: string,
        ) => enviar(d, 'RegisterPayment', cobro(orderId, centavos, kind));
        return { ...e, admin, crear, enviar, pagar, cobro, siguiente };
      }

      it('crea una orden sin cotización y le da su folio OT del año de emisión', async () => {
        const { dispositivo, crear, year, h } = await conOrden();
        const { id, r } = await crear(dispositivo);
        expect(r.ok && r.status).toBe('APPLIED');
        expect(r.ok && r.folio).toBe(`OT-${String(year)}-0001`);
        expect(await h.orderState(id)).toMatchObject({ status: 'WAITING', paidCents: 0 });
      });

      it('una cotización aceptada se convierte una sola vez; la segunda queda por revisar', async () => {
        const { h, dispositivo, usuario, cliente, year, siguiente, crear } = await conOrden();
        const emitida = issueQuoteOperation({
          opId: h.newUuid(),
          deviceId: dispositivo.id,
          seq: siguiente(),
          userId: usuario,
          customerId: cliente,
          year,
          newUuid: () => h.newUuid(),
          publicCode: h.newPublicCode(),
        });
        expect((await dispositivo.receiver.receive(emitida)).ok).toBe(true);
        const quoteId = (emitida.payload as { id: string }).id;
        await dispositivo.receiver.receive(
          markQuoteOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: siguiente(),
            userId: usuario,
            quoteId,
            accepted: true,
          }),
        );
        const primera = await crear(dispositivo, { quoteId });
        const segunda = await crear(dispositivo, { quoteId });
        expect(primera.r.ok && primera.r.status).toBe('APPLIED');
        expect(segunda.r.ok && segunda.r.status).toBe('TO_REVIEW');
        expect(segunda.r.ok && segunda.r.reason).toBe('QUOTE_ALREADY_CONVERTED');
      });

      it('convertir una cotización que no está aceptada se guarda pero queda por revisar', async () => {
        const { h, dispositivo, usuario, cliente, year, siguiente, crear } = await conOrden();
        const emitida = issueQuoteOperation({
          opId: h.newUuid(),
          deviceId: dispositivo.id,
          seq: siguiente(),
          userId: usuario,
          customerId: cliente,
          year,
          newUuid: () => h.newUuid(),
          publicCode: h.newPublicCode(),
        });
        await dispositivo.receiver.receive(emitida);
        const { r } = await crear(dispositivo, { quoteId: (emitida.payload as { id: string }).id });
        expect(r.ok && r.status).toBe('TO_REVIEW');
        expect(r.ok && r.reason).toBe('QUOTE_NOT_ACCEPTED');
      });

      it('reenviar un cobro no duplica el pago', async () => {
        const { h, dispositivo, crear, enviar, cobro } = await conOrden();
        const { id } = await crear(dispositivo);
        const payload = cobro(id, 5_800);
        const op = h.newUuid();
        // El mismo opId repetido: el servidor devuelve lo ya guardado, sin cobrar de nuevo.
        const a = await enviar(dispositivo, 'RegisterPayment', payload, {}, op);
        const b = await enviar(dispositivo, 'RegisterPayment', payload, {}, op);
        expect(a.ok && a.status).toBe('APPLIED');
        expect(b).toEqual(a);
        expect(await h.orderState(id)).toMatchObject({ paidCents: 5_800 });
      });

      it('un pago mayor al saldo se guarda y queda por revisar: el dinero recibido no se rechaza', async () => {
        const { h, dispositivo, crear, pagar } = await conOrden();
        const { id } = await crear(dispositivo);
        const r = await pagar(dispositivo, id, 20_000);
        expect(r.ok && r.status).toBe('TO_REVIEW');
        expect(r.ok && r.reason).toBe('PAYMENT_EXCEEDS_BALANCE');
        expect(await h.orderState(id)).toMatchObject({ paidCents: 20_000 });
      });

      it('un efectivo recibido menor a lo aplicado se rechaza sin guardar nada', async () => {
        const { h, dispositivo, crear, enviar } = await conOrden();
        const { id } = await crear(dispositivo);
        const r = await enviar(dispositivo, 'RegisterPayment', {
          groupId: h.newUuid(),
          target: { type: 'WORK_ORDER', id },
          kind: 'DEPOSIT',
          paidAt: '2090-06-16T18:00:00.000Z',
          rows: [{ id: h.newUuid(), method: 'CASH', amountCents: 5_000, cashReceivedCents: 4_000 }],
        });
        expect(r.ok).toBe(false);
        expect(await h.orderState(id)).toMatchObject({ paidCents: 0 });
      });

      it('avanzar: sin anticipo ni autorización queda por revisar; con anticipo se aplica', async () => {
        const { h, dispositivo, crear, enviar, pagar } = await conOrden();
        const sin = await crear(dispositivo);
        const r1 = await enviar(dispositivo, 'AdvanceWorkOrder', { id: sin.id, to: 'IN_PROCESS' });
        expect(r1.ok && r1.reason).toBe('STARTED_WITHOUT_DEPOSIT');
        const con = await crear(dispositivo);
        await pagar(dispositivo, con.id, 5_800);
        const r2 = await enviar(dispositivo, 'AdvanceWorkOrder', { id: con.id, to: 'IN_PROCESS' });
        expect(r2.ok && r2.status).toBe('APPLIED');
        const r3 = await enviar(dispositivo, 'AdvanceWorkOrder', { id: con.id, to: 'READY' });
        expect(r3.ok && r3.status).toBe('APPLIED');
        expect(await h.orderState(con.id)).toMatchObject({ status: 'READY' });
      });

      it('una transición que ya no es válida se aplica como por revisar y no cambia la orden', async () => {
        const { h, dispositivo, crear, enviar, pagar } = await conOrden();
        const { id } = await crear(dispositivo);
        await pagar(dispositivo, id, 5_800);
        await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'IN_PROCESS' });
        const repetida = await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'IN_PROCESS' });
        expect(repetida.ok && repetida.status).toBe('TO_REVIEW');
        expect(repetida.ok && repetida.reason).toBe('INVALID_TRANSITION');
        expect(await h.orderState(id)).toMatchObject({ status: 'IN_PROCESS' });
      });

      it('entregar con saldo sin administrador ni motivo queda por revisar; con ambos se aplica', async () => {
        const { h, dispositivo, crear, enviar, pagar, admin } = await conOrden({ admin: true });
        const listo = async () => {
          const { id } = await crear(dispositivo);
          await pagar(dispositivo, id, 5_800);
          await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'IN_PROCESS' });
          await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'READY' });
          return id;
        };
        const a = await listo();
        const sin = await enviar(dispositivo, 'DeliverWorkOrder', { id: a });
        expect(sin.ok && sin.reason).toBe('DELIVERED_WITH_BALANCE_WITHOUT_AUTHORIZATION');
        const b = await listo();
        const con = await enviar(
          dispositivo,
          'DeliverWorkOrder',
          { id: b, reason: 'El cliente liquida el viernes' },
          { authorizedBy: admin },
        );
        expect(con.ok && con.status).toBe('APPLIED');
        expect(await h.orderState(b)).toMatchObject({ status: 'DELIVERED' });
      });

      it('entregar con el saldo liquidado no necesita autorización', async () => {
        const { dispositivo, crear, enviar, pagar } = await conOrden();
        const { id } = await crear(dispositivo);
        await pagar(dispositivo, id, 5_800);
        await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'IN_PROCESS' });
        await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'READY' });
        await pagar(dispositivo, id, 5_800, 'BALANCE');
        const r = await enviar(dispositivo, 'DeliverWorkOrder', { id });
        expect(r.ok && r.status).toBe('APPLIED');
      });

      it('cancelar: un administrador la cancela; si no lo es, se aplica pero queda por revisar', async () => {
        const { h, dispositivo, crear, enviar, admin } = await conOrden({ admin: true });
        const a = await crear(dispositivo);
        const sin = await enviar(dispositivo, 'CancelWorkOrder', {
          id: a.id,
          reason: 'Se arrepintió',
        });
        expect(sin.ok && sin.reason).toBe('CANCEL_WITHOUT_AUTHORIZATION');
        const b = await crear(dispositivo);
        const con = await enviar(
          dispositivo,
          'CancelWorkOrder',
          { id: b.id, reason: 'Se arrepintió' },
          { authorizedBy: admin },
        );
        expect(con.ok && con.status).toBe('APPLIED');
        expect(await h.orderState(b.id)).toMatchObject({ status: 'CANCELLED' });
      });

      it('una orden cancelada no se cancela otra vez', async () => {
        const { dispositivo, crear, enviar, admin } = await conOrden({ admin: true });
        const { id } = await crear(dispositivo);
        await enviar(
          dispositivo,
          'CancelWorkOrder',
          { id, reason: 'Duplicada' },
          { authorizedBy: admin },
        );
        const otra = await enviar(
          dispositivo,
          'CancelWorkOrder',
          { id, reason: 'Otra vez' },
          { authorizedBy: admin },
        );
        expect(otra.ok && otra.reason).toBe('INVALID_TRANSITION');
      });

      it('editar datos de una orden que no existe se rechaza como carga inválida', async () => {
        const { h, dispositivo, enviar } = await conOrden();
        const r = await enviar(dispositivo, 'UpdateWorkOrder', {
          id: h.newUuid(),
          patch: { notes: 'x' },
        });
        expect(!r.ok && r.code).toBe('INVALID_PAYLOAD');
      });

      it('dos tablets editan campos distintos de la misma orden: ambas ediciones se aplican', async () => {
        const { h, dispositivo, crear, enviar, usuario } = await conOrden();
        const otra = await h.newDevice();
        const { id } = await crear(dispositivo);
        const a = await enviar(dispositivo, 'UpdateWorkOrder', { id, patch: { notes: 'Nota A' } });
        const b = await otra.receiver.receive({
          opId: h.newUuid(),
          deviceId: otra.id,
          seq: 1,
          type: 'UpdateWorkOrder',
          schemaVersion: 1,
          userId: usuario,
          clientCreatedAt: '2090-06-16T18:00:00.000Z',
          payload: { id, patch: { estimatedDeliveryDate: '2090-07-01' } },
        });
        expect(a.ok && a.status).toBe('APPLIED');
        expect(b.ok && b.status).toBe('APPLIED');
      });
    });

    describe('ventas de mostrador', () => {
      async function conVentas(extra: { admin?: boolean } = {}) {
        const e = await entorno();
        const admin = extra.admin === true ? await e.h.newUser(true, true) : undefined;
        let seq = 0;
        const venta = async (
          d: DispositivoDelContrato,
          opciones: Partial<Parameters<typeof createCounterSaleOperation>[0]> = {},
        ) => {
          const id = e.h.newUuid();
          seq += 1;
          const r = await d.receiver.receive(
            createCounterSaleOperation({
              opId: e.h.newUuid(),
              deviceId: d.id,
              seq,
              userId: e.usuario,
              year: e.year,
              newUuid: () => e.h.newUuid(),
              publicCode: e.h.newPublicCode(),
              saleId: id,
              ...opciones,
            }),
          );
          return { id, r };
        };
        const cancelar = (
          d: DispositivoDelContrato,
          id: string,
          extra2: Record<string, unknown> = {},
        ) => {
          seq += 1;
          return d.receiver.receive({
            opId: e.h.newUuid(),
            deviceId: d.id,
            seq,
            type: 'CancelCounterSale',
            schemaVersion: 1,
            userId: e.usuario,
            clientCreatedAt: `${String(e.year)}-06-16T18:00:00.000Z`,
            payload: { id, reason: 'Error de captura' },
            ...extra2,
          });
        };
        return { ...e, admin, venta, cancelar };
      }

      it('registra la venta con su cobro y le da su folio V del año de emisión', async () => {
        const { h, dispositivo, venta, year } = await conVentas();
        const { id, r } = await venta(dispositivo);
        expect(r.ok && r.status).toBe('APPLIED');
        expect(r.ok && r.folio).toBe(`V-${String(year)}-0001`);
        expect(await h.saleState(id)).toMatchObject({ status: 'COMPLETED', paidCents: 11_600 });
      });

      it('un cobro mixto (efectivo + transferencia) que suma el total se aplica', async () => {
        const { h, dispositivo, venta } = await conVentas();
        const { id, r } = await venta(dispositivo, { mixto: true });
        expect(r.ok && r.status).toBe('APPLIED');
        expect(await h.saleState(id)).toMatchObject({ paidCents: 11_600 });
      });

      it('un cobro que no suma el total se guarda y queda por revisar: el dinero no se rechaza', async () => {
        const { h, dispositivo, venta } = await conVentas();
        const { id, r } = await venta(dispositivo, { cobradoCents: 10_000 });
        expect(r.ok && r.status).toBe('TO_REVIEW');
        expect(r.ok && r.reason).toBe('PAYMENT_NOT_EQUAL_TOTAL');
        expect(await h.saleState(id)).toMatchObject({ paidCents: 10_000 });
      });

      it('se puede vender sin cliente, pero un cliente que el servidor no conoce se rechaza', async () => {
        const { h, dispositivo, venta, cliente } = await conVentas();
        expect((await venta(dispositivo, { customerId: cliente })).r.ok).toBe(true);
        const falso = await venta(dispositivo, { customerId: h.newUuid() });
        expect(!falso.r.ok && falso.r.code).toBe('INVALID_PAYLOAD');
      });

      it('reenviar la venta no la duplica ni repite el cobro', async () => {
        const { h, dispositivo, year } = await conVentas();
        const id = h.newUuid();
        const op = createCounterSaleOperation({
          opId: h.newUuid(),
          deviceId: dispositivo.id,
          seq: 1,
          userId: (await entorno()).usuario,
          year,
          newUuid: () => h.newUuid(),
          publicCode: h.newPublicCode(),
          saleId: id,
        });
        const a = await dispositivo.receiver.receive(op);
        const b = await dispositivo.receiver.receive(op);
        expect(b).toEqual(a);
        expect(await h.saleState(id)).toMatchObject({ paidCents: 11_600 });
      });

      it('cancelar: un administrador la cancela; si no lo es, se aplica pero queda por revisar', async () => {
        const { h, dispositivo, venta, cancelar, admin } = await conVentas({ admin: true });
        const a = await venta(dispositivo);
        const sin = await cancelar(dispositivo, a.id);
        expect(sin.ok && sin.reason).toBe('CANCEL_WITHOUT_AUTHORIZATION');
        const b = await venta(dispositivo);
        const con = await cancelar(dispositivo, b.id, { authorizedBy: admin });
        expect(con.ok && con.status).toBe('APPLIED');
        expect(await h.saleState(b.id)).toMatchObject({ status: 'CANCELLED' });
        // Nada se borra: el cobro sigue registrado.
        expect(await h.saleState(b.id)).toMatchObject({ paidCents: 11_600 });
      });

      it('una venta ya cancelada no se cancela otra vez, y una que no existe se rechaza', async () => {
        const { h, dispositivo, venta, cancelar, admin } = await conVentas({ admin: true });
        const { id } = await venta(dispositivo);
        await cancelar(dispositivo, id, { authorizedBy: admin });
        const otra = await cancelar(dispositivo, id, { authorizedBy: admin });
        expect(otra.ok && otra.reason).toBe('INVALID_TRANSITION');
        const falsa = await cancelar(dispositivo, h.newUuid(), { authorizedBy: admin });
        expect(!falsa.ok && falsa.code).toBe('INVALID_PAYLOAD');
      });

      it('un efectivo recibido menor a lo aplicado se rechaza sin guardar la venta', async () => {
        const { h, dispositivo, venta } = await conVentas();
        const { id, r } = await venta(dispositivo, { efectivoInsuficiente: true });
        expect(r.ok).toBe(false);
        expect(await h.saleState(id)).toBeUndefined();
      });
    });

    describe('órdenes y ventas · reglas finas', () => {
      async function base() {
        const e = await entorno();
        let seq = 0;
        const instante = `${String(e.year)}-06-16T18:00:00.000Z`;
        const enviar = async (
          d: DispositivoDelContrato,
          tipo: string,
          payload: Record<string, unknown>,
          extra: Record<string, unknown> = {},
        ) => {
          const candidato = seq + 1;
          const r = await d.receiver.receive({
            opId: e.h.newUuid(),
            deviceId: d.id,
            seq: candidato,
            type: tipo,
            schemaVersion: 1,
            userId: e.usuario,
            clientCreatedAt: instante,
            payload,
            ...extra,
          });
          if (r.ok) {
            seq = candidato;
          }
          return r;
        };
        const orden = async (d: DispositivoDelContrato, extra: Record<string, unknown> = {}) => {
          const id = e.h.newUuid();
          const candidato = seq + 1;
          const op = createWorkOrderOperation({
            opId: e.h.newUuid(),
            deviceId: d.id,
            seq: candidato,
            userId: e.usuario,
            customerId: e.cliente,
            year: e.year,
            newUuid: () => e.h.newUuid(),
            publicCode: e.h.newPublicCode(),
            orderId: id,
          }) as { payload: Record<string, unknown> };
          const r = await d.receiver.receive({ ...op, payload: { ...op.payload, ...extra } });
          if (r.ok) {
            seq = candidato;
          }
          return { id, r };
        };
        const cobro = (id: string, centavos: number, target = 'WORK_ORDER') => ({
          groupId: e.h.newUuid(),
          target: { type: target, id },
          kind: 'DEPOSIT',
          paidAt: instante,
          rows: [{ id: e.h.newUuid(), method: 'TRANSFER', amountCents: centavos }],
        });
        return { ...e, enviar, orden, cobro };
      }

      it('un código público repetido en otra orden no se aplica: queda por revisar', async () => {
        const { h, dispositivo, orden } = await base();
        const repetido = h.newPublicCode();
        const a = await orden(dispositivo, { publicCode: repetido });
        expect(a.r.ok && a.r.status).toBe('APPLIED');
        const b = await orden(dispositivo, { publicCode: repetido });
        expect(b.r.ok && b.r.status).toBe('TO_REVIEW');
        expect(b.r.ok && b.r.reason).toBe('PUBLIC_CODE_CONFLICT');
        expect(await h.orderState(b.id)).toBeUndefined();
      });

      it('una orden de un cliente que el servidor no conoce, o de una cotización que no conoce, se rechaza', async () => {
        const { h, dispositivo, orden } = await base();
        const sinCliente = await orden(dispositivo, { customerId: h.newUuid() });
        expect(!sinCliente.r.ok && sinCliente.r.code).toBe('INVALID_PAYLOAD');
        const sinCotizacion = await orden(dispositivo, { quoteId: h.newUuid() });
        expect(!sinCotizacion.r.ok && sinCotizacion.r.code).toBe('INVALID_PAYLOAD');
        expect(await h.orderState(sinCliente.id)).toBeUndefined();
        expect(await h.orderState(sinCotizacion.id)).toBeUndefined();
      });

      it('una orden que no existe no avanza, no se entrega, no se cancela ni se cobra', async () => {
        const { h, dispositivo, enviar, cobro } = await base();
        const fantasma = h.newUuid();
        const respuestas = [
          await enviar(dispositivo, 'AdvanceWorkOrder', { id: fantasma, to: 'READY' }),
          await enviar(dispositivo, 'DeliverWorkOrder', { id: fantasma }),
          await enviar(dispositivo, 'CancelWorkOrder', { id: fantasma, reason: 'x' }),
          await enviar(dispositivo, 'RegisterPayment', cobro(fantasma, 100)),
        ];
        for (const r of respuestas) {
          expect(!r.ok && r.code).toBe('INVALID_PAYLOAD');
        }
      });

      it('una transición inválida dice qué orden era y su folio', async () => {
        const { dispositivo, orden, enviar } = await base();
        const { id } = await orden(dispositivo);
        const saltada = await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'READY' });
        expect(saltada.ok && saltada.reason).toBe('INVALID_TRANSITION');
        expect(saltada.ok && saltada.documentId).toBe(id);
        expect(saltada.ok && saltada.folio).toMatch(/^OT-\d{4}-\d{4,}$/);
        const entregada = await enviar(dispositivo, 'DeliverWorkOrder', { id });
        expect(entregada.ok && entregada.reason).toBe('INVALID_TRANSITION');
        expect(entregada.ok && entregada.folio).toMatch(/^OT-/);
      });

      it('cobrar justo el saldo se aplica; un centavo de más queda por revisar', async () => {
        const { h, dispositivo, orden, enviar, cobro } = await base();
        const exacto = await orden(dispositivo);
        const r1 = await enviar(dispositivo, 'RegisterPayment', cobro(exacto.id, 11_600));
        expect(r1.ok && r1.status).toBe('APPLIED');
        const demas = await orden(dispositivo);
        const r2 = await enviar(dispositivo, 'RegisterPayment', cobro(demas.id, 11_601));
        expect(r2.ok && r2.reason).toBe('PAYMENT_EXCEEDS_BALANCE');
        expect(await h.orderState(demas.id)).toMatchObject({ paidCents: 11_601 });
      });

      it('a una orden cancelada se le puede cobrar lo que ya se recibió, pero queda por revisar', async () => {
        const { h, dispositivo, orden, enviar, cobro, admin } = await conAdmin();
        const { id } = await orden(dispositivo);
        await enviar(dispositivo, 'CancelWorkOrder', { id, reason: 'x' }, { authorizedBy: admin });
        const r = await enviar(dispositivo, 'RegisterPayment', cobro(id, 100));
        expect(r.ok && r.reason).toBe('ORDER_CANCELLED');
        expect(await h.orderState(id)).toMatchObject({ status: 'CANCELLED', paidCents: 100 });
      });

      it('las ventas de mostrador todavía no se cobran como cobro de orden', async () => {
        const { h, dispositivo, enviar, cobro } = await base();
        const r = await enviar(
          dispositivo,
          'RegisterPayment',
          cobro(h.newUuid(), 100, 'COUNTER_SALE'),
        );
        expect(!r.ok && r.code).toBe('INVALID_PAYLOAD');
      });

      it('entregar con saldo y administrador pero sin motivo, o con motivo en blanco, queda por revisar', async () => {
        const { dispositivo, orden, enviar, cobro, admin } = await conAdmin();
        const lista = async () => {
          const { id } = await orden(dispositivo);
          await enviar(dispositivo, 'RegisterPayment', cobro(id, 5_800));
          await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'IN_PROCESS' });
          await enviar(dispositivo, 'AdvanceWorkOrder', { id, to: 'READY' });
          return id;
        };
        const a = await lista();
        const sinMotivo = await enviar(
          dispositivo,
          'DeliverWorkOrder',
          { id: a },
          { authorizedBy: admin },
        );
        expect(sinMotivo.ok && sinMotivo.reason).toBe(
          'DELIVERED_WITH_BALANCE_WITHOUT_AUTHORIZATION',
        );
        const b = await lista();
        const enBlanco = await enviar(
          dispositivo,
          'DeliverWorkOrder',
          { id: b, reason: '   ' },
          { authorizedBy: admin },
        );
        expect(enBlanco.ok && enBlanco.reason).toBe('DELIVERED_WITH_BALANCE_WITHOUT_AUTHORIZATION');
      });

      it('empezar sin anticipo pero con la autorización de un administrador se aplica', async () => {
        const { dispositivo, orden, enviar, admin } = await conAdmin();
        const { id } = await orden(dispositivo);
        const r = await enviar(
          dispositivo,
          'AdvanceWorkOrder',
          { id, to: 'IN_PROCESS' },
          { authorizedBy: admin },
        );
        expect(r.ok && r.status).toBe('APPLIED');
      });

      it('una venta con el mismo código público que otra no se aplica: queda por revisar', async () => {
        const { h, dispositivo, usuario, year } = await base();
        const repetido = h.newPublicCode();
        let seq = 0;
        const vender = () => {
          seq += 1;
          return dispositivo.receiver.receive(
            createCounterSaleOperation({
              opId: h.newUuid(),
              deviceId: dispositivo.id,
              seq,
              userId: usuario,
              year,
              newUuid: () => h.newUuid(),
              publicCode: repetido,
              saleId: h.newUuid(),
            }),
          );
        };
        expect((await vender()).ok).toBe(true);
        const segunda = await vender();
        expect(segunda.ok && segunda.reason).toBe('PUBLIC_CODE_CONFLICT');
      });

      async function conAdmin() {
        const b = await base();
        const admin = await b.h.newUser(true, true);
        return { ...b, admin };
      }
    });

    describe('turnos de caja', () => {
      async function conTurnos() {
        const e = await entorno();
        const admin = await e.h.newUser(true, true);
        let seq = 0;
        const instante = `${String(e.year)}-06-16T18:00:00.000Z`;
        const enviar = async (
          d: DispositivoDelContrato,
          tipo: string,
          payload: Record<string, unknown>,
          extra: Record<string, unknown> = {},
          userId: string = e.usuario,
        ) => {
          const candidato = seq + 1;
          const r = await d.receiver.receive({
            opId: e.h.newUuid(),
            deviceId: d.id,
            seq: candidato,
            type: tipo,
            schemaVersion: 1,
            userId,
            clientCreatedAt: instante,
            payload,
            ...extra,
          });
          if (r.ok) {
            seq = candidato;
          }
          return r;
        };
        const abrir = async (d: DispositivoDelContrato, fondo = 0, userId: string = e.usuario) => {
          const id = e.h.newUuid();
          const r = await enviar(
            d,
            'OpenCashShift',
            { id, openedAt: instante, openingFloatCents: fondo },
            {},
            userId,
          );
          return { id, r };
        };
        const cerrar = (
          d: DispositivoDelContrato,
          id: string,
          contado: number,
          esperado: number,
          extra: Record<string, unknown> = {},
        ) =>
          enviar(d, 'CloseCashShift', {
            id,
            closedAt: instante,
            countedCashCents: contado,
            expectedCashCents: esperado,
            ...extra,
          });
        const orden = async (d: DispositivoDelContrato) => {
          const id = e.h.newUuid();
          const candidato = seq + 1;
          const r = await d.receiver.receive(
            createWorkOrderOperation({
              opId: e.h.newUuid(),
              deviceId: d.id,
              seq: candidato,
              userId: e.usuario,
              customerId: e.cliente,
              year: e.year,
              newUuid: () => e.h.newUuid(),
              publicCode: e.h.newPublicCode(),
              orderId: id,
            }),
          );
          if (r.ok) {
            seq = candidato;
          }
          return id;
        };
        const cobrarEfectivo = (
          d: DispositivoDelContrato,
          orderId: string,
          aplicado: number,
          turno: string | null,
        ) =>
          enviar(d, 'RegisterPayment', {
            groupId: e.h.newUuid(),
            target: { type: 'WORK_ORDER', id: orderId },
            kind: 'DEPOSIT',
            paidAt: instante,
            ...(turno === null ? {} : { cashShiftId: turno }),
            rows: [
              {
                id: e.h.newUuid(),
                method: 'CASH',
                amountCents: aplicado,
                cashReceivedCents: aplicado + 100,
              },
            ],
          });
        const vender = async (d: DispositivoDelContrato, turno: string | null) => {
          const id = e.h.newUuid();
          const candidato = seq + 1;
          const op = createCounterSaleOperation({
            opId: e.h.newUuid(),
            deviceId: d.id,
            seq: candidato,
            userId: e.usuario,
            year: e.year,
            newUuid: () => e.h.newUuid(),
            publicCode: e.h.newPublicCode(),
            saleId: id,
          }) as { payload: Record<string, unknown> };
          const r = await d.receiver.receive({
            ...op,
            payload: { ...op.payload, ...(turno === null ? {} : { cashShiftId: turno }) },
          });
          if (r.ok) {
            seq = candidato;
          }
          return { id, r };
        };
        return { ...e, admin, enviar, abrir, cerrar, orden, cobrarEfectivo, vender };
      }

      it('abrir un turno lo deja abierto con su fondo; un segundo turno de la misma persona queda por revisar', async () => {
        const { h, dispositivo, abrir } = await conTurnos();
        const a = await abrir(dispositivo, 50_000);
        expect(a.r.ok && a.r.status).toBe('APPLIED');
        expect(await h.shiftState(a.id)).toMatchObject({ status: 'OPEN' });
        const b = await abrir(dispositivo);
        expect(b.r.ok && b.r.status).toBe('TO_REVIEW');
        expect(b.r.ok && b.r.reason).toBe('SHIFT_ALREADY_OPEN');
      });

      it('el efectivo esperado es el fondo más lo cobrado en efectivo, de órdenes y de ventas', async () => {
        const { h, dispositivo, abrir, cerrar, orden, cobrarEfectivo, vender } = await conTurnos();
        const { id: turno } = await abrir(dispositivo, 10_000);
        const o = await orden(dispositivo);
        await cobrarEfectivo(dispositivo, o, 5_800, turno);
        await vender(dispositivo, turno);
        // 10 000 de fondo + 5 800 del anticipo + 11 600 de la venta (todo en efectivo).
        const r = await cerrar(dispositivo, turno, 27_400, 27_400);
        expect(r.ok && r.status).toBe('APPLIED');
        expect(await h.shiftState(turno)).toMatchObject({
          status: 'CLOSED',
          expectedCents: 27_400,
          differenceCents: 0,
        });
      });

      it('la diferencia es contado − esperado: sobrante positivo, faltante negativo', async () => {
        const { h, dispositivo, abrir, cerrar, orden, cobrarEfectivo } = await conTurnos();
        const a = await abrir(dispositivo, 0);
        await cobrarEfectivo(dispositivo, await orden(dispositivo), 5_800, a.id);
        const r = await cerrar(dispositivo, a.id, 5_900, 5_800);
        expect(r.ok && r.status).toBe('APPLIED');
        expect(await h.shiftState(a.id)).toMatchObject({ differenceCents: 100 });
      });

      it('si lo que esperaba la tablet no coincide con el recálculo del servidor, queda por revisar', async () => {
        const { h, dispositivo, abrir, cerrar, orden, cobrarEfectivo } = await conTurnos();
        const a = await abrir(dispositivo, 0);
        await cobrarEfectivo(dispositivo, await orden(dispositivo), 5_800, a.id);
        const r = await cerrar(dispositivo, a.id, 9_999, 9_999);
        expect(r.ok && r.status).toBe('TO_REVIEW');
        expect(r.ok && r.reason).toBe('CASH_SUMMARY_MISMATCH');
        expect(await h.shiftState(a.id)).toMatchObject({ status: 'CLOSED', expectedCents: 5_800 });
      });

      it('una venta cancelada sale del cobro del turno', async () => {
        const { h, dispositivo, abrir, cerrar, vender, enviar, admin } = await conTurnos();
        const a = await abrir(dispositivo, 1_000);
        const venta = await vender(dispositivo, a.id);
        await enviar(
          dispositivo,
          'CancelCounterSale',
          { id: venta.id, reason: 'Error' },
          { authorizedBy: admin },
        );
        const r = await cerrar(dispositivo, a.id, 1_000, 1_000);
        expect(r.ok && r.status).toBe('APPLIED');
        expect(await h.shiftState(a.id)).toMatchObject({
          expectedCents: 1_000,
          differenceCents: 0,
        });
      });

      it('un corte cerrado no se cierra de nuevo y uno que no existe se rechaza', async () => {
        const { h, dispositivo, abrir, cerrar } = await conTurnos();
        const a = await abrir(dispositivo, 0);
        await cerrar(dispositivo, a.id, 0, 0);
        const otra = await cerrar(dispositivo, a.id, 0, 0);
        expect(otra.ok && otra.reason).toBe('INVALID_TRANSITION');
        const falso = await cerrar(dispositivo, h.newUuid(), 0, 0);
        expect(!falso.ok && falso.code).toBe('INVALID_PAYLOAD');
      });

      it('un cobro a un turno cerrado se guarda y queda por revisar; a uno que no existe se rechaza', async () => {
        const { h, dispositivo, abrir, cerrar, orden, cobrarEfectivo, vender } = await conTurnos();
        const a = await abrir(dispositivo, 0);
        await cerrar(dispositivo, a.id, 0, 0);
        const o = await orden(dispositivo);
        const tarde = await cobrarEfectivo(dispositivo, o, 1_000, a.id);
        expect(tarde.ok && tarde.reason).toBe('SHIFT_CLOSED');
        expect(await h.orderState(o)).toMatchObject({ paidCents: 1_000 });
        const venta = await vender(dispositivo, a.id);
        expect(venta.r.ok && venta.r.reason).toBe('SHIFT_CLOSED');
        const fantasma = await cobrarEfectivo(dispositivo, o, 1_000, h.newUuid());
        expect(!fantasma.ok && fantasma.code).toBe('INVALID_PAYLOAD');
        const ventaFantasma = await vender(dispositivo, h.newUuid());
        expect(!ventaFantasma.r.ok && ventaFantasma.r.code).toBe('INVALID_PAYLOAD');
      });

      it('reabrir: un administrador lo reabre; si no lo es, se aplica pero queda por revisar', async () => {
        const { h, dispositivo, abrir, cerrar, enviar, admin } = await conTurnos();
        const a = await abrir(dispositivo, 0);
        await cerrar(dispositivo, a.id, 0, 0);
        const sin = await enviar(dispositivo, 'ReopenCashShift', {
          id: a.id,
          reason: 'Falta un cobro',
        });
        expect(sin.ok && sin.reason).toBe('REOPEN_WITHOUT_AUTHORIZATION');
        await cerrar(dispositivo, a.id, 0, 0);
        const con = await enviar(
          dispositivo,
          'ReopenCashShift',
          { id: a.id, reason: 'Falta un cobro' },
          { authorizedBy: admin },
        );
        expect(con.ok && con.status).toBe('APPLIED');
        expect(await h.shiftState(a.id)).toMatchObject({ status: 'OPEN' });
        const abierto = await enviar(
          dispositivo,
          'ReopenCashShift',
          { id: a.id, reason: 'Otra vez' },
          { authorizedBy: admin },
        );
        expect(abierto.ok && abierto.reason).toBe('INVALID_TRANSITION');
        const falso = await enviar(
          dispositivo,
          'ReopenCashShift',
          { id: h.newUuid(), reason: 'x' },
          { authorizedBy: admin },
        );
        expect(!falso.ok && falso.code).toBe('INVALID_PAYLOAD');
      });
    });

    describe('clientes (UpsertCustomer)', () => {
      it('un cliente capturado sin conexión se aplica y luego se le puede cotizar', async () => {
        const { h, dispositivo, usuario, year } = await entorno();
        const clienteNuevo = h.newUuid();
        const alta = await dispositivo.receiver.receive(
          upsertCustomerOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: 1,
            userId: usuario,
            customerId: clienteNuevo,
            name: 'Obra capturada en la tablet',
          }),
        );
        expect(alta.ok && alta.status).toBe('APPLIED');
        const cotizacion = await dispositivo.receiver.receive(
          issueQuoteOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: 2,
            userId: usuario,
            customerId: clienteNuevo,
            year,
            newUuid: () => h.newUuid(),
            publicCode: h.newPublicCode(),
          }),
        );
        expect(cotizacion.ok && cotizacion.status).toBe('APPLIED');
      });

      it('reenviar el alta no la duplica y corregirla deja el último valor que llega', async () => {
        const { h, dispositivo, usuario } = await entorno();
        const id = h.newUuid();
        const alta = upsertCustomerOperation({
          opId: h.newUuid(),
          deviceId: dispositivo.id,
          seq: 1,
          userId: usuario,
          customerId: id,
          name: 'Primer nombre',
        });
        const primero = await dispositivo.receiver.receive(alta);
        expect(await dispositivo.receiver.receive(alta)).toEqual(primero);
        const correccion = await dispositivo.receiver.receive(
          upsertCustomerOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: 2,
            userId: usuario,
            customerId: id,
            name: 'Nombre corregido',
          }),
        );
        expect(correccion.ok && correccion.status).toBe('APPLIED');
        expect(await h.customerName(id)).toBe('Nombre corregido');
      });

      it('dos tablets corrigen al mismo cliente: gana la que llega al final', async () => {
        const { h, dispositivo, usuario } = await entorno();
        const otra = await h.newDevice();
        const id = h.newUuid();
        await dispositivo.receiver.receive(
          upsertCustomerOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: 1,
            userId: usuario,
            customerId: id,
            name: 'Nombre A',
          }),
        );
        await otra.receiver.receive(
          upsertCustomerOperation({
            opId: h.newUuid(),
            deviceId: otra.id,
            seq: 1,
            userId: usuario,
            customerId: id,
            name: 'Nombre B',
          }),
        );
        expect(await h.customerName(id)).toBe('Nombre B');
      });

      it('un teléfono que no son 10 dígitos se rechaza sin guardar nada', async () => {
        const { h, dispositivo, usuario } = await entorno();
        const r = await dispositivo.receiver.receive(
          upsertCustomerOperation({
            opId: h.newUuid(),
            deviceId: dispositivo.id,
            seq: 1,
            userId: usuario,
            customerId: h.newUuid(),
            name: 'Sin teléfono',
            phone: '55-12',
          }),
        );
        expect(r.ok).toBe(false);
        expect(await h.countsFor([dispositivo.id])).toEqual({ quotes: 0, operations: 0 });
      });
    });
  });
}

/** Operación para dar de alta o corregir a un cliente desde la tablet. */
export function upsertCustomerOperation(o: {
  readonly opId: string;
  readonly deviceId: string;
  readonly seq: number;
  readonly userId: string;
  readonly customerId: string;
  readonly name: string;
  readonly phone?: string;
}): Record<string, unknown> {
  return {
    opId: o.opId,
    deviceId: o.deviceId,
    seq: o.seq,
    type: 'UpsertCustomer',
    schemaVersion: 1,
    userId: o.userId,
    clientCreatedAt: '2090-06-16T18:00:00.000Z',
    payload: {
      id: o.customerId,
      name: o.name,
      phone: o.phone ?? '5512345678',
      email: null,
      notes: null,
      privacyNoticeVersion: 1,
    },
  };
}

/** Una operación CreateWorkOrder completa y consistente (una línea de 1 m² a $116.00 con IVA incluido y
 *  anticipo exigido de $58.00). */
export function createWorkOrderOperation(o: {
  readonly opId: string;
  readonly deviceId: string;
  readonly seq: number;
  readonly userId: string;
  readonly customerId: string;
  readonly year: number;
  readonly newUuid: () => string;
  readonly publicCode: string;
  readonly orderId: string;
  readonly quoteId?: string;
}): Record<string, unknown> {
  const issuedAt = `${String(o.year)}-06-15T18:00:00.000Z`;
  return {
    opId: o.opId,
    deviceId: o.deviceId,
    seq: o.seq,
    type: 'CreateWorkOrder',
    schemaVersion: 1,
    userId: o.userId,
    clientCreatedAt: issuedAt,
    payload: {
      id: o.orderId,
      tempFolio: `T1-${String(o.seq).padStart(4, '0')}`,
      publicCode: o.publicCode,
      customerId: o.customerId,
      ...(o.quoteId === undefined ? {} : { quoteId: o.quoteId }),
      issuedAt,
      depositPercentBps: 5_000,
      depositRequiredCents: 5_800,
      subtotalCents: 10_000,
      taxCents: 1_600,
      totalCents: 11_600,
      lines: [
        {
          id: o.newUuid(),
          name: 'Vidrio claro 6 mm',
          chargeUnit: 'SQUARE_METER',
          unitPriceCents: 11_600,
          catalogPriceCents: 11_600,
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
    },
  };
}

/** Una operación CreateCounterSale consistente: una línea de 1 m² a $116.00 con IVA incluido, cobrada
 *  completa (o como se pida para probar los casos que no cuadran). */
export function createCounterSaleOperation(o: {
  readonly opId: string;
  readonly deviceId: string;
  readonly seq: number;
  readonly userId: string;
  readonly year: number;
  readonly newUuid: () => string;
  readonly publicCode: string;
  readonly saleId: string;
  readonly customerId?: string;
  /** Cobra dos formas de pago que suman el total. */
  readonly mixto?: boolean;
  /** Cuánto se cobró en total (por omisión, el total de la venta). */
  readonly cobradoCents?: number;
  /** Efectivo recibido menor a lo aplicado (carga inválida). */
  readonly efectivoInsuficiente?: boolean;
}): Record<string, unknown> {
  const issuedAt = `${String(o.year)}-06-15T18:00:00.000Z`;
  const cobrado = o.cobradoCents ?? 11_600;
  const filas =
    o.efectivoInsuficiente === true
      ? [{ id: o.newUuid(), method: 'CASH', amountCents: cobrado, cashReceivedCents: cobrado - 1 }]
      : o.mixto === true
        ? [
            { id: o.newUuid(), method: 'CASH', amountCents: 5_000, cashReceivedCents: 6_000 },
            { id: o.newUuid(), method: 'TRANSFER', amountCents: cobrado - 5_000, reference: 'REF' },
          ]
        : [
            {
              id: o.newUuid(),
              method: 'CASH',
              amountCents: cobrado,
              cashReceivedCents: cobrado + 400,
            },
          ];
  return {
    opId: o.opId,
    deviceId: o.deviceId,
    seq: o.seq,
    type: 'CreateCounterSale',
    schemaVersion: 1,
    userId: o.userId,
    clientCreatedAt: issuedAt,
    payload: {
      id: o.saleId,
      tempFolio: `T1-${String(o.seq).padStart(4, '0')}`,
      publicCode: o.publicCode,
      ...(o.customerId === undefined ? {} : { customerId: o.customerId }),
      issuedAt,
      subtotalCents: 10_000,
      taxCents: 1_600,
      totalCents: 11_600,
      lines: [
        {
          id: o.newUuid(),
          name: 'Vidrio claro 6 mm',
          chargeUnit: 'SQUARE_METER',
          unitPriceCents: 11_600,
          catalogPriceCents: 11_600,
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
      payment: { groupId: o.newUuid(), rows: filas },
    },
  };
}
