export type ExportRow = Readonly<Record<string, unknown>>;

/** Todos los datos del negocio que entrega el servidor: una lista de renglones por tabla [S5-08, RNF-22]. */
export interface ExportDataset {
  /** Cuándo se generó (ISO, UTC). */
  readonly generatedAt: string;
  readonly tables: Readonly<Record<string, readonly ExportRow[]>>;
}

/** Valida lo que llegó del servidor. `null` si no tiene la forma esperada. */
export function parseExportDataset(valor: unknown): ExportDataset | null {
  if (typeof valor !== 'object' || valor === null) {
    return null;
  }
  const r = valor as Record<string, unknown>;
  const generado = r.generated_at ?? r.generatedAt;
  const tablas = r.tables;
  if (typeof generado !== 'string' || Number.isNaN(new Date(generado).getTime())) {
    return null;
  }
  if (typeof tablas !== 'object' || tablas === null || Array.isArray(tablas)) {
    return null;
  }
  const salida: Record<string, readonly ExportRow[]> = {};
  for (const [nombre, filas] of Object.entries(tablas)) {
    if (!Array.isArray(filas)) {
      return null;
    }
    for (const fila of filas) {
      if (typeof fila !== 'object' || fila === null || Array.isArray(fila)) {
        return null;
      }
    }
    salida[nombre] = filas as readonly ExportRow[];
  }
  return { generatedAt: new Date(generado).toISOString(), tables: salida };
}

export interface ExportTableInfo {
  readonly name: string;
  /** Cómo se llama en el negocio. */
  readonly label: string;
  /** Las columnas que van en el PDF (en el CSV y el JSON van todas). */
  readonly summary: readonly string[];
}

/** Las tablas que se entregan, en el orden en que se leen mejor, con su nombre del oficio. */
export const EXPORT_TABLES: readonly ExportTableInfo[] = [
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

/** Cómo se llama cada columna del resumen en el negocio; la que no esté aquí se muestra con su nombre técnico. */
export const COLUMN_LABELS: Readonly<Record<string, string>> = {
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

export function columnLabel(columna: string): string {
  return COLUMN_LABELS[columna] ?? columna;
}

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Una fecha y hora de México como `08/11/2026 12:30`. */
export function formatMexicoDateTime(iso: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) {
    return iso;
  }
  const partes = Object.fromEntries(
    FORMATO_FECHA_HORA.formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return `${partes.day ?? ''}/${partes.month ?? ''}/${partes.year ?? ''} ${partes.hour ?? ''}:${partes.minute ?? ''}`;
}

/** Centavos enteros como pesos (`$1,234.50`), sin flotantes. */
export function formatCentsAsPesos(cents: number): string {
  const negativo = cents < 0;
  const absoluto = Math.abs(cents);
  const pesos = Math.trunc(absoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const centavos = String(absoluto % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}$${pesos}.${centavos}`;
}

const INSTANTE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Cómo se ve un dato en el PDF: importes en pesos, fechas de México, sí/no y lo demás tal cual. */
export function formatForReport(columna: string, valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  if (typeof valor === 'number') {
    return columna.endsWith('_cents') && Number.isInteger(valor)
      ? formatCentsAsPesos(valor)
      : String(valor);
  }
  if (typeof valor === 'string') {
    if (INSTANTE_ISO.test(valor)) {
      return formatMexicoDateTime(valor);
    }
    const fecha = SOLO_FECHA.exec(valor);
    return fecha === null ? valor : `${fecha[3] ?? ''}/${fecha[2] ?? ''}/${fecha[1] ?? ''}`;
  }
  return JSON.stringify(valor);
}
