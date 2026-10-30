# Sprint 1 — Núcleo del dominio, catálogo, clientes y usuarios (2 – 8 nov)

> Plan: [`docs/plan/fase-05-sprint-1-nucleo-catalogo-usuarios.md`](../plan/fase-05-sprint-1-nucleo-catalogo-usuarios.md). Formato y tallas: [`README.md`](README.md).
> **Objetivo:** el dinero que nunca se equivoca, las reglas de precio, un catálogo limpio, la ficha de clientes y la entrada de empleados con PIN.
> **Entra si:** Sprint 0 cerrado en verde; ADR-0011 aceptada y tabla de casos de oro validada (`docs/calidad/CASOS_DE_ORO_DINERO.md`).

### S1-01 · Dinero en centavos · M · 4 h
Como Juanito (desarrollador)
quiero un tipo `Money` con aritmética en centavos enteros
para que ningún total salga con errores de flotantes.
- **Requerimientos:** RNF-33 · **Reglas:** RN-05, RN-07 · **Decisión:** ADR-0004, ADR-0015
- **Criterios de aceptación:**
  - Dados dos montos, cuando se suman, restan o multiplican por cantidad, entonces el resultado es exacto en centavos.
  - Dado un monto no entero en centavos o fuera de rango seguro, cuando se crea, entonces se rechaza con un error tipado.
  - Dado un monto, cuando se formatea, entonces da `$1,234.56`, incluidos cero y montos grandes.
  - Dados montos cualesquiera, cuando se propone una propiedad, entonces la suma es conmutativa y asociativa y sumar y restar lo mismo regresa al original.
  - Dado el módulo, cuando se mide, entonces tiene 100 % de líneas y ramas y mutación ≥ 90 %.

### S1-02 · Medidas en milímetros enteros · S · 2 h
Como cajero
quiero capturar ancho y alto en cm o m, con decimales
para que el sistema las guarde sin errores de redondeo.
- **Requerimientos:** RF-M2-02 (base) · **Reglas:** RN-04
- **Criterios de aceptación:**
  - Dado `125.5 cm` o `1.255 m`, cuando se convierte, entonces da el mismo valor en mm enteros sin pasar por flotantes en el resultado.
  - Dada una medida cero, negativa o mayor al límite configurable, cuando se captura, entonces se rechaza con error tipado.
  - Dadas dos medidas, cuando se calcula el área, entonces se obtiene en mm² enteros para combinaciones típicas y extremas.

### S1-03 · Desglose de IVA y casos de oro · L · 8 h
Como administrador
quiero que el desglose de IVA sea idéntico en ticket, PDF y factura
para que todo cuadre al centavo.
- **Requerimientos:** RNF-33 · **Reglas:** RN-06, RN-07 · **Decisión:** ADR-0004, ADR-0011 · **Riesgo:** R12 (tolerancia del PAC)
- **Criterios de aceptación:**
  - Dada la tabla de casos de oro de dinero, cuando corre `TaxCalculator`, entonces todos los casos (L1 a L4, T1 a T6, D1, D2, A1, A2) dan exactamente el valor de la tabla.
  - Dado un conjunto de líneas, cuando se desglosa, entonces subtotal + IVA = total al centavo (propiedad).
  - Dado un producto exento, cuando se desglosa, entonces el IVA es cero y la base es igual al total.
  - Dado un documento con productos exentos y gravados, cuando se desglosa, entonces la suma coincide con el total.
  - Dada una tasa distinta en configuración, cuando se desglosa, entonces la usa sin tocar código.
  - Dado un anticipo, cuando se calcula, entonces se redondea hacia arriba y el saldo es la resta [ADR-0011].
  - Dado el módulo, cuando se mide, entonces tiene 100 % de líneas y ramas y mutación ≥ 90 %.

### S1-04 · Reglas de precio como estrategias · L · 8 h
Como administrador
quiero que cada producto calcule su importe con una regla de precio configurable
para poder cambiar las reglas sin tocar el código.
- **Requerimientos:** RF-M1-01 (regla asignada) · **Reglas:** RN-01, RN-02, RN-04 · **Decisión:** ADR-0006 · **Pendientes:** PD-02 (regla básica sin mínimos), PD-25 (metro lineal: largo capturado o perímetro, configurable)
- **Criterios de aceptación:**
  - Dado un producto por m², cuando se calcula `1.20 m × 0.80 m` a `$280.00`, entonces el importe es `$268.80` y el detalle dice `1.20 m × 0.80 m = 0.96 m² × $280.00 = $268.80`.
  - Dados productos por metro lineal, pieza y servicio, cuando se calculan, entonces dan el importe de la tabla de casos de oro.
  - Dados área mínima, redondeo de medida y mínimo encendidos en pruebas, cuando se calcula, entonces se aplican; en producción están apagados por defecto.
  - Dado un parámetro inválido o una regla no registrada, cuando se calcula, entonces devuelve un error tipado.
  - Dada una regla nueva de prueba, cuando se registra, entonces no se modifica ninguna regla existente.
  - Dado el módulo, cuando se mide, entonces tiene 100 % de líneas y ramas y mutación ≥ 90 %.

### S1-05 · Catálogo: modelo y categorías iniciales · M · 4 h
Como administrador
quiero el catálogo con sus categorías y datos fiscales predeterminados
para que cada producto nazca completo.
- **Requerimientos:** RF-M1-01, RF-M1-02 · **Reglas:** RN-01, RN-06, RN-28 · **Pendientes:** PD-29 (claves SAT de prueba por categoría), PD-06 (garantía sugerida opcional)
- **Criterios de aceptación:**
  - Dado el catálogo, cuando se crea una base nueva, entonces trae las categorías de RF-M1-02 con valores fiscales de prueba.
  - Dado un producto, cuando se guarda, entonces tiene código opcional, nombre, categoría, tipo, unidad de cobro, precio con IVA incluido en centavos, estado y regla de precio.
  - Dado el repositorio de productos, cuando corre la batería de contrato, entonces pasan memoria y Supabase la misma.
  - Dado un producto, cuando se pide su lectura para vender, entonces `ProductReader` no expone lo de administración.

### S1-06 · Catálogo: alta, edición, desactivación e historial de precios · M · 4 h
Como administrador
quiero dar de alta, editar y desactivar productos sin intervención técnica
para mantener limpio mi catálogo sin borrar nada.
- **Requerimientos:** RF-M1-04, RF-M1-06 · **Reglas:** RN-18, RN-19 · **Notas:** PP-04 (descripción) y PP-05 (código automático) no aprobadas
- **Criterios de aceptación:**
  - Dado cualquier rol, cuando intenta borrar un producto, entonces el caso de uso y la base lo rechazan.
  - Dado un producto desactivado, cuando se busca para vender, entonces no aparece, pero se conserva en el historial.
  - Dado un cambio de precio, cuando se guarda, entonces queda historial y bitácora con valor anterior y nuevo.
  - Dado un cajero, cuando intenta editar catálogo o precios, entonces se rechaza.

### S1-07 · Catálogo: búsqueda tolerante y filtros · S · 2 h
Como cajero
quiero buscar un producto sin preocuparme por acentos ni mayúsculas
para encontrarlo rápido en el mostrador o en la obra.
- **Requerimientos:** RF-M1-03
- **Criterios de aceptación:**
  - Dado "vidrio", cuando se busca, entonces encuentra "Vídrio"; "TEMPLADO" encuentra "templado".
  - Dados filtros por categoría y tipo, cuando se combinan, entonces devuelven la intersección.

### S1-08 · Catálogo: importación CSV o Excel con vista previa · L · 8 h
Como administrador
quiero importar el catálogo desde un archivo con una plantilla y ver los errores antes de confirmar
para cargar los 50 a 150 productos sin capturar uno por uno.
- **Requerimientos:** RF-M1-05 · **Riesgo:** R4 · **Pendientes:** PD-03 (catálogo real, llega al final; mientras tanto, catálogo de prueba inventado)
- **Criterios de aceptación:**
  - Dado la plantilla descargable, cuando se llena con datos válidos y se importa, entonces los productos quedan en el catálogo.
  - Dado un archivo con filas inválidas (precio negativo, categoría inexistente, código duplicado, columnas faltantes, acentos), cuando se sube, entonces la vista previa muestra cada error con su fila y no importa nada hasta confirmar.
  - Dado un archivo con codificación con acentos, cuando se lee, entonces los acentos se conservan.
  - Dada la decisión de qué hacer con filas inválidas, cuando se documenta, entonces queda escrita en la historia y en la pantalla.

### S1-09 · Catálogo disponible sin conexión · M · 4 h  · `tablet`
Como cajero
quiero consultar el catálogo en la tablet aunque no haya internet
para cotizar en casa del cliente.
- **Requerimientos:** RF-M1-03, RNF-01, RNF-02 · **Decisión:** ADR-0012
- **Criterios de aceptación:**
  - Dado el catálogo descargado, cuando se corta la red, entonces se puede consultar y buscar.
  - Dado un cambio de precio en el servidor, cuando la tablet se reconecta, entonces recibe la versión nueva por cursor sin duplicar productos.
  - *(manual)* Buscar en el catálogo en modo avión en la tablet real.

### S1-10 · Clientes: ficha con validaciones · M · 4 h
Como cajero
quiero capturar un cliente con nombre y WhatsApp como mínimo
para cotizarle sin trabas.
- **Requerimientos:** RF-M5-01, RF-UX-07 · **Reglas:** RN-22 · **Decisión:** RNF-06 (la tablet no guarda todos los datos fiscales); formatos de RF-M10-13
- **Criterios de aceptación:**
  - Dado un cliente, cuando falta nombre o WhatsApp, entonces no se guarda; el resto es opcional.
  - Dado un teléfono, cuando no tiene 10 dígitos, entonces se rechaza.
  - Dado un RFC, cuando no tiene 12 o 13 caracteres, entonces se rechaza; vacío está permitido. El código postal fiscal exige 5 dígitos.
  - Dada una lista vacía, cuando se abre Clientes, entonces el estado vacío dice qué hacer.
  - Dado el repositorio de clientes, cuando corre la batería de contrato, entonces pasan memoria, IndexedDB y Supabase.

### S1-11 · Clientes: búsqueda y aviso de duplicados · S · 2 h
Como cajero
quiero que el sistema me avise si el teléfono ya existe
para no duplicar clientes.
- **Requerimientos:** RF-M5-04
- **Criterios de aceptación:**
  - Dado un teléfono ya registrado en otro formato (con espacios, guiones o lada), cuando se captura, entonces avisa del posible duplicado.
  - Dado un nombre parcial, cuando se busca, entonces encuentra al cliente rápido.

### S1-12 · Clientes: anonimización · S · 2 h
Como administrador
quiero corregir o anonimizar los datos de un cliente que lo solicite
para cumplir con sus derechos sobre sus datos.
- **Requerimientos:** RF-M5-05, RNF-14, RNF-15 · **Reglas:** RN-18, RN-19
- **Criterios de aceptación:**
  - Dado un cliente, cuando se anonimiza, entonces se borran sus datos personales y se conservan los registros contables y fiscales.
  - Dada la anonimización, cuando termina, entonces hay entrada de bitácora y `anonymized_at`.
  - Dado un cajero, cuando intenta anonimizar, entonces se rechaza.

### S1-13 · Aviso de privacidad versionado y su registro · M · 4 h
Como administrador
quiero editar el aviso de privacidad con versión y fecha, y registrar que se le informó al cliente
para cumplir con la ley.
- **Requerimientos:** RF-M9-01 (aviso versionado), RF-M9-03 · **Pendientes:** PD-12 (texto final; mientras tanto, borrador de HummingX)
- **Criterios de aceptación:**
  - Dado un aviso editado por un administrador, cuando se guarda, entonces crea una versión nueva con fecha de vigencia.
  - Dado un cliente nuevo, cuando se captura, entonces se registra la versión del aviso que se le informó.
  - Dado un cajero, cuando intenta editar el aviso, entonces se rechaza.

### S1-14 · Usuarios: alta, edición, desactivación y PIN · M · 4 h
Como administrador
quiero dar de alta empleados, asignarles rol y PIN y desactivarlos
para que cada quien tenga su acceso.
- **Requerimientos:** RF-M8-01, RF-M8-04 · **Reglas:** RN-18 · **Decisión:** ADR-0013
- **Criterios de aceptación:**
  - Dado un usuario nuevo, cuando se crea, entonces tiene rol, PIN y estado activo; el PIN nunca se guarda en claro (se inspecciona lo guardado).
  - Dado un PIN trivial (`0000`, `1234`, repetidos), cuando se asigna, entonces se rechaza.
  - Dado un usuario, cuando se desactiva, entonces no puede entrar y no se borra.
  - Dado un restablecimiento de PIN, cuando ocurre, entonces solo un administrador en línea lo hace y queda bitácora.
  - Dados 2 administradores y 5 empleados, cuando se crean, entonces no hay límite técnico.

### S1-15 · Entrada con PIN en la tablet registrada · L · 8 h  · `tablet` · ⛔ PD-22
Como cajero
quiero elegir mi nombre y teclear mi PIN en la tablet
para entrar sin internet.
- **Requerimientos:** RF-M4-08 (entrada), RNF-09 · **Decisión:** ADR-0013 · **Pendientes:** PD-22 (intentos y bloqueo: valores configurables sin valor fijo)
- **Criterios de aceptación:**
  - Dado un PIN correcto en un dispositivo registrado, cuando se teclea, entonces entra.
  - Dado un dispositivo no registrado o revocado, cuando se teclea el PIN, entonces no entra.
  - Dado un usuario desactivado, cuando se teclea su PIN, entonces no entra.
  - Dados los intentos fallidos configurados, cuando se superan, entonces hay bloqueo creciente con los valores de configuración.
  - Dado el verificador del PIN, cuando se revisa lo guardado en la tablet, entonces no está el PIN y se compara en tiempo constante.
  - *(manual)* Entrar con PIN sin internet en la tablet real.

### S1-16 · Cambio de usuario y bloqueo por inactividad · S · 2 h  · `tablet`
Como cajero
quiero cambiar de usuario en un toque y que la tablet se bloquee sola
para que nadie cobre con mi nombre.
- **Requerimientos:** RF-M4-08 · **Reglas:** RN-11
- **Criterios de aceptación:**
  - Dado el tiempo de inactividad configurado, cuando se cumple (reloj fijo), entonces vuelve a la pantalla de usuarios sin cerrar la sesión del dispositivo.
  - Dado un cambio de usuario, cuando se hace, entonces las acciones siguientes quedan atribuidas al nuevo usuario y lo capturado no se pierde.
  - *(manual)* Cambiar de usuario y esperar el bloqueo en la tablet.

### S1-17 · Autorización de administrador por PIN · S · 2 h
Como cajero
quiero pedirle a un administrador que autorice con su PIN una acción restringida
para poder seguir trabajando sin pedirle que tome la tablet.
- **Requerimientos:** RF-M2-03 (se usará), RF-M3-04, RF-M10-08 · **Decisión:** ADR-0013
- **Criterios de aceptación:**
  - Dado el PIN de un administrador activo, cuando autoriza, entonces la acción procede y queda `authorizedBy` en bitácora.
  - Dado el PIN de un cajero o uno incorrecto, cuando se intenta autorizar, entonces se rechaza.

### S1-18 · Matriz de permisos completa en dominio y base · L · 8 h
Como administrador
quiero que cada rol haga solo lo que la matriz permite
para que un cajero no vea reportes, precios ni cortes ajenos.
- **Requerimientos:** Matriz de permisos de `REQUERIMIENTOS.md`, RNF-10, RNF-11 · **Reglas:** RN-19 · **Pendientes:** PD-17 (mismos permisos para Luis y Ricardo, configurable)
- **Criterios de aceptación:**
  - Dada cada fila de la matriz y cada rol, cuando se evalúa en el dominio, entonces da el resultado esperado (una prueba por fila y rol).
  - Dada cada tabla con datos sensibles, cuando se consulta con cada rol por la base, entonces las políticas por rol dan el mismo resultado que el dominio.
  - Dadas las acciones sensibles de este sprint, cuando ocurren, entonces generan bitácora.

### S1-19 · Pantalla de bitácora consultable · S · 2 h
Como administrador
quiero consultar la bitácora con filtros
para revisar quién hizo qué.
- **Requerimientos:** RF-M8-03 · **Reglas:** RN-19
- **Criterios de aceptación:**
  - Dado un administrador, cuando abre la bitácora, entonces ve usuario, dispositivo, fecha en hora de México, acción y valores anterior y nuevo.
  - Dado un cajero, cuando intenta abrirla, entonces no tiene acceso.

### S1-20 · Aceptación E4 (PIN) y E8 (matriz) · S · 2 h
Como Juanito (desarrollador)
quiero automatizar la parte del Sprint 1 de los recorridos E4 y E8
para tenerlos listos al cerrar el sprint.
- **Requerimientos:** (aceptación) · **Reglas:** E4, E8 de `docs/calidad/PRUEBAS_DE_ACEPTACION.md`
- **Criterios de aceptación:**
  - Dados tres usuarios con PIN en la misma tablet, cuando cada uno realiza acciones, entonces cada acción queda atribuida a quien la hizo y el bloqueo por inactividad funciona.
  - Dados un cajero y un administrador, cuando intentan acciones de la matriz, entonces el cajero queda limitado en dominio y en base de datos.

### S1-21 · Cierre del Sprint 1 · S · 2 h  · `tablet`
Como Juanito (desarrollador)
quiero cerrar el sprint con la compuerta y la prueba de mutación completa
para empezar el cotizador sobre dinero que no se equivoca.
- **Reglas:** `00-principios` §5.2 · **Plan:** compuerta de salida de la fase 5
- **Criterios de aceptación:**
  - Dada la compuerta común, cuando se corre, entonces está en verde.
  - Dados dinero, IVA y reglas de precio, cuando se miden, entonces tienen 100 % de líneas y ramas y mutación ≥ 90 %.
  - Dada la tabla de casos de oro, cuando se corre, entonces pasa completa.
  - Dada la matriz de permisos, cuando se corre, entonces está probada fila por fila.
  - *(manual)* Lista de tablet firmada: PIN, cambio de usuario, bloqueo y catálogo en modo avión.
  - Dada la revisión, cuando termina, entonces la retrospectiva y la recalibración quedan registradas.
