import { folioAllocatorContract } from '@zammir/core/testing';
import { Pool } from 'pg';
import { afterAll, beforeAll } from 'vitest';

import { pgFolioAllocator } from './pg-folio-allocator';

// Pruebas contra Postgres local real (conexión directa). Corren con `pnpm test:integracion`.
const DB_URL = process.env.ZAMMIR_TEST_DB_URL ?? '';
const pool = new Pool({ connectionString: DB_URL, max: 12 });

// Años lejanos y distintos en cada corrida: el servidor conserva sus contadores entre pruebas.
let anio = 3000 + Math.floor(Math.random() * 5000);

beforeAll(() => {
  if (DB_URL === '') {
    throw new Error('falta ZAMMIR_TEST_DB_URL: usa `pnpm test:integracion`');
  }
});

afterAll(async () => {
  await pool.query('delete from public.folio_counters where year >= 3000');
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
