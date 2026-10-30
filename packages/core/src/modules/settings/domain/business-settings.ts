import { z } from 'zod';

import { err, ok, type Result } from '../../../shared-kernel/result';

const puntosBase = z.number().int().min(0).max(10_000);
const enteroPositivo = z.number().int().positive();

/** Ajustes del negocio tal como viven en la tabla `business_settings` (claves en inglés).
 *  Un valor `null` significa "por definir": se construye configurable y nunca se inventa un valor
 *  [CLAUDE.md regla 1]. Los valores por defecto los crea la migración, no este código. */
const esquema = z.object({
  tax_rate_bps: puntosBase,
  deposit_percent_bps: puntosBase,
  quote_validity_days: enteroPositivo,
  idle_lock_minutes: enteroPositivo,
  receivable_aging_threshold_days: enteroPositivo,
  deposit_tax_treatment: z.enum(['a', 'b']),
  self_invoicing_deadline_rule: z.enum(['end_of_month']),
  sales_basis: z.enum(['cash_received']),
  stamps_warning_percent: puntosBase.max(100),
  feature_p1: z.boolean(),
  feature_p2: z.boolean(),
  admin_idle_logout_minutes: enteroPositivo.nullable(),
  device_code_validity_minutes: enteroPositivo,
  admin_pin_min_digits: enteroPositivo,
  pin_pbkdf2_iterations: enteroPositivo,
  pin_max_failed_attempts: enteroPositivo.nullable(),
  pin_lock_seconds: enteroPositivo.nullable(),
  warranty_months_default: enteroPositivo.nullable(),
  self_invoicing_legend: z.string().min(1).nullable(),
  stamps_yearly_limit: enteroPositivo.nullable(),
  business_name: z.string().min(1).nullable(),
  business_phone: z.string().min(1).nullable(),
  business_address: z.string().min(1).nullable(),
  business_logo_url: z.string().min(1).nullable(),
  local_retention_days: enteroPositivo.nullable(),
});

export type BusinessSettings = z.infer<typeof esquema>;

export interface SettingRow {
  readonly key: string;
  readonly value: unknown;
}

export interface SettingsError {
  /** Inválidos: faltan o tienen un valor que no vale. No disponibles: no se pudieron leer del servidor. */
  readonly code: 'SETTINGS_INVALID' | 'SETTINGS_UNAVAILABLE';
  /** Qué ajustes faltan o tienen un valor inválido, para avisar a soporte. */
  readonly problemas: readonly string[];
}

/** Valida en la frontera las filas que llegan de la base antes de que toquen el dominio. */
export function parseBusinessSettings(
  filas: readonly SettingRow[],
): Result<BusinessSettings, SettingsError> {
  const valores: Record<string, unknown> = {};
  for (const fila of filas) {
    valores[fila.key] = fila.value;
  }

  const resultado = esquema.safeParse(valores);
  if (resultado.success) {
    return ok(resultado.data);
  }
  return err({
    code: 'SETTINGS_INVALID',
    problemas: resultado.error.issues.map((problema) => {
      const [clave] = problema.path;
      return `${String(clave)}: ${problema.message}`;
    }),
  });
}
