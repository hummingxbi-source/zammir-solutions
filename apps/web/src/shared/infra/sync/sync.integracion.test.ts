import { issueQuoteOperation, type DispositivoDelContrato } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { OperationTransportError } from './function-operation-receiver';
import { harness, nuevoDispositivo } from './servidor-de-pruebas';

// S2-01 · Validación del motor de sincronización contra el servidor real [ADR-0012, ADR-0016].
// Cada prueba corresponde a un criterio de la historia; la compuerta del sprint exige que la
// concurrencia pase 10 veces seguidas (`pnpm test:concurrencia`).

type Dispositivo = DispositivoDelContrato;

/** Generador pseudoaleatorio con semilla: los cortes "al azar" se pueden repetir. */
function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function contexto() {
  const usuario = await harness.newUser(true);
  const cliente = await harness.newCustomer();
  const year = await harness.newYear();
  const operacion = (d: { id: string }, seq: number) =>
    issueQuoteOperation({
      opId: harness.newUuid(),
      deviceId: d.id,
      seq,
      userId: usuario,
      customerId: cliente,
      year,
      newUuid: () => harness.newUuid(),
      publicCode: harness.newPublicCode(),
    });
  return { operacion, year };
}

function numero(r: { ok: boolean; folio?: string }): number {
  return Number(r.folio?.split('-')[2]);
}

function contiguos(numeros: readonly number[]): boolean {
  const orden = [...numeros].sort((x, y) => x - y);
  return orden.every((n, i) => n === i + 1);
}

describe('S2-01 · motor de sincronización contra el servidor real', () => {
  it('200 operaciones de dos dispositivos al mismo tiempo dan los folios 1..200, sin huecos ni repetidos', async () => {
    const { operacion } = await contexto();
    const [d1, d2] = [await harness.newDevice(), await harness.newDevice()];
    const enviar = async (d: Dispositivo) => {
      const folios: number[] = [];
      for (let seq = 1; seq <= 100; seq += 1) {
        const r = await d.receiver.receive(operacion(d, seq));
        folios.push(r.ok ? numero(r) : -1);
      }
      return folios;
    };
    const [a, b] = await Promise.all([enviar(d1), enviar(d2)]);
    expect(contiguos([...a, ...b])).toBe(true);
    expect((await harness.countsFor([d1.id, d2.id])).quotes).toBe(200);
  }, 120_000);

  it('cortes de conexión al azar a mitad de cada operación: ni huecos, ni duplicados, ni documentos a medias', async () => {
    const { operacion } = await contexto();
    const sorteo = aleatorio(20261030);
    let cortesAntes = 0;
    let cortesDespues = 0;
    // El corte puede ocurrir antes de que el servidor reciba la petición o después de que la aplique
    // (la respuesta se pierde): el servidor no puede saber cuál fue, la tablet reenvía en ambos casos.
    const conCortes: typeof fetch = async (entrada, init) => {
      const suerte = sorteo();
      if (suerte < 0.25) {
        cortesAntes += 1;
        throw new TypeError('Failed to fetch');
      }
      const respuesta = await fetch(entrada, init);
      if (suerte < 0.5) {
        cortesDespues += 1;
        await respuesta.arrayBuffer();
        throw new TypeError('Failed to fetch');
      }
      return respuesta;
    };
    const [d1, d2] = [await nuevoDispositivo(conCortes), await nuevoDispositivo(conCortes)];

    const enviarConReintentos = async (d: Dispositivo) => {
      const folios: number[] = [];
      for (let seq = 1; seq <= 30; seq += 1) {
        const op = operacion(d, seq);
        for (let intento = 0; intento < 50; intento += 1) {
          try {
            const r = await d.receiver.receive(op);
            if (r.ok) {
              folios.push(numero(r));
              break;
            }
            throw new Error(`rechazo inesperado: ${r.code}`);
          } catch (error) {
            if (!(error instanceof OperationTransportError)) {
              throw error;
            }
          }
        }
      }
      return folios;
    };
    const [a, b] = await Promise.all([enviarConReintentos(d1), enviarConReintentos(d2)]);
    expect(cortesAntes).toBeGreaterThan(0);
    expect(cortesDespues).toBeGreaterThan(0);
    expect(a).toHaveLength(30);
    expect(b).toHaveLength(30);
    expect([...a, ...b].sort((x, y) => x - y)).toEqual(
      Array.from({ length: 60 }, (_v, i) => i + 1),
    );
    expect(await harness.countsFor([d1.id, d2.id])).toEqual({ quotes: 60, operations: 60 });
  }, 180_000);

  it('cada operación reenviada 2 o 3 veces, a la vez, deja un solo registro por opId', async () => {
    const { operacion } = await contexto();
    const d = await harness.newDevice();
    const ops = Array.from({ length: 30 }, (_v, i) => operacion(d, i + 1));
    // Cada operación sale 2 o 3 veces a la vez (como un reenvío que se cruza con el original); las
    // operaciones se mandan en su orden. El servidor local limita cuántas peticiones simultáneas
    // aguanta su entorno de ejecución, por eso las copias de UNA operación van juntas, no las 30.
    for (const [i, op] of ops.entries()) {
      const respuestas = await Promise.all(
        Array.from({ length: 2 + (i % 2) }, () => d.receiver.receive(op)),
      );
      expect(respuestas.every((r) => r.ok)).toBe(true);
      const folios = new Set(respuestas.map((r) => (r.ok ? r.folio : undefined)));
      expect(folios.size).toBe(1);
    }
    expect(await harness.countsFor([d.id])).toEqual({ quotes: 30, operations: 30 });
  }, 120_000);

  it('una tablet sin conexión por horas junta sus operaciones y al volver se ponen al día en orden', async () => {
    const { operacion } = await contexto();
    const d = await harness.newDevice();
    const acumuladas = Array.from({ length: 60 }, (_v, i) => operacion(d, i + 1));
    const folios: number[] = [];
    for (const op of acumuladas) {
      const r = await d.receiver.receive(op);
      folios.push(r.ok ? numero(r) : -1);
    }
    expect(folios).toEqual(Array.from({ length: 60 }, (_v, i) => i + 1));
    expect((await harness.countsFor([d.id])).operations).toBe(60);
  }, 120_000);

  it('una operación fuera de orden se detecta y se corrige reenviando desde la que el servidor espera', async () => {
    const { operacion } = await contexto();
    const d = await harness.newDevice();
    const ops = [1, 2, 3, 4, 5].map((seq) => operacion(d, seq));
    const [o1, o2, o3, o4, o5] = ops;
    if (
      o1 === undefined ||
      o2 === undefined ||
      o3 === undefined ||
      o4 === undefined ||
      o5 === undefined
    ) {
      throw new Error('operaciones de prueba');
    }
    const adelantada = await d.receiver.receive(o3);
    expect(adelantada).toEqual({ ok: false, code: 'OUT_OF_ORDER', expectedSeq: 1 });
    for (const op of [o1, o2, o3, o4, o5]) {
      const r = await d.receiver.receive(op);
      expect(r.ok).toBe(true);
    }
    expect((await harness.countsFor([d.id])).quotes).toBe(5);
  }, 60_000);

  it('la función del servidor corre packages/core: una carga que su validación no acepta se rechaza', async () => {
    const { operacion } = await contexto();
    const d = await harness.newDevice();
    const buena = operacion(d, 1);
    const op = { ...buena, payload: { ...(buena.payload as object), publicCode: 'abc' } };
    const r = await d.receiver.receive(op);
    expect(!r.ok && r.code).toBe('INVALID_PAYLOAD');
  }, 60_000);
});
