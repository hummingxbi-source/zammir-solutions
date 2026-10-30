import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSION_MATRIX, type Permission, type PermissionDecision } from '@zammir/core';
import { describe, expect, it } from 'vitest';

// La tabla "Matriz de permisos" de docs/producto/REQUERIMIENTOS.md es la fuente de verdad:
// si alguien la cambia (o cambia el código) sin cambiar la otra, esta prueba falla.
const ETIQUETA_A_PERMISO: ReadonlyMap<string, Permission> = new Map([
  ['Generar cotizaciones', 'QUOTE_CREATE'],
  ['Descuentos o cambio de precio de una línea', 'PRICE_OVERRIDE'],
  ['Editar catálogo y precios', 'CATALOG_EDIT'],
  ['Registrar ventas, anticipos y saldos', 'SALE_REGISTER'],
  ['Avanzar estatus de una orden', 'ORDER_ADVANCE'],
  ['Entregar una orden con saldo pendiente', 'ORDER_DELIVER_WITH_BALANCE'],
  ['Cancelar ventas u órdenes', 'CANCEL_SALE_OR_ORDER'],
  ['Ver y cerrar su propio corte de caja', 'OWN_CASH_CLOSE'],
  ['Ver cortes de otros y el consolidado', 'OTHERS_CASH_VIEW'],
  ['Reportes y cuentas por cobrar', 'REPORTS_AND_RECEIVABLES'],
  ['Generar una factura desde el sistema', 'INVOICE_GENERATE'],
  ['Usuarios y dispositivos', 'USERS_AND_DEVICES'],
  ['Editar aviso de privacidad y términos', 'PRIVACY_NOTICE_EDIT'],
]);

function aDecision(texto: string): PermissionDecision {
  const limpio = texto.trim();
  if (limpio === 'Sí') return 'ALLOW';
  if (limpio === 'No') return 'DENY';
  if (limpio === 'Sí, con motivo') return 'ALLOW_WITH_REASON';
  if (/^Solo con (PIN|autorización) de un administrador$/.test(limpio)) {
    return 'NEEDS_ADMIN_AUTHORIZATION';
  }
  throw new Error(`texto de la matriz que no se reconoce: "${limpio}"`);
}

describe('la matriz del documento y la del código no se separan', () => {
  // Las pruebas corren desde la raíz del repositorio (`pnpm test`); si no, se busca hacia arriba.
  const ruta = ['.', '..', '../..', '../../..']
    .map((base) => resolve(process.cwd(), base, 'docs/producto/REQUERIMIENTOS.md'))
    .find((candidata) => existsSync(candidata));
  if (ruta === undefined) {
    throw new Error('No se encontró docs/producto/REQUERIMIENTOS.md');
  }
  const documento = readFileSync(ruta, 'utf8');
  const filas = documento
    .split('\n')
    .filter((linea) => linea.startsWith('|'))
    .map((linea) => linea.split('|').map((celda) => celda.trim()))
    .filter((celdas) => ETIQUETA_A_PERMISO.has(celdas[1] ?? ''));

  it('el documento trae las 13 filas', () => {
    expect(filas).toHaveLength(ETIQUETA_A_PERMISO.size);
  });

  it.each(filas)('fila: %s', (_vacio, accion, administrador, cajero) => {
    const permiso = ETIQUETA_A_PERMISO.get(accion);
    if (permiso === undefined) throw new Error(`fila sin permiso: ${accion}`);
    expect(PERMISSION_MATRIX[permiso]).toEqual({
      ADMIN: aDecision(administrador),
      STAFF: aDecision(cajero),
    });
  });
});
