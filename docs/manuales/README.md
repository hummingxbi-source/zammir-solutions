# Manuales

| Documento | Para quién | Estado |
|---|---|---|
| [`MANUAL_DE_USUARIO.md`](MANUAL_DE_USUARIO.md) | Cajeros, vendedores y administradores de ZAMMIR | Borrador [S4-29] |
| [`MANUAL_DE_SOPORTE.md`](MANUAL_DE_SOPORTE.md) | Juanito (HummingX BI) y quien lo releve | Borrador [S4-29] |

Se revisan con Luis y el equipo en las capacitaciones del Sprint 5. El guion de pruebas de aceptación con el cliente está en [`../calidad/PLAN_DE_ACEPTACION_CLIENTE.md`](../calidad/PLAN_DE_ACEPTACION_CLIENTE.md).

## Capturas del manual de usuario

Las imágenes de `capturas/` **no se toman a mano**: las genera `scripts/capturas-manual.mjs`, que recorre la aplicación contra Supabase **local** con datos **inventados** (nunca datos reales ni producción). Se vuelven a generar cada vez que cambia la interfaz:

```bash
pnpm db:start
pnpm db:reset
pnpm --filter @zammir/web build
pnpm --filter @zammir/web exec vite preview --port 4180 --strictPort
pnpm manual:capturas
```

El segundo y tercer paso se corren en otra terminal (el último necesita la aplicación sirviéndose). Las funciones de servidor deben estar encendidas (`pnpm exec supabase functions serve --no-verify-jwt --env-file supabase/functions/pruebas.env`) para que la factura de prueba se pueda emitir.
