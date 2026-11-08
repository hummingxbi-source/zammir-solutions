import { describe, expect, it } from 'vitest';

import { CSV_BOM } from '../domain/csv';
import {
  columnLabel,
  EXPORT_TABLES,
  formatCentsAsPesos,
  formatForReport,
  formatMexicoDateTime,
  parseExportDataset,
  type ExportDataset,
} from '../domain/export-dataset';
import { buildExportPackage, MAX_PDF_ROWS_PER_TABLE } from './build-export';
import { exportData, type DataExportSource } from './export-data';

// 2026-11-09T05:30Z = domingo 8 de noviembre, 23:30 en México: el nombre del archivo lleva el día de México.
const GENERADO = '2026-11-09T05:30:00.000Z';

const DATOS: ExportDataset = {
  generatedAt: GENERADO,
  tables: {
    customers: [
      {
        id: 'c1',
        name: 'Ana López',
        phone: '5512345678',
        email: null,
        created_at: '2026-10-01T15:00:00.000Z',
      },
      {
        id: 'c2',
        name: '=cmd|x',
        phone: '+525598765432',
        email: 'a@b.c',
        created_at: '2026-10-02T15:00:00.000Z',
      },
    ],
    counter_sales: [
      {
        id: 'v1',
        temp_folio: 'T1-0001',
        status: 'COMPLETED',
        total_cents: 11_600,
        issued_at: '2026-11-08T18:00:00.000Z',
      },
    ],
    legal_documents: [],
    una_tabla_nueva: [{ x: 1 }],
  },
};

describe('formatos para leer', () => {
  it('las columnas del resumen tienen nombre del oficio y las desconocidas conservan el suyo', () => {
    expect(columnLabel('total_cents')).toBe('Total');
    expect(columnLabel('columna_nueva')).toBe('columna_nueva');
    for (const t of EXPORT_TABLES) {
      for (const c of t.summary) {
        expect(columnLabel(c), `${t.name}.${c}`).not.toBe(c);
      }
    }
  });

  it('centavos enteros como pesos, con miles y sin flotantes', () => {
    expect(formatCentsAsPesos(0)).toBe('$0.00');
    expect(formatCentsAsPesos(5)).toBe('$0.05');
    expect(formatCentsAsPesos(11_600)).toBe('$116.00');
    expect(formatCentsAsPesos(123_456_789)).toBe('$1,234,567.89');
    expect(formatCentsAsPesos(-1_050)).toBe('-$10.50');
  });

  it('una fecha y hora en la hora de México, sin importar la zona de quien exporta', () => {
    expect(formatMexicoDateTime('2026-11-09T05:30:00.000Z')).toBe('08/11/2026 23:30');
    expect(formatMexicoDateTime('2026-11-01T06:00:00.000Z')).toBe('01/11/2026 00:00');
    expect(formatMexicoDateTime('no es fecha')).toBe('no es fecha');
  });

  it('cada tipo de dato se ve como se lee en el negocio', () => {
    expect(formatForReport('total_cents', 11_600)).toBe('$116.00');
    expect(formatForReport('quantity', 3)).toBe('3');
    expect(formatForReport('total_cents', 1.5)).toBe('1.5');
    expect(formatForReport('is_active', true)).toBe('Sí');
    expect(formatForReport('is_active', false)).toBe('No');
    expect(formatForReport('email', null)).toBe('');
    expect(formatForReport('email', undefined)).toBe('');
    expect(formatForReport('issued_at', '2026-11-08T18:00:00.000Z')).toBe('08/11/2026 12:00');
    expect(formatForReport('starts_on', '2026-11-08')).toBe('08/11/2026');
    expect(formatForReport('name', 'Ana')).toBe('Ana');
    expect(formatForReport('value', { a: 1 })).toBe('{"a":1}');
  });
});

describe('lo que llega del servidor', () => {
  it('se acepta con generated_at o generatedAt y se normaliza la fecha', () => {
    const a = parseExportDataset({
      generated_at: '2026-11-08T12:00:00+00:00',
      tables: { x: [{ a: 1 }] },
    });
    expect(a).toEqual({ generatedAt: '2026-11-08T12:00:00.000Z', tables: { x: [{ a: 1 }] } });
    expect(parseExportDataset({ generatedAt: GENERADO, tables: {} })?.generatedAt).toBe(GENERADO);
  });

  it.each([
    ['nada', null],
    ['un texto', 'x'],
    ['sin fecha', { tables: {} }],
    ['fecha inválida', { generated_at: 'ayer', tables: {} }],
    ['fecha que no es texto', { generated_at: 5, tables: {} }],
    ['sin tablas', { generated_at: GENERADO }],
    ['tablas como lista', { generated_at: GENERADO, tables: [] }],
    ['una tabla que no es lista', { generated_at: GENERADO, tables: { x: 'y' } }],
    ['un renglón que no es objeto', { generated_at: GENERADO, tables: { x: [1] } }],
    ['un renglón nulo', { generated_at: GENERADO, tables: { x: [null] } }],
    ['un renglón que es lista', { generated_at: GENERADO, tables: { x: [[]] } }],
  ])('se rechaza: %s', (_, valor) => {
    expect(parseExportDataset(valor)).toBeNull();
  });
});

describe('el paquete de la exportación', () => {
  const p = buildExportPackage(DATOS);

  it('el nombre lleva el día de México, no el de UTC', () => {
    expect(p.baseName).toBe('zammir-datos-2026-11-08');
  });

  it('el JSON trae todo, con el formato y la fecha', () => {
    expect(p.json.path).toBe('zammir-datos.json');
    expect(p.json.mimeType).toBe('application/json');
    const j = JSON.parse(p.json.content) as {
      format: number;
      generatedAt: string;
      tables: unknown;
    };
    expect(j.format).toBe(1);
    expect(j.generatedAt).toBe(GENERADO);
    expect(j.tables).toEqual(DATOS.tables);
  });

  it('hay un CSV por cada tabla del negocio, aunque venga vacía, y uno por cada tabla desconocida', () => {
    const rutas = p.csvFiles.map((f) => f.path);
    for (const t of EXPORT_TABLES) {
      expect(rutas).toContain(`csv/${t.name}.csv`);
    }
    expect(rutas).toContain('csv/una_tabla_nueva.csv');
    expect(rutas).toHaveLength(EXPORT_TABLES.length + 1);
    expect(p.csvFiles.find((f) => f.path === 'csv/legal_documents.csv')?.content).toBe(CSV_BOM);
    expect(p.csvFiles.every((f) => f.mimeType === 'text/csv')).toBe(true);
  });

  it('el CSV de clientes trae todas las columnas y protege lo que Excel tomaría por fórmula', () => {
    const csv = p.csvFiles.find((f) => f.path === 'csv/customers.csv')?.content ?? '';
    expect(csv.startsWith(`${CSV_BOM}id,name,phone,email,created_at\r\n`)).toBe(true);
    expect(csv).toContain("c2,'=cmd|x,'+525598765432,a@b.c,");
  });

  it('cuenta los renglones de cada tabla', () => {
    expect(p.counts.customers).toBe(2);
    expect(p.counts.counter_sales).toBe(1);
    expect(p.counts.legal_documents).toBe(0);
    expect(p.counts.products).toBe(0);
    expect(p.counts.una_tabla_nueva).toBe(1);
  });

  it('el PDF tiene una sección por tabla con los nombres del oficio y los datos como se leen', () => {
    expect(p.report.title).toBe('Datos de ZAMMIR');
    expect(p.report.subtitle).toBe('Generado el 08/11/2026 23:30 (hora de la Ciudad de México)');
    expect(p.report.sections.map((s) => s.title)).toEqual(EXPORT_TABLES.map((t) => t.label));
    const ventas = p.report.sections.find((s) => s.title === 'Ventas de mostrador');
    expect(ventas?.columns).toEqual(['Folio', 'Folio provisional', 'Estado', 'Fecha', 'Total']);
    expect(ventas?.rows).toEqual([['', 'T1-0001', 'COMPLETED', '08/11/2026 12:00', '$116.00']]);
    expect(ventas?.totalRows).toBe(1);
    expect(ventas?.omittedRows).toBe(0);
  });

  it('el PDF recorta las tablas muy largas y dice cuántos renglones quedaron fuera', () => {
    const muchos = Array.from({ length: MAX_PDF_ROWS_PER_TABLE + 5 }, (_, i) => ({
      id: i,
      name: `P${String(i)}`,
    }));
    const grande = buildExportPackage({ generatedAt: GENERADO, tables: { customers: muchos } });
    const clientes = grande.report.sections.find((s) => s.title === 'Clientes');
    expect(clientes?.rows).toHaveLength(MAX_PDF_ROWS_PER_TABLE);
    expect(clientes?.totalRows).toBe(MAX_PDF_ROWS_PER_TABLE + 5);
    expect(clientes?.omittedRows).toBe(5);
    // El CSV y el JSON sí traen todo.
    const csv = grande.csvFiles.find((f) => f.path === 'csv/customers.csv')?.content ?? '';
    expect(csv.split('\r\n')).toHaveLength(MAX_PDF_ROWS_PER_TABLE + 5 + 2);
  });

  it('el LÉEME explica los importes en centavos, las fechas en UTC y lo que no trae', () => {
    const t = p.readme.content;
    expect(p.readme.path).toBe('LEEME.txt');
    expect(t).toContain('DATOS DE ZAMMIR');
    expect(t).toContain('Generado el 08/11/2026 23:30');
    expect(t).toContain('CENTAVOS');
    expect(t).toContain('UTC');
    expect(t).toContain('PIN');
    expect(t).toContain('csv/customers.csv  (Clientes: 2 renglones)');
    expect(t).toContain('csv/counter_sales.csv  (Ventas de mostrador: 1 renglón)');
    expect(t).toContain('bitácora');
  });

  it('con otro nombre de negocio el título y el LÉEME lo usan', () => {
    const otro = buildExportPackage(DATOS, { businessName: 'Vidriería Prueba' });
    expect(otro.report.title).toBe('Datos de Vidriería Prueba');
    expect(otro.readme.content).toContain('DATOS DE VIDRIERÍA PRUEBA');
  });
});

describe('pedir la exportación', () => {
  const fuente = (r: Awaited<ReturnType<DataExportSource['load']>>): DataExportSource => ({
    load: () => Promise.resolve(r),
  });

  it('con datos entrega el paquete', async () => {
    const r = await exportData(fuente({ kind: 'OK', dataset: DATOS }));
    expect(r.kind).toBe('READY');
    expect(r.kind === 'READY' && r.package.baseName).toBe('zammir-datos-2026-11-08');
  });

  it.each(['NOT_AUTHORIZED', 'NO_NETWORK', 'UNAVAILABLE'] as const)(
    'si el servidor dice %s, lo dice tal cual',
    async (kind) => {
      expect(await exportData(fuente({ kind }))).toEqual({ kind });
    },
  );

  it('si la fuente falla no lanza: queda como no disponible', async () => {
    const r = await exportData({ load: () => Promise.reject(new Error('boom')) });
    expect(r).toEqual({ kind: 'UNAVAILABLE' });
  });
});
