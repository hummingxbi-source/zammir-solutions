import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Cabeceras de seguridad del despliegue en Vercel [PP-33, RNF-08, S5-07]. La política de contenido dice de dónde
 *  puede cargar cosas el navegador. Si se queda corta, la aplicación deja de hablar con Supabase. Si se afloja,
 *  pierde su protección. Esta prueba vigila las dos cosas. */
const RAIZ = process.cwd();

interface Cabecera {
  readonly key: string;
  readonly value: string;
}
interface Regla {
  readonly source: string;
  readonly headers: readonly Cabecera[];
}

const vercel = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as {
  readonly headers: readonly Regla[];
};
const generales = vercel.headers.find((r) => r.source === '/(.*)')?.headers ?? [];
const cabecera = (nombre: string): string | undefined =>
  generales.find((c) => c.key.toLowerCase() === nombre.toLowerCase())?.value;

const politica = new Map(
  (cabecera('Content-Security-Policy') ?? '')
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .filter((partes) => partes[0] !== '')
    .map(([nombre = '', ...valores]) => [nombre, valores]),
);
const fuentes = (directiva: string): readonly string[] => politica.get(directiva) ?? [];

describe('cabeceras de seguridad del despliegue', () => {
  it('se mandan las protecciones básicas en todas las rutas', () => {
    expect(cabecera('X-Content-Type-Options')).toBe('nosniff');
    expect(cabecera('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(cabecera('X-Frame-Options')).toBe('DENY');
    expect(cabecera('Permissions-Policy')).toMatch(/camera=\(self\)/);
    expect(cabecera('Permissions-Policy')).toMatch(/microphone=\(\)/);
  });

  it('la política de contenido cierra lo que no se usa', () => {
    expect(fuentes('default-src')).toEqual(["'self'"]);
    expect(fuentes('object-src')).toEqual(["'none'"]);
    expect(fuentes('base-uri')).toEqual(["'self'"]);
    expect(fuentes('form-action')).toEqual(["'self'"]);
    expect(fuentes('frame-ancestors')).toEqual(["'none'"]);
    expect(politica.has('upgrade-insecure-requests')).toBe(true);
  });

  it('ningún código se ejecuta desde texto: sin scripts en línea ni eval', () => {
    for (const directiva of ['default-src', 'script-src']) {
      expect(fuentes(directiva)).not.toContain("'unsafe-inline'");
      expect(fuentes(directiva)).not.toContain("'unsafe-eval'");
      expect(fuentes(directiva)).not.toContain('*');
    }
  });

  it('deja hablar con Supabase (datos, sincronización y fotos), con su propia letra y el trabajador sin conexión', () => {
    expect(fuentes('connect-src')).toEqual(
      expect.arrayContaining(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']),
    );
    expect(fuentes('img-src')).toEqual(
      expect.arrayContaining(["'self'", 'data:', 'blob:', 'https://*.supabase.co']),
    );
    expect(fuentes('font-src')).toEqual(["'self'"]);
    expect(fuentes('worker-src')).toEqual(["'self'"]);
    expect(fuentes('manifest-src')).toEqual(["'self'"]);
  });

  it('los documentos para imprimir llevan sus estilos dentro, así que se permiten estilos en línea', () => {
    const hoja = readFileSync(
      join(RAIZ, 'apps', 'web', 'src', 'modules', 'documents', 'infra', 'hoja-html.ts'),
      'utf8',
    );
    expect(hoja).toContain('<style>');
    expect(fuentes('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it('permite el reto de Cloudflare del portal de facturas, y nada más de fuera', () => {
    const portal = readFileSync(
      join(RAIZ, 'apps', 'web', 'src', 'modules', 'billing', 'ui', 'PortalDeFactura.tsx'),
      'utf8',
    );
    const origen = /https:\/\/challenges\.cloudflare\.com/.exec(portal)?.[0];
    expect(origen).toBe('https://challenges.cloudflare.com');
    expect(fuentes('script-src')).toEqual(["'self'", 'https://challenges.cloudflare.com']);
    expect(fuentes('frame-src')).toEqual(['https://challenges.cloudflare.com']);
  });

  it('la página de entrada no trae scripts en línea, que la política bloquearía', () => {
    const indice = readFileSync(join(RAIZ, 'apps', 'web', 'index.html'), 'utf8');
    const scripts = [...indice.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, atributos = '', cuerpo = ''] of scripts) {
      expect(atributos).toMatch(/\bsrc=/);
      expect(cuerpo.trim()).toBe('');
    }
  });
});
