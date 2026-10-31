// Mutación de las piezas que no pueden fallar: dinero, IVA, redondeo, precios y folios (≥ 90 %).
import base from './stryker.config.mjs';

export default {
  ...base,
  mutate: [
    'packages/core/src/shared-kernel/money/**/*.ts',
    'packages/core/src/shared-kernel/tax/**/*.ts',
    'packages/core/src/shared-kernel/folio/**/*.ts',
    'packages/core/src/modules/catalog/domain/pricing/**/*.ts',
    'packages/core/src/modules/quotes/domain/quote.ts',
    'packages/core/src/modules/orders/domain/work-order.ts',
    'packages/core/src/modules/payments/domain/payment.ts',
    'packages/core/src/modules/counter/domain/ticket.ts',
    '!packages/core/src/**/*.test.ts',
  ],
  thresholds: { high: 95, low: 90, break: 90 },
};
