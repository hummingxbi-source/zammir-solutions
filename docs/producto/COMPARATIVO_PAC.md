# Comparativo de proveedores de timbrado (PAC) — PD-05

> Preparado el 14 de noviembre de 2026 para que **Juanito decida**. Los precios salen de las páginas públicas de cada proveedor ese día y **pueden cambiar**: antes de contratar hay que confirmarlos en su portal. Los criterios son los de RF-M10-03.

## Lo que ZAMMIR necesita

- Hoy facturan **unas 8 facturas al mes** (unas 100 al año): el costo fijo pesa mucho más que el costo por timbre.
- HummingX prefiere **contratar el PAC e incluirlo en la anualidad** (PD-05): hace falta que admita **varios emisores** (ZAMMIR hoy; otros clientes después) con el certificado (CSD) guardado en el PAC.
- El sistema ya tiene el contrato `BillingProvider` y un adaptador simulado [ADR-0007]; el adaptador real es una pieza acotada (S4-15).

## Comparativo

| Criterio | Facturama | Facturapi | SW Sapien |
|---|---|---|---|
| API REST documentada | Sí | Sí (documentación y guía de inicio) | Sí (portal de desarrolladores) |
| Entorno de pruebas (sandbox) | **Gratis**, sin tarjeta; en producción solo se cambia el host | **Por confirmar** (no lo vi explícito en lo público) | No se confirmó en lo público |
| CFDI 4.0 y cancelación | Sí | Sí | Sí (con cancelación) |
| Varios emisores | **Incluido** en el módulo API (cada emisor registra su CSD) | **Incluido**, sin costo por emisor | Se negocia |
| CSD guardado en el PAC | Sí (por emisor) | Sí (por organización) | Sí (API de gestión de CSD) |
| Costo fijo | **$1,650 MXN al año** (módulo API + multiemisor) | **$299 MXN al mes** ($3,588 al año) | Por contrato |
| Costo por timbre | Desde **$0.50 MXN** (con IVA), baja con volumen | **$0.60 MXN** | Lo que se acuerde en el pedido (no hay lista pública para API; los paquetes publicados son para Odoo) |
| Costo al año con ~100 facturas | **≈ $1,700 MXN** | **≈ $3,650 MXN** | No se puede estimar sin cotización |
| Autofactura propia | No hace falta: el sistema ya tiene su portal | Su producto de autofactura cuesta aparte; **no se necesita** | — |

## Recomendación

**Facturama**, por costo: con el volumen de ZAMMIR sale **menos de la mitad** que Facturapi al año, incluye varios emisores y tiene sandbox gratuito. Facturapi tiene una documentación cuidada, pero su cuota mensual pesa con tan pocas facturas. SW Sapien no publica tarifas para API: solo sirve si se quiere pedir cotización.

El adaptador no cambia nada del resto del sistema, así que **si Facturama no convence se puede cambiar de proveedor** escribiendo otro adaptador.

## Lo que no pude confirmar (y hay que revisar en el portal antes de pagar)

1. Si el **sandbox de Facturapi** existe como el de Facturama (solo importa si se prefiere ese proveedor).
2. Si los **folios caducan** y qué pasa con los no usados al renovar el módulo API.
3. Si hay **límite de emisores o de folios** en el plan API de Facturama.
4. El precio vigente del módulo API y de los folios (las páginas se contradicen en algún detalle).
5. Que la **situación fiscal de HummingX** permita contratar el servicio a su nombre y facturar el cobro a ZAMMIR (PD-05).

## Siguiente paso

Si Juanito está de acuerdo: crear la cuenta de Facturama (a nombre de HummingX), abrir el **sandbox** y avisar para construir el adaptador (S4-15) y probar timbrado de prueba. El certificado de ZAMMIR (CSD) se sube al PAC solo cuando ZAMMIR tenga su e.firma vigente (PD-04) y **nunca pasa por el código** [RF-M10-02].

Fuentes consultadas: [Facturama, módulo API y folios](https://facturama.mx/planes-facturacion), [Facturama, documentación del sandbox](https://facturama.mx/docs/es/bienvenidos), [Facturapi, precios](https://www.facturapi.io/pricing), [SW Sapien, tienda de timbres](https://tienda.sw.com.mx/shop) y [SW Sapien, términos y condiciones](https://sw.com.mx/hubfs/T%C3%A9rminos%20y%20Condiciones%20SW.pdf).
