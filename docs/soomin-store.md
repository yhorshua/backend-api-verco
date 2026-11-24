# Soomin Store

Soomin Store usa el canal ecommerce y no registra operaciones en `WebSales`.

## Configuración

- Slug público: `soomin-store`
- Warehouse creado por la migración: `Soomin Store Ecommerce`
- Catálogo: `GET /storefront/soomin-store/catalog`
- Pedido: `POST /storefront/soomin-store/orders`

El catálogo solo muestra productos que cumplan simultáneamente:

1. `Products.status = 1`
2. `Products.is_published = 1`
3. `Products.selling_price > 0`
4. Una imagen registrada en `ProductImages` (recomendado)
5. Stock mayor a cero para una talla en el warehouse de Soomin

Los colores comparten el `ecommerce_group_code`; cada código completo, por
ejemplo `15525BD` o `15525ZJ`, continúa siendo una variante independiente.

## Despliegue

Frontend:

- `NEXT_PUBLIC_API_URL`: URL del backend (localhost durante desarrollo).
- `NEXT_PUBLIC_STOREFRONT_SLUG=soomin-store`

Backend:

- `CORS_ORIGINS`: dominios adicionales separados por coma.
- `REDIS_URL`: opcional. Si no existe, el catálogo sigue funcionando con MySQL.

El servidor siempre vuelve a validar precio y stock. El pedido y el descuento
de inventario se realizan en la misma transacción y usan una clave de
idempotencia para impedir compras duplicadas.
