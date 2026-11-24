# E-commerce por almacén

## Separación de procesos

`WebSales` y `WebSaleDetails` continúan siendo exclusivos de la intranet. El canal público utiliza `Storefronts`, `EcommerceOrders` y `EcommerceOrderDetails`, por lo que sus estados y reglas no interfieren con los pedidos internos.

Cada registro de `Storefronts` enlaza un `slug` público con un `warehouse_id`. `verco-online` está configurado actualmente con el warehouse 5 (`Verco Central`). Para publicar otra tienda se crea otro registro y se despliega el mismo frontend con `NEXT_PUBLIC_STOREFRONT_SLUG` diferente. Los productos, precios y fotos se comparten; el stock se consulta y descuenta en el almacén correspondiente.

## Productos, colores e imágenes

Cada código completo sigue siendo un producto/variante real. Por ejemplo, `15525BD` y `15525NR` conservan tallas y stock independientes. `ecommerce_group_code=15525` los agrupa en una sola ficha; `color_code=BD` o `NR` identifica el selector de color. Mientras se completa esa metadata, la API deriva provisionalmente los dos últimos caracteres alfabéticos.

Las fotos se registran en `ProductImages` y pertenecen al código completo, no al grupo. Así, al seleccionar el color cambia la galería, las tallas y el stock. El alta se realiza con JWT de Administrador o Jefe Ventas:

```http
PATCH /storefront-admin/products/444
Content-Type: application/json

{
  "ecommerce_group_code": "15525",
  "color_code": "BD",
  "color": "Blanco/Dorado",
  "ecommerce_name": "Zapatilla Futsal 15525",
  "selling_price": "98.00",
  "is_published": true
}
```

```http
POST /storefront-admin/products/444/images
Content-Type: application/json

{
  "image_url": "https://cdn.ejemplo.com/catalogo/15525/BD/frontal.webp",
  "alt_text": "Zapatilla 15525 Blanco Dorado - vista frontal",
  "sort_order": 1,
  "is_primary": true
}
```

No se deben guardar binarios en MySQL ni en Redis. Para imágenes se recomienda Cloudinary (transformación y CDN sencillas) o Cloudflare R2 con CDN. La base solo guarda la URL HTTPS. Usar WebP/AVIF, una versión principal de 1200 px y miniaturas de 400 px.

## Pedido y stock

El navegador envía solo producto, talla y cantidad. El servidor obtiene el precio vigente, bloquea las filas de stock, comprueba disponibilidad, calcula importes exactos en centavos, crea cabecera/detalle y descuenta stock en una sola transacción. `idempotency_key` evita duplicados por doble clic o reintento.

Una cancelación válida devuelve el stock una sola vez. Los cambios de estado administrativos están protegidos para Administrador y Jefe Ventas.

## Redis en Railway

Agregar la variable privada `REDIS_URL` proporcionada por Railway al servicio backend. No debe existir como `NEXT_PUBLIC_*`. Si Redis no está disponible, la API continúa consultando MySQL.

Redis almacena únicamente respuestas breves del catálogo, con TTL configurable (60 segundos por defecto). La clave incluye `cache_version`; una venta, cancelación o modificación mediante los endpoints de catálogo incrementa la versión. La creación del pedido nunca confía en Redis y siempre valida precio y stock en MySQL.

## Endpoints

- `GET /storefront/:slug/catalog`: catálogo público agrupado por modelo/color.
- `POST /storefront/:slug/orders`: crea el pedido y descuenta stock.
- `GET /storefront-admin/orders`: lista paginada protegida.
- `PATCH /storefront-admin/orders/:id/status`: confirma, despacha, entrega o cancela.
- `PATCH /storefront-admin/products/:id`: metadata y publicación ecommerce.
- `POST /storefront-admin/products/:id/images`: registra una URL de imagen.
- `POST /storefront-admin/products/:id/images/bulk`: registra o actualiza una galería completa por ID.
- `POST /storefront-admin/products/by-code/:articleCode/images/bulk`: registra la galería usando el código, por ejemplo `15525BD`.
- `DELETE /storefront-admin/products/:id/images/:imageId`: retira una imagen del catálogo.
- `POST /storefront-admin/images/cloudinary/sync/:articleCode`: compara Cloudinary con `ProductImages` y registra las imágenes faltantes.
- `POST /storefront-admin/images/cloudinary/sync-folder`: revisa todos los recursos de la carpeta dinámica configurada y sincroniza cada producto detectado.

Sincronización segura en dos pasos:

```json
{ "dry_run": true }
```

Primero devuelve qué imágenes existen, cuáles faltan y las advertencias de peso o resolución. Para registrar lo faltante:

```json
{ "dry_run": false, "replace_existing": false }
```

El backend requiere `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. Estas variables son privadas y nunca deben declararse como `NEXT_PUBLIC_*`.

La sincronización automática de la carpeta `verco` se activa únicamente en el proceso backend con:

```env
CLOUDINARY_CLOUD_NAME=nombre_publico_del_cloud
CLOUDINARY_API_KEY=credencial_privada_rotada
CLOUDINARY_API_SECRET=secreto_privado_rotado
CLOUDINARY_ASSET_FOLDER=verco
CLOUDINARY_SYNC_ENABLED=true
CLOUDINARY_SYNC_INTERVAL_MINUTES=5
```

No se debe copiar una clave expuesta en chats o capturas: primero se revoca y se genera una nueva. El formato esperado para cada recurso es `CODIGOPRODUCTO_ORDEN`, por ejemplo `15525ZJ_1`. Los códigos que no existan en `Products` y los nombres inválidos se reportan, pero no crean productos incompletos.

Vista previa manual de toda la carpeta:

```json
{ "asset_folder": "verco", "dry_run": true }
```

Registro manual de faltantes:

```json
{ "asset_folder": "verco", "dry_run": false, "replace_existing": false }
```

Ejemplo de registro masivo por código:

```json
{
  "replace_existing": false,
  "images": [
    {
      "image_url": "https://res.cloudinary.com/cloud/image/upload/producto_1.jpg",
      "alt_text": "Producto - vista principal",
      "sort_order": 1,
      "is_primary": true
    },
    {
      "image_url": "https://res.cloudinary.com/cloud/image/upload/producto_2.jpg",
      "alt_text": "Producto - vista lateral",
      "sort_order": 2
    }
  ]
}
```
