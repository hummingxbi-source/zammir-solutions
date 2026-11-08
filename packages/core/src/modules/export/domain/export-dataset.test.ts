import { describe, expect, it } from 'vitest';

import {
  COLUMN_LABELS,
  columnLabel,
  EXPORT_TABLES,
  formatForReport,
  formatMexicoDateTime,
  parseExportDataset,
} from './export-dataset';

// Valores esperados, fijados a mano a partir de la especificación (nombres del oficio y columnas del resumen).
const TABLAS_ESPERADAS = [
  {
    name: 'customers',
    label: 'Clientes',
    summary: ['name', 'phone', 'email', 'fiscal_rfc', 'created_at'],
  },
  { name: 'product_categories', label: 'Categorías del catálogo', summary: ['name', 'sort_order'] },
  {
    name: 'products',
    label: 'Productos',
    summary: ['code', 'name', 'kind', 'charge_unit', 'list_price_cents', 'is_active'],
  },
  {
    name: 'product_price_history',
    label: 'Historial de precios',
    summary: ['product_id', 'old_price_cents', 'new_price_cents', 'changed_at'],
  },
  {
    name: 'quotes',
    label: 'Cotizaciones',
    summary: ['folio', 'temp_folio', 'status', 'issued_at', 'total_cents'],
  },
  {
    name: 'quote_lines',
    label: 'Conceptos de las cotizaciones',
    summary: ['name', 'quantity', 'line_total_cents'],
  },
  {
    name: 'work_orders',
    label: 'Órdenes de trabajo',
    summary: ['folio', 'temp_folio', 'status', 'issued_at', 'total_cents'],
  },
  {
    name: 'work_order_lines',
    label: 'Conceptos de las órdenes de trabajo',
    summary: ['name', 'quantity', 'line_total_cents'],
  },
  {
    name: 'work_order_status_events',
    label: 'Cambios de estatus de las órdenes',
    summary: ['from_status', 'to_status', 'occurred_at', 'reason'],
  },
  { name: 'warranties', label: 'Garantías', summary: ['starts_on', 'duration_months', 'coverage'] },
  { name: 'payments', label: 'Pagos', summary: ['kind', 'method', 'amount_cents', 'paid_at'] },
  {
    name: 'counter_sales',
    label: 'Ventas de mostrador',
    summary: ['folio', 'temp_folio', 'status', 'issued_at', 'total_cents'],
  },
  {
    name: 'counter_sale_lines',
    label: 'Conceptos de las ventas de mostrador',
    summary: ['name', 'quantity', 'line_total_cents'],
  },
  {
    name: 'cash_shifts',
    label: 'Turnos de caja',
    summary: [
      'business_day',
      'status',
      'opening_float_cents',
      'counted_cash_cents',
      'difference_cents',
    ],
  },
  {
    name: 'cash_shift_reopenings',
    label: 'Reaperturas de turnos',
    summary: ['reason', 'occurred_at'],
  },
  {
    name: 'invoice_requests',
    label: 'Facturas',
    summary: ['invoice_folio', 'status', 'channel', 'stamped_at'],
  },
  {
    name: 'legal_documents',
    label: 'Documentos legales',
    summary: ['type', 'version', 'effective_from'],
  },
  { name: 'business_settings', label: 'Ajustes del negocio', summary: ['key', 'value'] },
  {
    name: 'audit_log',
    label: 'Bitácora',
    summary: ['occurred_at', 'action', 'entity_type', 'entity_id'],
  },
  {
    name: 'app_users',
    label: 'Personas del mostrador',
    summary: ['name', 'role', 'is_active', 'created_at'],
  },
  { name: 'devices', label: 'Tablets', summary: ['name', 'status', 'created_at', 'last_sent_at'] },
];

const ETIQUETAS_ESPERADAS = {
  name: 'Nombre',
  phone: 'Teléfono',
  email: 'Correo',
  fiscal_rfc: 'RFC',
  created_at: 'Alta',
  sort_order: 'Orden',
  code: 'Código',
  kind: 'Tipo',
  charge_unit: 'Unidad de cobro',
  list_price_cents: 'Precio de lista',
  is_active: 'Activo',
  product_id: 'Producto',
  old_price_cents: 'Precio anterior',
  new_price_cents: 'Precio nuevo',
  changed_at: 'Cambio',
  folio: 'Folio',
  temp_folio: 'Folio provisional',
  status: 'Estado',
  issued_at: 'Fecha',
  total_cents: 'Total',
  quantity: 'Cantidad',
  line_total_cents: 'Importe',
  from_status: 'De',
  to_status: 'A',
  occurred_at: 'Fecha',
  reason: 'Motivo',
  starts_on: 'Desde',
  duration_months: 'Meses',
  coverage: 'Cobertura',
  method: 'Método',
  amount_cents: 'Importe',
  paid_at: 'Pagado',
  business_day: 'Día',
  opening_float_cents: 'Fondo inicial',
  counted_cash_cents: 'Efectivo contado',
  difference_cents: 'Diferencia',
  invoice_folio: 'Folio de la factura',
  channel: 'Canal',
  stamped_at: 'Timbrada',
  type: 'Tipo',
  version: 'Versión',
  effective_from: 'Rige desde',
  key: 'Ajuste',
  value: 'Valor',
  action: 'Acción',
  entity_type: 'Entidad',
  entity_id: 'Identificador',
  role: 'Rol',
  last_sent_at: 'Último envío',
};

describe('las tablas que se exportan', () => {
  it('son exactamente estas, en este orden, con su nombre del oficio y sus columnas del resumen', () => {
    expect(EXPORT_TABLES).toEqual(TABLAS_ESPERADAS);
  });

  it('ninguna se repite', () => {
    const nombres = EXPORT_TABLES.map((t) => t.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe('nombres de las columnas', () => {
  it('son exactamente estos', () => {
    expect(COLUMN_LABELS).toEqual(ETIQUETAS_ESPERADAS);
  });

  it('una columna que no está en la lista conserva su nombre técnico', () => {
    expect(columnLabel('columna_nueva')).toBe('columna_nueva');
    expect(columnLabel('name')).toBe('Nombre');
  });
});

describe('formatos de fecha', () => {
  it('una fecha y hora de México lleva día, mes, año, hora y minuto, cada uno en su lugar', () => {
    // 2026-03-05 09:07 en México (UTC-6): día 05, mes 03, hora 09, minuto 07.
    expect(formatMexicoDateTime('2026-03-05T15:07:00.000Z')).toBe('05/03/2026 09:07');
    expect(formatMexicoDateTime('2026-12-31T05:59:00.000Z')).toBe('30/12/2026 23:59');
  });

  it('una fecha sola va como día/mes/año, cada parte en su lugar', () => {
    expect(formatForReport('starts_on', '2026-03-05')).toBe('05/03/2026');
    expect(formatForReport('starts_on', '1999-12-31')).toBe('31/12/1999');
  });

  it('un texto parecido a una fecha pero que no lo es queda igual', () => {
    expect(formatForReport('name', '2026-03-05 y más')).toBe('2026-03-05 y más');
    expect(formatForReport('name', '5/3/2026')).toBe('5/3/2026');
  });
});

describe('validación de los datos del servidor, caso por caso', () => {
  const ok = { generated_at: '2026-11-08T18:00:00Z' };

  it('no acepta que las tablas sean un texto, un número ni una lista', () => {
    expect(parseExportDataset({ ...ok, tables: 'x' })).toBeNull();
    expect(parseExportDataset({ ...ok, tables: 5 })).toBeNull();
    expect(parseExportDataset({ ...ok, tables: [] })).toBeNull();
    expect(parseExportDataset({ ...ok, tables: null })).toBeNull();
  });

  it('no acepta una tabla que no sea una lista, ni un renglón que no sea un objeto', () => {
    expect(parseExportDataset({ ...ok, tables: { x: {} } })).toBeNull();
    expect(parseExportDataset({ ...ok, tables: { x: 'y' } })).toBeNull();
    expect(parseExportDataset({ ...ok, tables: { x: ['y'] } })).toBeNull();
    expect(parseExportDataset({ ...ok, tables: { x: [[]] } })).toBeNull();
    expect(parseExportDataset({ ...ok, tables: { x: [null] } })).toBeNull();
  });

  it('acepta tablas vacías y renglones con cualquier valor dentro', () => {
    const r = parseExportDataset({
      ...ok,
      tables: { a: [], b: [{ x: null, y: [1], z: { k: 1 } }] },
    });
    expect(r?.tables.a).toEqual([]);
    expect(r?.tables.b).toEqual([{ x: null, y: [1], z: { k: 1 } }]);
  });

  it('no acepta un valor que no sea un objeto', () => {
    expect(parseExportDataset(5)).toBeNull();
    expect(parseExportDataset(true)).toBeNull();
    expect(parseExportDataset(undefined)).toBeNull();
  });
});
