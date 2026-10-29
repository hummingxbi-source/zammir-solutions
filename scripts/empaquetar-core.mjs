// Empaqueta packages/core en un solo archivo que Deno (funciones de Supabase) puede importar.
// Deno exige extensiones en las importaciones relativas y el núcleo no las lleva, por eso se empaqueta
// en lugar de importar los archivos fuente [ADR-0014, S0-17]. El resultado no se versiona.
import { build } from 'esbuild';

await build({
  entryPoints: ['packages/core/src/index.ts'],
  outfile: 'supabase/functions/_shared/core.mjs',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  mainFields: ['module', 'main'],
  logLevel: 'info',
});
