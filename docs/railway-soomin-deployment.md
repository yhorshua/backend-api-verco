# Despliegue de Soomin Store en Railway

## Servicios

Crear dos servicios dentro del mismo proyecto y ambiente de Railway:

1. `backend`: repositorio `backend-api-verco`.
2. `soomin-web`: repositorio `ecomerce-soomin-store`.

Ambos repositorios incluyen `railway.json`, health check y comandos explícitos de compilación e inicio.

## Orden inicial

1. Configurar MySQL y ejecutar, una sola vez y en este orden:
   - `20261106_add_ecommerce_storefront.sql`
   - `20261123_add_soomin_storefront.sql`
   - `20261123_add_soomin_product_commercial_fields.sql`
   - `20261123_add_ecommerce_claims.sql`
   - `20261124_extend_soomin_order_fulfillment.sql`
2. Configurar y desplegar `backend`.
3. Generar un dominio público para `backend`.
4. Configurar y desplegar `soomin-web`.
5. Generar un dominio público para `soomin-web` y agregarlo a `CORS_ORIGINS` del backend.

## Variables de `backend`

Obligatorias:

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `DB_POOL_SIZE=10`
- `JWT_SECRET`: valor aleatorio de 64 caracteres como mínimo recomendado
- `JWT_EXPIRES_IN=8h`
- `CORS_ORIGINS=https://${{soomin-web.RAILWAY_PUBLIC_DOMAIN}}`

Recomendadas u opcionales según funciones habilitadas:

- `REDIS_URL=${{Redis.REDIS_URL}}`
- Variables `CLOUDINARY_*`
- `RESEND_API_KEY`, `EMAIL_SALES_ADDRESS=ventas@soomin.online`, `EMAIL_CLAIMS_TO=ventas@soomin.online` y `EMAIL_FROM=Soomin Store <ventas@soomin.online>`
- Variables de WhatsApp, Meta y EFACT utilizadas por la intranet

Railway proporciona `PORT`; no debe fijarse manualmente.

## Variables de `soomin-web`

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}`
- `API_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}`
- `NEXT_PUBLIC_STOREFRONT_SLUG=soomin-store`
- `NEXT_PUBLIC_SITE_URL=https://${{soomin-web.RAILWAY_PUBLIC_DOMAIN}}`
- `NEXT_PUBLIC_WHATSAPP_NUMBER=51...`
- `NEXT_PUBLIC_BUSINESS_NAME=CONDORI QUISPE JASMIN PAULINA`
- `NEXT_PUBLIC_BUSINESS_RUC=10768561007`
- `NEXT_PUBLIC_BUSINESS_ADDRESS=AV LOS BAMBÚES 831, SJL`

Las variables `NEXT_PUBLIC_*` se incorporan durante la compilación. Si cambian, se debe volver a desplegar el frontend.

## Verificación posterior

- Backend: `GET https://<backend>/health` debe responder `200` y `database: connected`.
- Frontend: `GET https://<frontend>/health` debe responder `200`.
- Catálogo: comprobar la carga de `/storefront/soomin-store/catalog`.
- Panel: comprobar redirección a `/admin/login`, inicio y cierre de sesión.
- Pedido: registrar un pedido de prueba y confirmar persistencia en `EcommerceOrders` y `EcommerceOrderDetails`.

Nunca publicar `.env`. Los secretos deben cargarse en Variables de Railway y, cuando sea posible, sellarse.
