import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Revisión de seguridad del código [S5-07, RNF-08 a RNF-13, RNF-19]: ningún secreto en el repositorio y nada
 *  secreto en el código que llega al navegador. El paquete ya compilado se revisa aparte con `pnpm check:bundle`. */
const RAIZ = join(process.cwd());

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

// Código de producción: ni pruebas ni sus ayudantes (los que importan `vitest`, que nunca llegan al navegador).
const esCodigo = (ruta: string): boolean =>
  /\.(ts|tsx)$/.test(ruta) &&
  !/\.(test|integracion\.test)\.(ts|tsx)$/.test(ruta) &&
  !readFileSync(ruta, 'utf8').includes("from 'vitest'");

describe('el código del navegador no conoce ningún secreto', () => {
  const codigo = [
    ...archivos(join(RAIZ, 'apps', 'web', 'src')),
    ...archivos(join(RAIZ, 'packages', 'core', 'src')),
  ].filter(esCodigo);

  it('hay código que revisar', () => {
    expect(codigo.length).toBeGreaterThan(100);
  });

  it('ningún archivo nombra una llave o variable solo del servidor', () => {
    const prohibidas =
      /SERVICE_ROLE|SUPABASE_DB_URL|PAC_API_KEY|PAC_API_URL|TURNSTILE_SECRET|PORTAL_HASH_PEPPER|sb_secret_/;
    const infractores = codigo.filter((ruta) => prohibidas.test(readFileSync(ruta, 'utf8')));
    expect(infractores.map((r) => relative(RAIZ, r))).toEqual([]);
  });

  it('de las variables de entorno solo se leen las públicas (VITE_*) y las de modo', () => {
    const web = codigo.filter((ruta) => relative(RAIZ, ruta).startsWith(join('apps', 'web')));
    const infractores = web.filter((ruta) =>
      /import\.meta\.env\.(?!VITE_|DEV\b|PROD\b|MODE\b|BASE_URL\b|SSR\b)/.test(
        readFileSync(ruta, 'utf8'),
      ),
    );
    expect(infractores.map((r) => relative(RAIZ, r))).toEqual([]);
  });

  it('el navegador nunca lee process.env ni crea un cliente con la llave de servicio', () => {
    const web = codigo.filter((ruta) => relative(RAIZ, ruta).startsWith(join('apps', 'web')));
    const infractores = web.filter((ruta) => readFileSync(ruta, 'utf8').includes('process.env'));
    expect(infractores.map((r) => relative(RAIZ, r))).toEqual([]);
  });
});

describe('el repositorio no guarda secretos', () => {
  const versionados = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\0')
    .filter(
      (ruta) =>
        ruta !== '' &&
        !/\.(png|jpe?g|gif|ico|woff2?|pdf|zip|lock)$/i.test(ruta) &&
        !ruta.includes('pnpm-lock'),
    );

  it('hay archivos que revisar', () => {
    expect(versionados.length).toBeGreaterThan(300);
  });

  const texto = (ruta: string): string => {
    try {
      return readFileSync(join(RAIZ, ruta), 'utf8');
    } catch {
      return '';
    }
  };

  it('ninguno tiene una llave privada, una llave de AWS ni una llave secreta de Supabase', () => {
    const patron =
      /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sb_secret_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}/;
    const infractores = versionados.filter((ruta) => patron.test(texto(ruta)));
    expect(infractores).toEqual([]);
  });

  it('ningún token JWT guardado da el rol de servicio', () => {
    const jwt = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]*/g;
    const infractores = versionados.filter((ruta) => {
      for (const m of texto(ruta).matchAll(jwt)) {
        try {
          const carga = JSON.parse(Buffer.from(m[1] ?? '', 'base64url').toString('utf8')) as {
            role?: string;
          };
          if (carga.role === 'service_role') {
            return true;
          }
        } catch {
          // No era un token de verdad.
        }
      }
      return false;
    });
    expect(infractores).toEqual([]);
  });

  it('.env.example documenta las variables sin ningún valor', () => {
    const lineas = texto('.env.example')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l));
    expect(lineas.length).toBeGreaterThan(10);
    expect(lineas.filter((l) => !/^[A-Z][A-Z0-9_]*=$/.test(l))).toEqual([]);
  });

  it('los archivos con valores reales (.env.local y similares) no están versionados', () => {
    expect(
      versionados.filter((r) => /(^|\/)\.env(\.[a-z]+)?$/.test(r) && !r.endsWith('.example')),
    ).toEqual([]);
  });
});
