# Revisión del proyecto — 22 de septiembre de 2026

## Alcance y resultado

Revisión estática de la arquitectura, API, autenticación, inventario, ventas, compras, caja, reportes, integración con bots y cliente Electron/React; ejecución de pruebas existentes y compilación. No se modificó la lógica del sistema ni se ejecutaron operaciones sobre los datos del negocio. No se verificaron visualmente todas las pantallas, la impresora, el instalador ni las integraciones externas en funcionamiento.

El proyecto tiene una estructura modular útil, pero presenta problemas de integridad de inventario y concurrencia que conviene resolver antes de ampliar funcionalidades. Compilar correctamente no garantiza que los saldos sean correctos.

## Arquitectura y aspectos positivos

- Monorepo npm: API Express/Prisma/PostgreSQL, cliente Electron/React/Vite y paquete compartido para constantes y reportes.
- Módulos separados para ventas, compras, productos, inventario, caja, usuarios, clientes, proveedores, reportes y bitácora.
- Contraseñas con bcrypt; tokens aleatorios; permisos comprobados en backend; invalidación de sesiones al cambiar usuarios o contraseñas.
- Uso de Decimal y transacciones en operaciones principales. La venta descuenta stock mediante actualización condicionada por existencia suficiente.
- La apertura de caja usa aislamiento Serializable para evitar aperturas simultáneas del mismo usuario.
- El cliente limita tiempos de espera y evita reintentar automáticamente escrituras cuya respuesta se perdió.
- Electron usa aislamiento de contexto y desactiva integración de Node en las ventanas examinadas.
- Los archivos locales de sesión de WhatsApp están ignorados por Git; no aparecieron versionados en la revisión del índice actual.

## Hallazgos prioritarios

### 1. Alta — Cancelar un compuesto devuelve el inventario al producto padre

Referencia: `apps/backend/src/modules/ventas/ventas.service.js`, `createSale` y `cancelSale` (línea 1201).

La venta de un compuesto descuenta sus componentes. La cancelación recorre los detalles y reintegra `detail.cantidadInventario` a `detail.productoId`, que corresponde al padre. Por ejemplo, cancelar un saco que consumió pierna y pechuga no repone esas existencias y crea stock en el saco.

Corrección: revertir los movimientos originales de esa venta, con las cantidades y productos efectivamente descontados. No reconstruirlos usando una receta que pudo cambiar después.

### 2. Alta — Compras y ajustes pueden sobrescribir movimientos simultáneos

Referencias: `compras.service.js:621`, `inventario.service.js:387` e `inventario-movil.service.js`, `applyMobileAdjustments`.

Estos flujos leen el stock, calculan un saldo en memoria y lo escriben como valor absoluto sin bloquear previamente el producto ni usar aislamiento Serializable. Si una compra lee 10, una venta descuenta 2 y después la compra agrega 5 escribiendo 15, se pierde el descuento: deberían quedar 13. También puede perderse una actualización del costo promedio.

Corrección: coordinar todas las escrituras del producto mediante bloqueo o aislamiento apropiado, con reintento de conflictos. Los incrementos atómicos resuelven parte del problema, pero el costo promedio necesita la misma protección.

### 3. Alta — Los lotes PEPS no mantienen consistencia con todas las operaciones

Referencias: `ventas.service.js:262`, `consumeFifoCost`, `cancelSale`; servicios de inventario y compras.

- Dos ventas pueden leer el mismo lote y escribir el mismo saldo restante calculado: el stock total disminuye dos veces, pero el lote solo una.
- Cancelar una venta repone stock total sin reponer sus lotes consumidos.
- Los ajustes negativos y el consumo de componentes no reducen lotes; pueden quedar unidades en lotes que ya no existen físicamente.

Consecuencia: futuras ventas pueden tomar costos de lotes incorrectos, alterando la ganancia reportada aunque el stock global parezca razonable.

Corrección: registrar asignaciones de consumo por lote y operación, revertirlas al cancelar y establecer una política coherente para ajustes, componentes e inventario anterior a PEPS.

### 4. Alta — Dos cancelaciones simultáneas pueden duplicar la devolución

Referencia: `ventas.service.js`, `cancelSale`.

La función comprueba el estado antes de restaurar stock y solo al final marca la venta como cancelada, usando actualización por ID. Dos solicitudes pueden leer COMPLETADA y ambas incrementar inventario. La transacción por sí sola no impide esta secuencia.

Corrección: reclamar la transición de estado mediante actualización condicional o bloqueo, dentro de la misma transacción. Revisar el patrón equivalente en anulaciones de compras.

### 5. Alta — Cerrar caja no se coordina con ventas y retiros concurrentes

Referencias: `caja.service.js`, `createCashMovement` y `closeCashShift`; `ventas.service.js`, `createSale`.

El cierre calcula totales de una lectura y guarda el cierre sin impedir que otra solicitud, que ya vio la caja abierta, agregue una venta o un movimiento. El efectivo esperado guardado puede excluir esa operación. Dos retiros también pueden validar individualmente contra el mismo saldo disponible y, juntos, superarlo.

Corrección: coordinar cierre, cobros y movimientos mediante una misma estrategia de bloqueo del turno o serialización de operaciones, con manejo de conflictos.

### 6. Alta — El permiso de cancelaciones no coincide entre interfaz y API

Referencias: `apps/desktop/src/App.jsx`, módulo DEVOLUCIONES; `ventas.routes.js:19` y ruta `/:ventaId/cancelar`.

La pantalla de cancelaciones depende de DEVOLUCIONES, pero la API solo exige VENTAS. Un usuario con VENTAS puede cancelar por API aunque no tenga habilitada esa pantalla; un usuario con solo DEVOLUCIONES no puede usar las consultas de la pantalla.

Corrección: establecer permisos específicos y coherentes para consulta y cancelación, aplicados en el servidor, incluyendo la política sobre ventas de otros usuarios.

### 7. Media — Anular compras verifica stock global, no el lote comprado

Referencia: `compras.service.js`, `cancelPurchase`, desde la eliminación de `loteInventario`.

Se eliminan los lotes de la compra y se verifica únicamente que exista stock global suficiente. Una reposición posterior puede permitir anular una compra cuyo lote ya se consumió. Además, no se revierte el costo promedio de esa compra.

Corrección: validar el consumo del lote específico y definir la reversión de valoración; distinguir anulación de compra y devolución al proveedor.

### 8. Media — Créditos cancelados continúan como pendientes

Referencia: `ventas.service.js:1319`, `listCreditSales`.

La consulta filtra `creditoPagado: false` y pago CREDITO, pero no estado COMPLETADA. Una venta fiada cancelada sigue apareciendo como deuda pendiente.

Corrección: excluir ventas canceladas. Registrar también autor y fecha cuando se marca un crédito como pagado: actualmente el método solo cambia un booleano. El cobro separado como entrada de caja es una decisión explícita del código, no se considera un error por sí misma.

### 9. Media — La fecha del asistente queda congelada al iniciar el proceso

Referencia: `asistente.service.js:27`.

La fecha se interpola al declarar SYSTEM_PROMPT. Después de medianoche, un bot que no se reinició sigue interpretando hoy y ayer respecto de la fecha inicial.

Corrección: construir el contexto temporal en cada consulta. Además, las herramientas recortan categorías a 30 productos sin informar que el resultado está truncado, aunque su descripción promete todos; no sirven para afirmar totales completos de categorías mayores.

### 10. Media — Sesiones sin vencimiento y acceso QR opcionalmente público

Referencias: `auth/session.store.js` y `bots/whatsapp.bot.js`, ruta `/pair`.

Las sesiones viven en un Map sin caducidad: duran hasta logout, invalidación o reinicio y no se comparten entre procesos. La ruta de vinculación de WhatsApp solo exige clave si QR_PAGE_SECRET existe; si se omite, queda accesible a quienes alcancen ese puerto.

Corrección: agregar caducidad y definir persistencia según el despliegue; exigir protección de vinculación antes de exponer el servicio. No se inspeccionaron valores secretos ni se comprobó exposición pública real.

## Verificación ejecutada

- `npm run build`: correcto. Vite compiló 47 módulos.
- Pruebas backend: fallan en varios módulos. Se ejecutaron explícitamente los archivos `test/*.test.js` para excluir `src/bots/test-console.js`, que el comando genérico descubre como prueba aunque es un programa interactivo.
- Pruebas desktop: dos resultados aprobados y dos fallidos. `api.test.js` importa `getSalesReport`, exportación que ya no existe; la prueba de turnos espera números donde la implementación devuelve A/B/C.
- Hay mocks de backend sin `loteInventario` o `configuracionSistema`, pruebas de reportes que llaman a una función retirada y expectativas antiguas de horarios, CORS y nombre del sistema. Estos fallos no prueban por sí solos que la implementación vigente esté mal.
- La prueba de migraciones exige exactamente 11 migraciones y 24 tablas y falla antes de aplicar SQL. Se ejecutaron aparte todas las migraciones en una base PGlite temporal: **19 migraciones aplicadas y 28 tablas creadas**. Esto confirma la aplicación del historial en ese motor; no reemplaza una prueba de integración con el PostgreSQL del despliegue.
- Windows bloqueó inicialmente procesos con EPERM; compilación y pruebas se volvieron a ejecutar con permiso fuera del aislamiento. Los resultados descritos corresponden a esa ejecución, no al bloqueo inicial.
- No se ejecutó auditoría de vulnerabilidades del registro npm ni se certificó el empaquetado NSIS o las actualizaciones automáticas.

## Mantenimiento y operación

- README desactualizado: presenta PostgreSQL como futuro y no documenta la configuración y migración necesarias para arrancar, ni los procesos separados de bots.
- Reglas de horarios, recargos y nombres comerciales están distribuidas entre backend, frontend y reportes; conviene centralizar las que deban coincidir y probar los límites horarios.
- La notificación de cierre usa un timer de cinco minutos en memoria. El propio código documenta que se pierde si el proceso reinicia; una cola persistente sería necesaria si se exige entrega garantizada.
- La bitácora se escribe después del commit en varias operaciones. Si falla, se puede responder error aunque el cambio del negocio ya esté guardado; conviene hacerla transaccional o distinguir ese fallo.
- No se verificó una política externa de respaldo/restauración. Debe documentarse y probarse antes de considerar cubierta la recuperación ante pérdida de datos.

## Orden de trabajo sugerido

1. Reparar cancelación de compuestos, reversión de lotes y permisos de cancelación.
2. Unificar la estrategia de concurrencia para stock, lotes y caja; probar operaciones simultáneas sobre PostgreSQL aislado.
3. Corregir créditos cancelados y semántica de anulaciones de compras.
4. Actualizar pruebas a los contratos vigentes y agregar regresiones de los problemas anteriores, sin limitarse a cambiar expectativas para que pasen.
5. Resolver sesiones, fecha del asistente, vinculación QR y documentación de instalación/operación.
