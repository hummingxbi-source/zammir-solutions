# ADR-0018: Impresión de tickets en tres capas

- **Estado:** Aceptada como estrategia. El modelo de impresora y el resultado de la capa 1 se registran en un ADR nuevo al terminar la prueba de concepto del Sprint 0
- **Fecha:** 2026-10-27
- **Decide:** Juanito (adopta [DC §8.3])
- **Completa:** [ADR-0008]; sustituye la línea "Impresión de tickets: sin elegir" de [ADR-0014]

## Contexto

Imprimir tickets sin cables desde la tablet es el riesgo técnico principal del proyecto [DC §8], [R1]. Una página web solo puede hablar directamente con una impresora Bluetooth mediante **Web Bluetooth**, que existe en Chrome para Android y no en ningún navegador de iOS [DC §8.2]. Además, Web Bluetooth solo sirve con impresoras que exponen **Bluetooth de baja energía (BLE)** con un servicio GATT accesible; muchas impresoras baratas solo traen Bluetooth clásico aunque la caja diga "Bluetooth" [DC §8.3].

## Decisión

Un puerto `TicketPrinter` con una interfaz única y **tres adaptadores**, para cambiar de estrategia sin tocar el resto de la aplicación [DC §8.3]:

| Capa | Adaptador | Cuándo se usa |
|---|---|---|
| 1 (preferida) | **Web Bluetooth + ESC/POS** generado en el navegador | Impresora con BLE utilizable |
| 2 (respaldo) | **Vista de ticket de 80 mm en HTML o PDF** enviada al servicio de impresión de Android con `window.print()` | Si el fabricante ofrece servicio de impresión; muestra un diálogo y es menos fluida |
| 3 (último recurso) | **Compartir el ticket** como PDF o imagen por WhatsApp | Sin impresora disponible |

Requisitos de la capa 1 [DC §8.3]:
- HTTPS y un gesto del usuario para emparejar; reconectar sin selector cuando el navegador lo permita, y si no, un toque para elegir la impresora.
- Escritura en fragmentos pequeños con pausas, respetando el tamaño máximo de escritura del dispositivo.
- Acentos y ñ con la página de códigos que soporte la impresora (por ejemplo, CP858). Logo y QR como imagen raster ESC/POS. Ancho de 80 mm y corte automático al final.
- Estado siempre visible ("Impresora conectada" o "Desconectada") y botón "Prueba de impresión" en la configuración [RF-UX-06].

Las **plantillas** de ticket (venta, cobro de orden, corte) generan el contenido y son independientes de los adaptadores, que solo lo envían.

## Prueba de concepto obligatoria (Sprint 0)

Con la impresora real, **del lote que se va a comprar** [DC §8.4]:
1. Descubrir los servicios y características GATT (con una app tipo nRF Connect o una página de prueba). Algunas genéricas usan el servicio `18F0` con característica de escritura `2AF1`: es una pista, no una garantía.
2. Confirmar la característica de escritura y el tamaño de fragmento estable.
3. Imprimir texto con acentos y ñ, un logo y un QR legible.
4. Imprimir 30 tickets seguidos sin pérdidas ni desincronización.
5. Reconectar tras apagar y encender la impresora y tras bloquear la tablet.
6. Repetir con la tablet sin internet.

**Si el modelo no expone BLE utilizable, se avisa de inmediato a Juanito: ZAMMIR no compra más equipo hasta cambiar de modelo.**

## Consecuencias

- La batería de contrato de `TicketPrinter` corre contra un adaptador falso y, en la tablet real, contra los tres adaptadores.
- La impresión en tamaño carta del §8.5 **no** se construye [ADR-0005], [ADR-0017].
- El tiempo objetivo es de menos de 5 segundos entre cobrar y tener el ticket [RNF-26].
