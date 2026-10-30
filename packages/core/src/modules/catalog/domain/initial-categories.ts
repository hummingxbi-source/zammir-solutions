import type { FiscalData } from './product';

/** Clave genérica del SAT ("no existe en el catálogo"): valor de PRUEBA hasta que el contador o el PAC
 *  validen las claves reales de cada categoría (PD-29). */
const CLAVE_DE_PRUEBA = '01010101';

const porMetroCuadrado: FiscalData = {
  productServiceKey: CLAVE_DE_PRUEBA,
  unitKey: 'MTK',
  taxObject: '02',
};
const porPieza: FiscalData = {
  productServiceKey: CLAVE_DE_PRUEBA,
  unitKey: 'H87',
  taxObject: '02',
};
const porServicio: FiscalData = {
  productServiceKey: CLAVE_DE_PRUEBA,
  unitKey: 'E48',
  taxObject: '02',
};

export interface InitialCategory {
  readonly name: string;
  readonly fiscalDefaults: FiscalData;
}

/** Categorías iniciales de RF-M1-02, en el orden en que se muestran. Las categorías que la investigación
 *  sugiere agregar (laminado, canceles, policarbonato…) esperan la respuesta de Luis (PD-49). */
export const INITIAL_CATEGORIES: readonly InitialCategory[] = [
  { name: 'Vidrio claro / flotado', fiscalDefaults: porMetroCuadrado },
  { name: 'Vidrio templado', fiscalDefaults: porMetroCuadrado },
  { name: 'Esmerilado / satinado', fiscalDefaults: porMetroCuadrado },
  { name: 'Decorado / emplomado', fiscalDefaults: porMetroCuadrado },
  { name: 'Espejo', fiscalDefaults: porMetroCuadrado },
  { name: 'Cristal doble / termopanel', fiscalDefaults: porMetroCuadrado },
  { name: 'Acrílico', fiscalDefaults: porMetroCuadrado },
  { name: 'Aluminio y cancelería', fiscalDefaults: porPieza },
  { name: 'Herrajes', fiscalDefaults: porPieza },
  { name: 'Selladores y silicón', fiscalDefaults: porPieza },
  { name: 'Servicios', fiscalDefaults: porServicio },
];
