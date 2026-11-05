/** Catálogos del SAT que el portal ofrece al cliente [RF-M10-13, RN-28]. Son los del CFDI 4.0 (`c_RegimenFiscal`
 *  y `c_UsoCFDI`). Las claves y los nombres se validan con el contador o con el PAC antes de producción
 *  (PD-29); la compatibilidad entre el régimen y el uso la revisa el PAC al timbrar. */

export interface FiscalRegime {
  readonly code: string;
  readonly name: string;
  /** Quién puede tener ese régimen: persona física, moral o ambas. */
  readonly appliesTo: 'FISICA' | 'MORAL' | 'AMBAS';
}

export const FISCAL_REGIMES: readonly FiscalRegime[] = [
  { code: '601', name: 'General de Ley Personas Morales', appliesTo: 'MORAL' },
  { code: '603', name: 'Personas Morales con Fines no Lucrativos', appliesTo: 'MORAL' },
  { code: '605', name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios', appliesTo: 'FISICA' },
  { code: '606', name: 'Arrendamiento', appliesTo: 'FISICA' },
  { code: '607', name: 'Régimen de Enajenación o Adquisición de Bienes', appliesTo: 'FISICA' },
  { code: '608', name: 'Demás ingresos', appliesTo: 'FISICA' },
  {
    code: '610',
    name: 'Residentes en el Extranjero sin Establecimiento Permanente en México',
    appliesTo: 'AMBAS',
  },
  { code: '611', name: 'Ingresos por Dividendos (socios y accionistas)', appliesTo: 'FISICA' },
  {
    code: '612',
    name: 'Personas Físicas con Actividades Empresariales y Profesionales',
    appliesTo: 'FISICA',
  },
  { code: '614', name: 'Ingresos por intereses', appliesTo: 'FISICA' },
  { code: '615', name: 'Régimen de los ingresos por obtención de premios', appliesTo: 'FISICA' },
  { code: '616', name: 'Sin obligaciones fiscales', appliesTo: 'FISICA' },
  {
    code: '620',
    name: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
    appliesTo: 'MORAL',
  },
  { code: '621', name: 'Incorporación Fiscal', appliesTo: 'FISICA' },
  {
    code: '622',
    name: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    appliesTo: 'AMBAS',
  },
  { code: '623', name: 'Opcional para Grupos de Sociedades', appliesTo: 'MORAL' },
  { code: '624', name: 'Coordinados', appliesTo: 'MORAL' },
  {
    code: '625',
    name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    appliesTo: 'FISICA',
  },
  { code: '626', name: 'Régimen Simplificado de Confianza', appliesTo: 'AMBAS' },
];

export interface CfdiUse {
  readonly code: string;
  readonly name: string;
  /** Si el portal lo ofrece al cliente: los usos de pagos, nómina y devoluciones no aplican a una compra. */
  readonly forPortal: boolean;
}

export const CFDI_USES: readonly CfdiUse[] = [
  { code: 'G01', name: 'Adquisición de mercancías', forPortal: true },
  { code: 'G02', name: 'Devoluciones, descuentos o bonificaciones', forPortal: false },
  { code: 'G03', name: 'Gastos en general', forPortal: true },
  { code: 'I01', name: 'Construcciones', forPortal: true },
  { code: 'I02', name: 'Mobiliario y equipo de oficina por inversiones', forPortal: true },
  { code: 'I03', name: 'Equipo de transporte', forPortal: true },
  { code: 'I04', name: 'Equipo de cómputo y accesorios', forPortal: true },
  { code: 'I05', name: 'Dados, troqueles, moldes, matrices y herramental', forPortal: true },
  { code: 'I06', name: 'Comunicaciones telefónicas', forPortal: true },
  { code: 'I07', name: 'Comunicaciones satelitales', forPortal: true },
  { code: 'I08', name: 'Otra maquinaria y equipo', forPortal: true },
  { code: 'D01', name: 'Honorarios médicos, dentales y gastos hospitalarios', forPortal: true },
  { code: 'D02', name: 'Gastos médicos por incapacidad o discapacidad', forPortal: true },
  { code: 'D03', name: 'Gastos funerales', forPortal: true },
  { code: 'D04', name: 'Donativos', forPortal: true },
  {
    code: 'D05',
    name: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)',
    forPortal: true,
  },
  { code: 'D06', name: 'Aportaciones voluntarias al SAR', forPortal: true },
  { code: 'D07', name: 'Primas por seguros de gastos médicos', forPortal: true },
  { code: 'D08', name: 'Gastos de transportación escolar obligatoria', forPortal: true },
  {
    code: 'D09',
    name: 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones',
    forPortal: true,
  },
  { code: 'D10', name: 'Pagos por servicios educativos (colegiaturas)', forPortal: true },
  { code: 'S01', name: 'Sin efectos fiscales', forPortal: true },
  { code: 'CP01', name: 'Pagos', forPortal: false },
  { code: 'CN01', name: 'Nómina', forPortal: false },
];

/** Los usos que se le ofrecen al cliente del portal, en el orden del SAT (PD-52: el orden por lo más pedido
 *  se ajusta aquí cuando ZAMMIR lo diga). */
export const PORTAL_CFDI_USES: readonly CfdiUse[] = CFDI_USES.filter((u) => u.forPortal);

export function isFiscalRegime(code: string): boolean {
  return FISCAL_REGIMES.some((r) => r.code === code);
}

export function isPortalCfdiUse(code: string): boolean {
  return PORTAL_CFDI_USES.some((u) => u.code === code);
}

/** Cualquier uso de CFDI del catálogo del SAT; un administrador que factura desde el sistema puede usar todos. */
export function isCfdiUse(code: string): boolean {
  return CFDI_USES.some((u) => u.code === code);
}

/** Largo del RFC de una persona moral (12) y de una física (13). */
export function personTypeOfRfc(rfc: string): 'FISICA' | 'MORAL' | null {
  if (rfc.length === 13) {
    return 'FISICA';
  }
  return rfc.length === 12 ? 'MORAL' : null;
}

/** Los regímenes que le tocan a quien tiene ese RFC: los de su tipo de persona y los que valen para ambas. Con
 *  un RFC que no tiene forma de RFC, todos. */
export function regimesForRfc(rfc: string): readonly FiscalRegime[] {
  const tipo = personTypeOfRfc(rfc.trim().toUpperCase());
  return tipo === null
    ? FISCAL_REGIMES
    : FISCAL_REGIMES.filter((r) => r.appliesTo === 'AMBAS' || r.appliesTo === tipo);
}
