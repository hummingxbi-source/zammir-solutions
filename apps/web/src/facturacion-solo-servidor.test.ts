import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** El PAC solo se llama desde funciones del servidor: el navegador (la tablet y el portal público) nunca
 *  habla con él ni tiene su adaptador [S4-13, RF-M10-01, RF-M10-02]. Esta prueba falla si algún archivo de
 *  la aplicación web, fuera de las muestras de desarrollo y de las pruebas, usa el adaptador o llama al
 *  puerto de facturación. */
function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const RAIZ = join(process.cwd(), 'apps', 'web', 'src');

describe('la facturación solo se llama desde el servidor', () => {
  const codigo = archivos(RAIZ).filter(
    (ruta) =>
      /\.(ts|tsx)$/.test(ruta) &&
      !/\.test\.(ts|tsx)$/.test(ruta) &&
      !relative(RAIZ, ruta).startsWith('dev'),
  );

  it('hay código que revisar', () => {
    expect(codigo.length).toBeGreaterThan(50);
  });

  it('ningún archivo de la aplicación usa el adaptador ni llama al puerto', () => {
    const infractores = codigo.filter((ruta) => {
      const texto = readFileSync(ruta, 'utf8');
      return /simulatedBilling|\bBillingProvider\b|billing\.(stamp|cancel|download|getStatus)\(/.test(
        texto,
      );
    });
    expect(infractores.map((r) => relative(RAIZ, r))).toEqual([]);
  });
});
