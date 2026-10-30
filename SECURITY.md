# Seguridad y datos personales

> Resumen de las reglas de seguridad. Los requerimientos completos están en `docs/producto/REQUERIMIENTOS_NO_FUNCIONALES.md` (RNF-08 a RNF-19) y la autenticación en `docs/arquitectura/AUTENTICACION.md` [ADR-0013].

## Secretos

- Nunca se suben claves, tokens, contraseñas ni certificados al repositorio [DC §0 regla 7].
- **El CSD de ZAMMIR (`.key` y su contraseña) se sube directamente al PAC.** Nunca se guarda en la base de datos, en el código ni en variables de entorno de HummingX [RF-M10-02], [DC §7.3].
- Se usan variables de entorno. El repositorio solo incluye `.env.example` con nombres y sin valores reales.
- Las claves de servicio solo viven en el servidor (Vercel, Supabase); nunca en el código del navegador [RNF-10].
- Si un secreto se sube por error: se revoca y se rota de inmediato. Borrarlo del historial no basta.

## Datos de clientes de ZAMMIR

- ZAMMIR es el responsable del tratamiento; HummingX es el encargado, bajo confidencialidad [RNF-14].
- Prohibido usar datos reales en pruebas, semillas, capturas o documentación [ADR-0010].
- Prohibido pegar datos reales de clientes en herramientas de IA [DC §0 regla 7]. **Ningún agente de IA tiene acceso a datos reales de producción** [RNF-19].
- Solo se capturan los datos que el negocio necesita; no se prevén datos sensibles [RNF-15].
- La tablet guarda lo mínimo: no guarda los datos fiscales de todos los clientes y depura lo antiguo ya sincronizado [RNF-06].
- Los datos fiscales se transfieren al PAC solo para facturar, y así lo declara el aviso de privacidad [DC RF-M9-05].
- Las solicitudes de acceso, rectificación, cancelación u oposición (ARCO) se atienden con corrección o anonimización, conservando lo que la ley exige para registros contables y fiscales [DC RF-M5-05].
- Los registros de errores no contienen datos personales [RNF-34].

## Accesos

- HTTPS siempre [RNF-08].
- Cada persona tiene su propio usuario; nunca se comparten [DC §4].
- Los PIN se guardan con hash y sal, con límite de intentos, y solo funcionan en dispositivos registrados [RNF-09], [ADR-0013].
- RLS en todas las tablas, con políticas por rol [RNF-10].
- Precios, totales, permisos y plazos se validan en el servidor, no solo en la pantalla [RNF-11].
- El portal público de autofacturación tiene límite de intentos por IP y por folio, verificación contra automatización, y nunca revela si un folio existe cuando el código falla [RF-M10-11].
- Las acciones sensibles quedan en bitácora [RN-19].
- Desarrollo seguro según OWASP Top 10 y dependencias actualizadas [RNF-13].

## Incidentes

- Cualquier sospecha de fuga de datos o secreto expuesto se reporta de inmediato a Juanito.
- Los incidentes que afecten datos se avisan a ZAMMIR **a más tardar en 72 horas** [RNF-18].
