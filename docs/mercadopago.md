# Integración Mercado Pago — Guía de pruebas (Sandbox)

Esta guía reúne información para probar pagos con Mercado Pago en modo de pruebas (sandbox), tarjetas de prueba, escenarios y cómo exponer tu servidor local para recibir webhooks y completar flujos end-to-end.

## Tarjetas de prueba
Mercado Pago proporciona tarjetas de prueba que te permitirán probar pagos sin utilizar una tarjeta real.

Sus datos, como número, código de seguridad y fecha de caducidad, pueden ser combinados con los datos relativos al titular de la tarjeta, que te permitirán probar distintos escenarios de pago. Es decir, puedes utilizar la información de cualquier tarjeta de prueba y probar resultados de pago diferentes a partir de los datos del titular.

A continuación, las tarjetas más comunes para pruebas:

| Tipo de tarjeta | Bandera | Número | Código de seguridad | Fecha de caducidad |
|---|---:|---|---:|---:|
| Tarjeta de crédito | Mastercard | 5254 1336 7440 3564 | 123 | 11/30 |
| Tarjeta de crédito | Visa | 4013 5406 8274 6260 | 123 | 11/30 |
| Tarjeta de crédito | American Express | 3743 781877 55283 | 1234 | 11/30 |
| Tarjeta de débito | Visa | 4915 1120 5524 6507 | 123 | 11/30 |


## Escenarios (datos del titular)
Rellena el campo Titular con el valor indicado para provocar el estado de pago deseado.

| Estado de pago | Nombre y apellido del titular | Documento de identidad |
|---|---|---:|
| Pago aprobado | APRO | 123456789 |
| Rechazado por error general | OTHE | 123456789 |
| Pendiente de pago | CONT | - |
| Rechazado con validación para autorizar | CALL | - |
| Rechazado por importe insuficiente | FUND | - |
| Rechazado por código de seguridad inválido | SECU | - |
| Rechazado debido a un problema de fecha de vencimiento | EXPI | - |
| Rechazado debido a un error de formulario | FORM | - |
| Rechazado por falta de card_number | CARD | - |
| Rechazado por cuotas invalidas | INST | - |
| Rechazado por pago duplicado | DUPL | - |
| Rechazado por tarjeta deshabilitada | LOCK | - |
| Rechazado por tipo de tarjeta no permitida | CTNA | - |
| Rechazado debido a intentos excedidos del pin | ATTE | - |
| Rechazado por estar en lista negra | BLAC | - |
| No soportado | UNSU | - |
| Usado para aplicar regla de montos | TEST | - |

Una vez completes los campos, procesa el pago y espera el resultado en la UI o en el webhook (si lo tienes configurado).


## Mensaje común: "Una de las partes con la que intentas hacer el pago es de prueba"

Si ves un mensaje como "Una de las partes con la que intentas hacer el pago es de prueba" o errores en consola que mencionan `sandbox` o `test`, normalmente significa que estás mezclando modo sandbox con recursos/credenciales de producción, o que el checkout fue generado con credenciales de test pero alguno de los parámetros (p. ej. public key del cliente o preferencia) está en modo producción.

Recomendaciones:
- Usa siempre las credenciales de sandbox (MP_ACCESS_TOKEN de test_) cuando estés probando localmente.
- Cuando crees la preferencia desde el backend, revisa que estés usando el `accessToken` de test. La respuesta contendrá `sandbox_init_point` y `init_point` según el modo; para pruebas usa `sandbox_init_point` si está disponible.
- No mezcles keys públicas/privadas de distintos entornos.


## Exponer tu endpoint local para pruebas (webhooks / back_urls)

Mercado Pago enviará notificaciones (webhooks) o redirigirá al comprador a las `back_urls` que configures en la preferencia. Para que MP pueda comunicarse con tu servidor local necesitas una URL pública.

Opciones rápidas y seguras para desarrollo:

1) ngrok (recomendado)
- Instala ngrok: https://ngrok.com/
- Autentica tu cuenta con el token (si quieres reservar subdominio):
  ngrok authtoken <TU_AUTHTOKEN>
- Exponer puerto 4000 (backend):
  ngrok http 4000

  En PowerShell (Windows):
  ngrok.exe http 4000

- Ngrok te dará una URL pública como `https://xxxxxx.ngrok.io`. Usa esa URL como `APP_URL` o `FRONTEND_URL` en tu `.env` del backend. Ejemplo:
  APP_URL=https://xxxxxx.ngrok.io

2) localtunnel (alternativa ligera)
- Instala localtunnel globalmente:
  npm install -g localtunnel
- Exponer puerto 4000:
  lt --port 4000 --subdomain mitest123

  Esto te dará `https://mitest123.loca.lt` (si el subdominio está disponible).

3) Deploy temporal (opcional)
- Desplegar el backend en un entorno temporal (Heroku, Fly, Vercel Serverless, Render) para tener una URL pública estable y HTTPS.


## Configurar variables de entorno para pruebas (backend `.env`)

Ejemplo mínimo para pruebas locales con ngrok:

```
DB_HOST=... 
DB_USER=... 
DB_PASSWORD=... 
DB_NAME=petzigo
JWT_SECRET=algo-secreto
MP_ACCESS_TOKEN=test_xxx...   # token de sandbox
APP_URL=https://xxxxxx.ngrok.io  # URL pública que expuso ngrok
FRONTEND_URL=http://localhost:5173
```

Luego reinicia el backend para que recoja `APP_URL`.


## Recomendaciones para flujo MP en tu app

- Al crear la preferencia desde el backend, añade `external_reference` con el `orderId` y guarda `pref.id` en `orders.mercadopago_preference_id`.
- Configura `notification_url` apuntando a la URL pública: `https://<tu-url>/api/payments/webhook`.
- Implementa el webhook para validar notificaciones y actualizar `orders.payment_status` y `orders.status`.
- En pruebas, si no puedes usar HTTPS público, usa `sandbox_init_point` o el `init_point` que devuelve la API en sandbox y prueba manualmente en el navegador.

## Procedimiento alternativo usando Cuentas de Prueba desde una cuenta de producción

Algunos desarrolladores han reportado que, en ciertos flujos, es más fiable crear cuentas de prueba desde una cuenta de producción y usarlas para pagar la preferencia. El procedimiento es:

1. Desde tu cuenta de producción en MercadoPago crea dos "Cuentas de Prueba" (Test Accounts): una para el Comprador y otra para el Vendedor.
2. En otro navegador (o sesión privada) ingresa a MercadoPago Developers con la cuenta Vendedor (la creada en el paso anterior).
3. Crea una preferencia de pago usando el ACCESS_TOKEN de producción del Vendedor (no el de sandbox).
4. Abre la URL `init_point` de la preferencia en el navegador para iniciar el checkout.
5. Cuando se solicite el login/pago, logueate con la cuenta Comprador de prueba y procede a pagar con tarjeta o saldo precargado en la cuenta de prueba.

Notas:
- Si se intenta pagar como invitado (sin loguearse) es posible que salga el error «una de las partes con la que intentas hacer el pago es de prueba». En ese caso, loguearse con la cuenta Comprador de prueba suele solucionar el problema.
- Esta vía es útil cuando hay inconsistencias entre entornos o cuando necesitas reproducir escenarios que no funcionan con las credenciales de sandbox estándar.

---
## Cambios recientes en la integración (implementados)

- El endpoint `POST /api/payments/create-preference` ahora acepta `external_reference` y, si se envía, guarda el `pref.id` devuelto por MercadoPago en `orders.mercadopago_preference_id` y marca la orden con `payment_status = 'PROCESSING'`.
- El webhook en `POST /api/payments/webhook` ahora intenta resolver la notificación: extrae el id del pago, consulta la API de MercadoPago para obtener el estado y actualiza la orden correspondiente buscando por `mercadopago_preference_id` o por `external_reference`.

Estas implementaciones permiten enlazar favoritas creadas desde el backend con la orden en la base de datos y recibir notificaciones que actualicen el estado del pedido.

Si quieres que la lógica de actualización use otros mapeos de estados (por ejemplo, pasar `payment_status = 'COMPLETED'` y `status = 'ACCEPTED'` en vez de `COMPLETED`/`COMPLETED`) dime exactamente qué prefieres y lo ajusto.


## Ejemplo: crear preferencia con external_reference (pseudocódigo)

POST /api/payments/create-preference
body:
```
{
  "title": "Reserva #123",
  "quantity": 1,
  "unit_price": 25000,
  "external_reference": "123"  // orderId
}
```

La lógica del backend debería:
1. Crear la orden en BD y obtener orderId.
2. Generar la preferencia incluyendo `external_reference: orderId`.
3. Guardar `pref.id` (preference id) en la fila de la orden.
4. Devolver `init_point` al cliente.


## Troubleshooting rápido
- Si recibes `invalid_auto_return`: quita temporalmente `auto_return` o asegúrate de que `APP_URL` apunte a una URL pública válida (https). MercadoPago exige URLs válidas para auto_return.
- Si recibes mensajes sobre test vs prod: asegúrate de usar `MP_ACCESS_TOKEN` de sandbox (test_) y las URLs devueltas por la API de sandbox.
- Si la redirección ocurre pero ves un error en la pantalla de MP que dice que la parte es de prueba, verifica que tanto la preferencia como la tarjeta y la cuenta estén en sandbox (no mezclar).


Si quieres, puedo:
- Añadir un ejemplo de implementación del webhook en `backend/src/routes/payments.js` que busque la orden por `external_reference` y actualice su estado. (Dime qué estado quieres usar cuando MP confirme el pago: p.ej. `payment_status = 'COMPLETED'` y `status = 'ACCEPTED'`.)
- Generar un script de migración para guardar `preference.id` en la orden cuando se cree la preferencia.

---
Archivo generado automáticamente: `docs/mercadopago.md`
