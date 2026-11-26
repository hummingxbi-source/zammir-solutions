# ADR-0045: Decisiones de la entrega: anticipo al cancelar, titularidad, rol del mostrador, repositorio, respaldo y expediente

- **Estado:** Aceptada
- **Fecha:** 2026-11-25
- **Decide:** Juanito (HummingX BI)
- **Resuelve:** PD-07; las decisiones D1, D2 y D4 del plan maestro de entrega; el titular de las cuentas (pregunta 70 del cuestionario)
- **Modifica:** [ADR-0010] (el repositorio del sistema sigue público hasta la entrega), [ADR-0043] punto 4 (sin *Required reviewers*; el respaldo lee sus secretos de un entorno propio)
- **Plan:** [`docs/entrega/PLAN_MAESTRO_DE_ENTREGA.md`](../entrega/PLAN_MAESTRO_DE_ENTREGA.md)

## Contexto

Al revisar el traspaso de la entrega del 28 al 30 de noviembre quedaron abiertas decisiones que le tocan a HummingX. También salieron tres huecos que antes no se habían visto:

- El respaldo nocturno lee sus secretos del entorno `produccion` (`respaldo-nocturno.yml`). El plan pedía poner *Required reviewers* en ese entorno. Con esa regla, cada copia nocturna se detendría a esperar una aprobación.
- El respaldo solo copia la base (`public`, `auth.users` y `auth.identities`). Las **fotos de medición** del depósito `order-photos` no se copian.
- El repositorio es público. Las corridas de noviembre de *Integración continua* y *Mutación* suman unos 2,600 minutos, y la cuenta gratuita de un repositorio privado da 2,000 minutos al mes de Actions.

## Decisión

1. **Anticipo al cancelar una orden (PD-07).**
   - El anticipo es un pago a cuenta del trabajo y **no se devuelve en automático**.
   - Si la orden se cancela **En espera**, antes de cortar o comprar material, se recomienda devolverlo completo.
   - Si se cancela **En proceso** o **Listo**, con material ya cortado a medida, el anticipo se retiene para cubrir material y mano de obra. Luis o Ricardo pueden devolver una parte si lo consideran justo.
   - Lo decide siempre un administrador, y lo decidido se escribe en el motivo de la cancelación. El sistema ya guarda el motivo, el estatus del que se canceló y el anticipo pagado.
   - **El sistema no registra la devolución del anticipo de una orden.** El efectivo que se devuelva sale del cajón como faltante del corte, y el corte pide una explicación escrita (AJ-02). Registrar esa devolución queda como propuesta (PP-35).
   - La política se comunica a Luis el día de la entrega y queda escrita en el acta.
2. **Titularidad.**
   - Las cuentas de la plataforma (Supabase, Vercel, GitHub y Cloudflare), el **dominio** y el **código** quedan a nombre de **HummingX BI**, con su cuenta empresarial.
   - Los **datos** son de ZAMMIR. HummingX los trata por cuenta de ZAMMIR.
   - HummingX BI no está constituida como sociedad [RN-21]: por HummingX firman sus tres socios.
   - Las condiciones van en el contrato.
3. **Cuentas de administrador del sistema.** Las crea Juanito en el panel con Luis y Ricardo presentes, y cada uno escribe su propia contraseña. HummingX no la conoce. La aplicación no tiene una pantalla para cambiar la contraseña: si se olvida, Juanito la restablece desde el panel y la persona escribe una nueva.
4. **Rol de la tercera persona del mostrador (D4):** Cajero / vendedor, sin permisos de administrador.
5. **Repositorio (D2).** `hummingxbi-source/zammir-solutions` sigue **público hasta la entrega** y se vuelve **privado después de la entrega**, cuando baja la actividad y los minutos de Actions alcanzan. Hasta entonces, las copias del respaldo solo las protege su cifrado. Al pasarlo a privado se comprueba que Vercel siga desplegando.
6. **Respaldo.**
   - El respaldo nocturno lee sus secretos de un **entorno propio de GitHub, sin revisores**.
   - No se usan *Required reviewers* en `produccion`: con el repositorio privado y la cuenta gratuita no existen.
   - El respaldo se amplía para copiar también las **fotos de medición**. El diseño va en el PR que lo construya.
7. **Equipo.** Una tablet Samsung Galaxy Tab A11+ va incluida en el contrato y ZAMMIR compró otra igual por su cuenta. HummingX configura las dos y las entrega con la carta de equipo (anexo C del acta). Las condiciones de cada una van en el contrato.
8. **Expediente de la entrega:** diez documentos en PDF, con la lista de [`PLAN_MAESTRO_DE_ENTREGA.md`](../entrega/PLAN_MAESTRO_DE_ENTREGA.md) §7. No hay consentimiento escrito para grabar: ZAMMIR lo dio de palabra.

## Consecuencias

- PD-07 queda resuelto (PR-35). El acta de entrega lleva la política del anticipo.
- Mientras el repositorio sea público, una copia cifrada se puede descargar, y su protección depende solo de `CLAVE_DE_RESPALDO`.
- El nombre completo del dueño se quitó de los documentos, pero sigue en el historial de git. Deja de estar expuesto cuando el repositorio pase a privado.
- Al pasar el repositorio a privado:
  - la mutación por PR (unos 35 minutos) y la integración continua (unos 10) cuentan contra los 2,000 minutos del mes. Si se acaban, también se detiene el respaldo, y hay que vigilarlos en GitHub (*Settings → Billing*);
  - ya no aplica la regla de GitHub que apaga los flujos programados de un repositorio público tras 60 días sin actividad.
- El depósito de fotos cuenta contra el almacenamiento del plan gratuito de Supabase. Se vigila en el panel [ADR-0038].
- El plan de soporte (canales y horario) se fija en el contrato. El horario de atención es de lunes a viernes, de 9:00 a 21:00.

## Alternativas consideradas

- **Volver privado el repositorio ya.** Descartada: con el ritmo de noviembre se acabarían los minutos de Actions antes de fin de mes, y con ellos el respaldo.
- **Código público y respaldo en un repositorio privado aparte.** Se propuso y Juanito prefirió esperar a la entrega para volver privado todo el repositorio.
- **Que el sistema registre la devolución del anticipo.** Descartada para esta entrega por riesgo de tiempo; queda como PP-35.
