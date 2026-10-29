import type { SettingRow } from './business-settings';

/** Filas inventadas que reflejan los valores iniciales de la migración. */
export function filasValidas(cambios: Record<string, unknown> = {}): SettingRow[] {
  const base: Record<string, unknown> = {
    tax_rate_bps: 1600,
    deposit_percent_bps: 5000,
    quote_validity_days: 15,
    idle_lock_minutes: 5,
    receivable_aging_threshold_days: 10,
    deposit_tax_treatment: 'a',
    self_invoicing_deadline_rule: 'end_of_month',
    sales_basis: 'cash_received',
    stamps_warning_percent: 80,
    feature_p1: false,
    feature_p2: false,
    admin_idle_logout_minutes: null,
    pin_max_failed_attempts: null,
    pin_lock_seconds: null,
    warranty_months_default: null,
    self_invoicing_legend: null,
    stamps_yearly_limit: null,
    business_name: null,
    business_phone: null,
    business_address: null,
    business_logo_url: null,
    local_retention_days: null,
  };
  return Object.entries({ ...base, ...cambios }).map(([key, value]) => ({ key, value }));
}
