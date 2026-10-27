# ADR-0007: Facturación detrás de una interfaz; el PAC real se conecta al final

- **Estado:** Aceptada
- **Fecha:** 2026-10-26
- **Decide:** Juanito

## Contexto

- Faltan los datos fiscales y el CSD de ZAMMIR (PD-04) y no se ha elegido PAC (PD-05).
- Juanito quiere construir todo el sistema primero y dejar las conexiones externas para la última semana.
- El documento original pedía probar la integración con el PAC en la primera semana [DC §0 regla 3].

## Decisión

- El sistema habla con una **interfaz de facturación** propia (timbrar, cancelar, consultar), nunca directamente con un PAC.
- Durante la construcción se usa un **adaptador simulado** que responde como un PAC, para desarrollar y probar todo el flujo de M10.
- Cuando se elija el PAC, se escribe su adaptador real, se prueba en su entorno de pruebas y, al recibir el CSD, se cambia a producción con variables de entorno.

## Consecuencias

- Cambiar de PAC en el futuro es escribir otro adaptador, no modificar el sistema.
- **Riesgo aceptado:** al no probar el PAC real desde la semana 1, una sorpresa de su API aparece tarde. Se mitiga eligiendo el PAC al menos una semana antes del cierre y diseñando la interfaz con base en el estándar CFDI, no en un PAC específico.
- El trámite del CSD depende del cliente; hay que pedirlo desde ya (PD-04).
