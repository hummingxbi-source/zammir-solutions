import { folioAllocatorContract } from '@zammir/core/testing';
import { Pool } from 'pg';
import { afterAll, beforeAll } from 'vitest';

import { pgFolioAllocator } from './pg-folio-allocator';

// Pruebas contra Postgres local real (conexión directa). Corren con `pnpm test:integracion`.
const DB_URL = process.env.ZAMMIR_TEST_DB_URL ?? '';
const pool = new Pool({ connectionString: DB_URL, max: 12 });

// Años lejanos y distintos en cada corrida: el servidor conserva sus contadores entre pruebas.
// Rango propio (9000 en adelante): las pruebas del receptor usan 4000–8999 y no deben compartir contadores.
let anio = 9000 + Math.floor(Math.random() * 900);

beforeAll(() => {
  if (DB_URL === '') {
    throw new Error('falta ZAMMIR_TEST_DB_URL: usa `pnpm test:integracion`');
  }
});

afterAll(async () => {
  await pool.query('delete from public.folio_counters where year >= 9000');
  await pool.end();
});

// La misma batería que pasa el adaptador en memoria, ahora con transacciones y bloqueos reales.
folioAllocatorContract(
  'Postgres',
  () => pgFolioAllocator(pool),
  () => {
    anio += 3;
    return anio;
  },
);
