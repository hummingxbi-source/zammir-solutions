import { describe, expect, it } from 'vitest';

import {
  ALL_PERMISSIONS,
  createPermissionPolicy,
  defaultPermissionPolicy,
  isPermitted,
  PERMISSION_MATRIX,
  type MatrixRole,
  type Permission,
  type PermissionDecision,
} from './permissions';

// La matriz tal como se espera, escrita aparte del código para que un error de captura se note.
// Fuente: tabla "Matriz de permisos" de docs/producto/REQUERIMIENTOS.md [DC §4].
const ESPERADO: readonly (readonly [
  accion: string,
  permiso: Permission,
  administrador: PermissionDecision,
  cajero: PermissionDecision,
])[] = [
  ['Generar cotizaciones', 'QUOTE_CREATE', 'ALLOW', 'ALLOW'],
  [
    'Descuentos o cambio de precio de una línea',
    'PRICE_OVERRIDE',
    'ALLOW',
    'NEEDS_ADMIN_AUTHORIZATION',
  ],
  ['Editar catálogo y precios', 'CATALOG_EDIT', 'ALLOW', 'DENY'],
  ['Registrar ventas, anticipos y saldos', 'SALE_REGISTER', 'ALLOW', 'ALLOW'],
  ['Avanzar estatus de una orden', 'ORDER_ADVANCE', 'ALLOW', 'ALLOW'],
  [
    'Entregar una orden con saldo pendiente',
    'ORDER_DELIVER_WITH_BALANCE',
    'ALLOW_WITH_REASON',
    'DENY',
  ],
  ['Cancelar ventas u órdenes', 'CANCEL_SALE_OR_ORDER', 'ALLOW_WITH_REASON', 'DENY'],
  ['Ver y cerrar su propio corte de caja', 'OWN_CASH_CLOSE', 'ALLOW', 'ALLOW'],
  ['Ver cortes de otros y el consolidado', 'OTHERS_CASH_VIEW', 'ALLOW', 'DENY'],
  ['Reportes y cuentas por cobrar', 'REPORTS_AND_RECEIVABLES', 'ALLOW', 'DENY'],
  [
    'Generar una factura desde el sistema',
    'INVOICE_GENERATE',
    'ALLOW',
    'NEEDS_ADMIN_AUTHORIZATION',
  ],
  ['Usuarios y dispositivos', 'USERS_AND_DEVICES', 'ALLOW', 'DENY'],
  ['Editar aviso de privacidad y términos', 'PRIVACY_NOTICE_EDIT', 'ALLOW', 'DENY'],
];

describe('matriz de permisos: una prueba por fila y por rol', () => {
  describe.each(ESPERADO)('%s', (_accion, permiso, administrador, cajero) => {
    it(`un administrador: ${administrador}`, () => {
      expect(defaultPermissionPolicy.check('ADMIN', permiso)).toBe(administrador);
    });

    it(`un cajero: ${cajero}`, () => {
      expect(defaultPermissionPolicy.check('STAFF', permiso)).toBe(cajero);
    });

    it('la sesión de la tablet y quien no ha entrado no pueden nada por sí mismos', () => {
      expect(defaultPermissionPolicy.check('DEVICE', permiso)).toBe('DENY');
      expect(defaultPermissionPolicy.check(null, permiso)).toBe('DENY');
    });
  });

  it('la matriz tiene exactamente las filas esperadas (si se agrega una, hay que probarla)', () => {
    expect([...ALL_PERMISSIONS].sort()).toEqual(ESPERADO.map((fila) => fila[1]).sort());
    expect(ESPERADO).toHaveLength(13);
  });

  it('la constante coincide con la tabla esperada', () => {
    for (const [, permiso, administrador, cajero] of ESPERADO) {
      expect(PERMISSION_MATRIX[permiso]).toEqual({ ADMIN: administrador, STAFF: cajero });
    }
  });
});

describe('createPermissionPolicy', () => {
  it('sin cambios usa la matriz del documento', () => {
    expect(createPermissionPolicy().check('STAFF', 'CATALOG_EDIT')).toBe('DENY');
  });

  it('permite ajustar una fila para un rol sin tocar las demás (PD-17)', () => {
    const politica = createPermissionPolicy({
      CATALOG_EDIT: { STAFF: 'NEEDS_ADMIN_AUTHORIZATION' },
    });
    expect(politica.check('STAFF', 'CATALOG_EDIT')).toBe('NEEDS_ADMIN_AUTHORIZATION');
    expect(politica.check('ADMIN', 'CATALOG_EDIT')).toBe('ALLOW');
    expect(politica.check('STAFF', 'REPORTS_AND_RECEIVABLES')).toBe('DENY');
  });

  it('un ajuste no le da permisos a la sesión de la tablet ni a nadie sin rol', () => {
    const politica = createPermissionPolicy({ CATALOG_EDIT: { STAFF: 'ALLOW' } });
    expect(politica.check('DEVICE', 'CATALOG_EDIT')).toBe('DENY');
    expect(politica.check(null, 'CATALOG_EDIT')).toBe('DENY');
  });
});

describe('isPermitted', () => {
  it.each([
    ['ALLOW', true],
    ['ALLOW_WITH_REASON', true],
    ['NEEDS_ADMIN_AUTHORIZATION', true],
    ['DENY', false],
  ] as const)('%s → %s', (decision, esperado) => {
    expect(isPermitted(decision)).toBe(esperado);
  });
});

describe('roles de la matriz', () => {
  it('cubre exactamente administrador y cajero', () => {
    const roles: MatrixRole[] = ['ADMIN', 'STAFF'];
    for (const permiso of ALL_PERMISSIONS) {
      expect(Object.keys(PERMISSION_MATRIX[permiso]).sort()).toEqual(roles.sort());
    }
  });
});
