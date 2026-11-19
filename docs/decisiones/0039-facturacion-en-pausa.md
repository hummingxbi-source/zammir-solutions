# ADR-0039: Facturación en pausa hasta que ZAMMIR tenga en orden sus datos fiscales

- **Estado:** Aceptada
- **Fecha:** 2026-11-19
- **Decide:** Luis (dueño de ZAMMIR), comunicado por Juanito
- **Modifica:** [ADR-0007] (el PAC real ya no se conecta al final de este proyecto, sino cuando se reactive); [ADR-0019] (el CSD y el PAC dejan de estar en el camino crítico de la entrega)
- **Relacionada:** [ADR-0040] (hoja tamaño carta en lugar de ticket térmico)

## Contexto

ZAMMIR todavía no tiene en orden sus datos fiscales: no está confirmada la e.firma, falta la constancia de situación fiscal y no hay CSD (PD-04). Su contador dará de alta esos datos más adelante, sin fecha. Sin ellos no se puede timbrar ninguna factura real, ni elegir con sentido al PAC (PD-05).

Ya está construido el puerto de facturación con su adaptador simulado, la facturación desde el sistema (camino A) y el portal público `/factura` (camino B). Nada de eso se desecha.

## Decisión

1. **El módulo M10 (facturación CFDI y autofacturación) queda en pausa.** No se elimina ni se rehace: se apaga con un interruptor de configuración, `FACTURACION`, que por omisión está **apagado**, igual que P1 y P2.
2. **Con el interruptor apagado:**
   - No aparece la sección Facturas ni los accesos a facturar desde una venta u orden.
   - La ruta pública `/factura` no ofrece el portal.
   - Los documentos (comprobante de venta, de trabajo y cotización) **no llevan QR, código de verificación ni leyenda de factura, y no mencionan la factura en ningún texto.**
   - Los timbres, el límite anual y el panel de timbres no se muestran.
3. **Con el interruptor encendido** reaparece todo lo anterior. Encenderlo es un cambio de configuración, no de código, pero solo se hace cuando existan CSD, PAC contratado y adaptador real (ver "Para reactivar").
4. **Las facturas durante la pausa las sigue haciendo el contador de ZAMMIR**, como hasta hoy. Esa es una regla de operación de Luis, no del sistema.
5. **No se contrata PAC ni se compra nada de facturación ahora.** La anualidad prevista (cerca de 1,650 pesos al año más folios) se pospone.
6. **Se aplazan** sin cancelarse: S4-14 (elegir el PAC y custodiar el CSD), S4-15 (adaptador del PAC elegido), S5-02 (CSD y adaptador en producción) y la parte de producción de PD-04 y PD-05.

## Para reactivar

Se necesita, en este orden:
1. Constancia de situación fiscal, confirmación de la e.firma y contacto del contador (PD-04).
2. CSD tramitado en el SAT por Luis (gratuito, con su e.firma).
3. PAC elegido y contratado; HummingX BI propuso contratarlo para ahorrarle ese trámite a Luis (PD-05). Antes de pagar, cerrar los puntos abiertos de `COMPARATIVO_PAC.md`, entre ellos cómo se reparten los folios cuando hay varios emisores y cómo se pone por escrito la custodia y la revocación del CSD.
4. Adaptador real probado contra el entorno de pruebas del PAC (S4-15).
5. Sesión conjunta con Luis para subir el CSD directo al PAC [RF-M10-02]; la contraseña la escribe él.
6. Aceptación de E5 y E6 y luego encender `FACTURACION`.

## Consecuencias

- Los requerimientos de M10 y los pendientes de facturación siguen vigentes, pero **no bloquean la entrega**: se marcan "en pausa [ADR-0039]".
- Las pruebas de aceptación E5 y E6 (facturación) salen de la entrega y pasan a la reactivación.
- El dominio (PD-10) deja de depender de los QR impresos mientras la pausa dure; rutas y dominio se siguen cuidando por el día en que se reactive [RNF-37].
- El aviso de privacidad no declara al PAC mientras no exista (RF-M9-05 queda en pausa con el módulo).
- Queda construido, probado y apagado un módulo que no se usa; se acepta ese costo a cambio de no rehacerlo.
- Hay que avisar a Luis que, durante la pausa, ZAMMIR sigue dependiendo de su contador para facturar.
