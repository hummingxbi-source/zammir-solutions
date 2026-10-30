import { err, ok, type Result } from '../../../../shared-kernel/result';
import { reglaDeServicio, reglaPorArea, reglaPorMetroLineal, reglaPorPieza } from './rules';
import type { PriceError, PriceInput, PriceResult, PriceRule } from './types';

/** Reglas de precio registradas. Es inmutable: registrar una regla nueva devuelve otro registro
 *  y nunca toca las reglas que ya estaban [RN-02, ADR-0006]. */
export interface PriceRegistry {
  has(idDeRegla: string): boolean;
  register(regla: PriceRule): Result<PriceRegistry, PriceError>;
  /** Calcula el importe con la regla del producto y los parámetros guardados en la base. */
  calculate(
    idDeRegla: string,
    parametros: unknown,
    entrada: PriceInput,
  ): Result<PriceResult, PriceError>;
}

export function createPriceRegistry(
  reglas: readonly PriceRule[],
): Result<PriceRegistry, PriceError> {
  const porId = new Map<string, PriceRule>();
  for (const regla of reglas) {
    if (porId.has(regla.id)) {
      return err({ code: 'RULE_ALREADY_REGISTERED' });
    }
    porId.set(regla.id, regla);
  }
  const registro: PriceRegistry = {
    has: (idDeRegla) => porId.has(idDeRegla),
    register: (regla) => createPriceRegistry([...porId.values(), regla]),
    calculate(idDeRegla, parametros, entrada) {
      const regla = porId.get(idDeRegla);
      if (regla === undefined) {
        return err({ code: 'RULE_NOT_REGISTERED' });
      }
      return regla.calculate(entrada, parametros);
    },
  };
  return ok(registro);
}

/** Las cuatro reglas que existen hoy: por m², por metro lineal, por pieza y de servicio. */
export const defaultRules: readonly PriceRule[] = [
  reglaPorArea,
  reglaPorMetroLineal,
  reglaPorPieza,
  reglaDeServicio,
];
