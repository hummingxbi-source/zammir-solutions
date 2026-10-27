# Seguridad y datos personales

> Versión inicial. Se amplía en la Fase 2 con el modelo de permisos (RLS) y la autenticación por dispositivo.

## Secretos

- Nunca se suben claves, tokens, contraseñas, certificados ni el CSD al repositorio [DC §0 regla 7].
- Se usan variables de entorno. El repositorio solo incluye `.env.example` con nombres y sin valores reales.
- Las claves de producción solo viven en la configuración de Vercel y Supabase.
- Si un secreto se sube por error: se revoca y se rota de inmediato. Borrarlo del historial no basta.

## Datos de clientes de ZAMMIR

- Prohibido usar datos reales en pruebas, semillas, capturas o documentación [ADR-0010].
- Prohibido pegar datos reales de clientes en herramientas de IA [DC §0 regla 7].
- Los datos fiscales se transfieren al PAC solo para facturar, y así lo declara el aviso de privacidad [DC RF-M9-05].
- Las solicitudes de acceso, rectificación, cancelación u oposición se atienden con anonimización, conservando lo que la ley exige para registros contables y fiscales [DC RF-M5-05].

## Accesos

- Cada persona tiene su propio usuario; nunca se comparten [DC §4].
- Los PIN se guardan con hash y solo funcionan en dispositivos registrados [DC §4].
- Los permisos se aplican en el servidor (base de datos), no solo ocultando botones en la interfaz.
- Las acciones sensibles quedan en bitácora [RN-19].

## Reportar un problema

Cualquier sospecha de fuga de datos o secreto expuesto se reporta de inmediato a Juanito.
