# Auditoría e implementación: cotizaciones, pedidos, aprobación y notificaciones

Fecha de revisión: 2026-09-13 (America/Lima)

## 1. Resumen ejecutivo

El proyecto usa Next.js 15, React 19 y TypeScript en el frontend; NestJS 11, TypeORM 0.3 y MySQL/InnoDB en el backend. La pantalla `/cotizacion` era solo visual: mantenía cliente y líneas en memoria y generaba un PDF antes de existir una operación persistida. `register-requested` registraba pedidos y reservas, pero no podía consumir una cotización. Además, los endpoints principales de pedidos confiaban en identificadores de usuario enviados por el navegador.

Se incorporó persistencia transaccional de cotizaciones, correlativos anuales bloqueados, historial, relación de líneas con pedidos, consumo parcial y validación concurrente. Se centralizó el cierre de sesión en el contexto de autenticación y se protegieron rutas de pedidos con JWT y roles. Las notificaciones de aprobación y rechazo ahora se entregan al vendedor responsable y al jefe de ventas después del commit.

## 2. Flujo implementado

1. El vendedor abre `/cotizacion`, busca o registra un cliente en el modal y agrega producto/talla/cantidad.
2. El frontend envía identificadores y valores monetarios como cadenas decimales.
3. El backend valida usuario, vendedor, cliente, almacén, producto, talla, stock disponible, precio mayorista y duplicados.
4. Dentro de una transacción bloquea `QuotationSequences`, genera `CO-AAAA-NNNNNN`, guarda cabecera, detalle e historial.
5. Solo después de recibir la cotización persistida el frontend genera el PDF con el número y detalle devueltos por el servidor.
6. En `/register-requested` se filtran cotizaciones por cliente y vendedor. El usuario elige líneas y cantidades parciales.
7. Al crear el pedido, el backend bloquea cotización, líneas y stock; vuelve a validar cantidades pendientes, usa el precio histórico, reserva stock y actualiza `PARTIALLY_USED` o `USED` en la misma transacción.
8. El jefe de ventas aprueba o rechaza. El rechazo exige motivo, libera reservas y registra historial. El evento se emite después del commit.

## 3. Modelo aplicado

- `QuotationSequences`: correlativo anual con actualización bloqueada.
- `OrderSequences`: reemplazo transaccional del patrón inseguro `MAX + 1` para proformas.
- `Quotations`: cabecera, número e idempotencia únicos, cliente, vendedor, almacén, importes DECIMAL, fechas UTC/Perú, estado, versión y auditoría.
- `QuotationDetails`: snapshots históricos, cantidad cotizada/utilizada, precio, descuento, impuesto y total DECIMAL.
- `QuotationHistory`: cambios de estado con usuario y fechas UTC/Perú.
- `Orders.quotation_id`: relación opcional con una cotización.
- `Order_Details.quotation_detail_id/source_type`: trazabilidad por línea; se conservan líneas manuales.

La decisión aplicada es una cotización por pedido, permitiendo líneas manuales. Admitir varias cotizaciones en un pedido queda como ampliación futura porque requiere cambiar el contrato y la experiencia de revisión.

## 4. Endpoints

| Método | Ruta | Uso | Permiso |
|---|---|---|---|
| POST | `/quotations` | Emitir cotización | Administrador, Jefe Ventas, Vendedor, Vendedor Web, Tienda |
| GET | `/quotations` | Listar/filtrar cotizaciones | mismos roles, con alcance por vendedor |
| GET | `/quotations/:id` | Detalle e historial | propietario o jefe/administrador |
| POST | `/quotations/:id/cancel` | Anular con motivo | propietario o jefe/administrador |
| GET | `/quotations/reports/summary` | Resumen por periodo/estado/vendedor | jefe/administrador |
| POST | `/orders` | Crear y reservar | autenticado y autorizado |
| POST | `/orders/:id/approve` | Aprobar | jefe/administrador |
| POST | `/orders/:id/reject` | Rechazar con motivo | jefe/administrador |

## 5. Hallazgos y estado

| Severidad | Hallazgo y evidencia | Impacto | Estado |
|---|---|---|---|
| Crítica | `orders.controller.ts` no exigía JWT/roles en todas las operaciones y el body contenía IDs de aprobador | Suplantación y aprobación manual | Corregido |
| Crítica | `cotizacion/page.tsx` generaba PDF solo con estado local | Documento sin operación auditable | Corregido |
| Alta | `orders.service.ts` calculaba proforma leyendo el último pedido | Duplicados bajo concurrencia | Corregido con `OrderSequences` |
| Alta | No existían tablas de cotización ni relación con pedidos | Sin trazabilidad ni consumo parcial | Corregido |
| Alta | El cierre de sesión vaciaba `user` mientras páginas seguían renderizando `user!` | Error solo en ciertos layouts/pantallas | Corregido en `UserContext` y `ClientLayout` |
| Alta | Aprobación/rechazo no notificaba al vendedor y podía avisarse sin esperar commit | Información tardía o falsa | Corregido |
| Media | El buscador de productos devuelve el costo de fabricación en `price` a cualquier usuario autenticado | Exposición comercial | Pendiente: separar contrato interno y de venta antes de retirar el campo para no romper registro de stock |
| Media | Pedidos manuales permiten precio distinto al catálogo; no hay política documentada de descuentos/excepciones | Manipulación o bloqueo de descuentos legítimos | Pendiente de definición funcional; cotizaciones de vendedor sí validan precio mayorista |
| Media | No existe edición formal de una cotización emitida | Correcciones requieren anular y reemitir | Decisión aplicada: emitida es inmutable; evaluar borradores/versionado |
| Media | No existe trabajo programado que materialice `EXPIRED`; disponibilidad sí excluye por fecha | Reporte de estado puede conservar `ISSUED` después de vencer | Pendiente: job diario o estado calculado con historial técnico |
| Baja | Varias pantallas/reportes tienen paquetes iniciales grandes | Rendimiento inicial | Recomendada división dinámica de PDF/Excel |

## 6. Reportes

| Reporte | Estado actual | Backend faltante | Frontend faltante | Prioridad |
|---|---|---|---|---|
| Cotizaciones por periodo/estado/vendedor | Lista y Excel implementados con datos reales | resumen avanzado por cliente/producto | completado para filtros principales | Alta |
| Conversión cotización a pedido | datos relacionados disponibles | consulta agregada | pantalla | Alta |
| Productos más cotizados | no implementado | agregación e índice si crece | pantalla/exportación | Media |
| Pedidos pendientes/aprobados/rechazados | existente | paginación real | revisar tamaño de paquete | Media |
| Tiempo promedio de aprobación | no implementado | consulta desde historial | pantalla | Media |
| Auditoría de anulaciones/estados | historial persistido | filtro paginado | vista administrativa | Media |

## 7. Logout y notificaciones

No existe endpoint de revocación en el backend; la sesión actual usa JWT sin estado. El logout ahora desconecta Socket.IO, emite `auth:logout`, limpia `localStorage`, `sessionStorage` y cookies, desmonta inmediatamente rutas protegidas y redirige con `replace + refresh`. La revocación inmediata de tokens antes de su expiración requeriría una lista de revocación o sesiones persistentes.

El socket valida JWT y usuario activo. Jefe/administrador ingresan a la sala de contadores; vendedores ingresan solo a su sala personal. `order:updated` contiene estado y proforma, y se emite después de confirmar la transacción.

## 8. Pruebas y evidencia

- Backend final: 9 suites / 49 pruebas aprobadas, incluidas 4 pruebas de aprobación/rechazo y 3 de cotizaciones.
- Pruebas específicas nuevas: 2 suites / 7 pruebas aprobadas.
- Compilación NestJS de producción: aprobada.
- Arranque real NestJS contra la base configurada: aprobado; TypeORM cargó entidades y se mapearon las rutas de cotizaciones.
- Compilación Next.js de producción: aprobada, 48 rutas generadas.
- TypeScript frontend sin emitir: aprobado.
- `git diff --check`: sin errores; solo avisos de normalización LF/CRLF.
- MySQL 9.4: migración aplicada; 5 tablas nuevas verificadas.
- Integridad: índices únicos de número, idempotencia y año/secuencia; claves foráneas y restricciones CHECK verificadas.
- Datos: `Quotations`, `QuotationDetails` y `QuotationHistory` permanecieron en 0 filas después de la verificación; no se alteraron datos comerciales.

## 9. Decisiones pendientes

1. Definir límites de descuento y quién puede sobrescribir precio en pedidos manuales.
2. Confirmar si un pedido podrá consumir varias cotizaciones. Recomendación actual: mantener una para reducir ambigüedad y concurrencia.
3. Definir si la vigencia son 7 días calendario o hábiles. Implementación actual: 7 días calendario.
4. Definir edición de borradores. Implementación actual: una cotización emitida se conserva inmutable; se anula y reemite.
5. Definir revocación de JWT para cierre de sesión inmediato a nivel servidor.
6. Crear UI de reportes de cotizaciones y conversión sobre los endpoints reales ya disponibles.

## 10. Seguridad operativa pendiente

El archivo `.env` permanece rastreado por Git aunque ya fue agregado a `.gitignore`. Debe retirarse del índice e historial con un procedimiento coordinado y rotar credenciales/tokens. No se realizó automáticamente porque puede afectar despliegues y requiere autoridad sobre los secretos de producción.
