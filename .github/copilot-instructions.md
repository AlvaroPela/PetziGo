# Instrucciones rápidas para agentes IA (PetziGo)

Resumen breve (big picture): PetziGo es una aplicación full-stack (React + Vite en `frontend/`, Node.js + Express en `backend/`, MySQL). Roles principales: CLIENT (cliente/usuario final), PROVIDER (proveedor), ADMIN. Los proveedores tienen un perfil (`provider_profiles`) con geolocalización y certificaciones que el admin valida.

Puntos claves (qué debes saber primero):
- Estructura principal:
  - `backend/src` — servidor Express y rutas (`routes/*.js`).
  - `backend/src/config/db.js` — pool MySQL y helper `withTransaction`.
  - `backend/src/middleware/auth.js` — `requireAuth`, `requireRole`, `requireVerifiedProvider`, `requireResourceOwnership`.
  - `frontend/src` — React app (Vite). `frontend/src/lib/api.js` es el wrapper fetch hacia la API.
  - `schema.sql` — modelo relacional actualizado (users, pets, provider_profiles, services, products, orders, order_items, certifications, reviews, gps_locations).

- Convenciones del proyecto:
  - Roles en DB/código: `CLIENT`, `PROVIDER`, `ADMIN`.
  - Fechas en columnas: `created_at`, `updated_at` (TIMESTAMP).
  - Tokens JWT devueltos en `token` y almacenados en localStorage por el frontend.
  - Archivos subidos por ahora se almacenan localmente en `/uploads/...` (multer). En producción, migrar a Cloudinary/S3.

- Variables de entorno importantes (backend `.env`):
  - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
  - JWT_SECRET
  - MP_ACCESS_TOKEN (MercadoPago access token)
  - MP_PUBLIC_KEY (MercadoPago public key, usada en frontend)
  - BACKEND_URL (ej. `http://localhost:4000`) — usada para webhooks y redirects
  - FRONTEND_URL (ej. `http://localhost:3000`)

- Variables de entorno (frontend `.env` / Vite):
  - VITE_API_BASE (ej. `http://localhost:4000/api`)
  - VITE_MP_PUBLIC_KEY (clave pública de MercadoPago si se integra desde cliente)

Endpoints más relevantes (ejemplos):
- Auth
  - POST /api/auth/register — body: { name, email, password, role: 'CLIENT'|'PROVIDER' }
  - POST /api/auth/login — body: { email, password } -> { token }
  - GET  /api/auth/me — user actual (requiere Authorization header)

- Usuarios / Mascotas
  - POST /api/users/pets — crear mascota (CLIENT)
  - GET  /api/users/pets — listar mascotas del cliente
  - PUT  /api/users/profile — actualizar perfil (autenticado)

- Proveedores / Certificaciones
  - GET  /api/providers — búsqueda pública (filtros por categoría y geo)
  - GET  /api/providers/:id — perfil público (servicios, reseñas)
  - POST /api/providers/certifications — subir certificación (PROVIDER)
  - PATCH /api/providers/admin/verify/:id — (ADMIN) verificar proveedor

- Servicios / Productos
  - GET /api/services — búsqueda pública con filtros
  - POST /api/services — crear servicio (PROVIDER verificado)
  - PUT /api/services/:id — actualizar (propietario)

- Pedidos y pagos
  - POST /api/orders — crear pedido (CLIENT)
  - POST /api/payments/create-preference/:orderId — crea preferencia MercadoPago
  - POST /api/payments/webhook — webhook público para actualizaciones de pago (MP)

Mapas (lista gratis y configuración rápida):
- Se incluyó `leaflet` + `react-leaflet` en `frontend/package.json` para usar OpenStreetMap sin llave API.
- Recomendación rápida (frontend):
  - Instala paquetes: `cd frontend && npm install`.
  - Import CSS globalmente (por ejemplo en `src/main.jsx`):
    import 'leaflet/dist/leaflet.css';
  - Crear `src/components/Map.jsx` que use `MapContainer`, `TileLayer`, `Marker` de `react-leaflet`. Los proveedores guardan `location_lat` y `location_lng` en `provider_profiles`.
  - No se requiere API key para OpenStreetMap/Leaflet.

MercadoPago (puntos prácticos):
- Variables esperadas en `backend/.env`: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`.
- `POST /api/payments/create-preference/:orderId` debe usar `MP_ACCESS_TOKEN` para crear la preferencia y devolver la `init_point` o `preference.id` al frontend.
- Webhook: configurar `BACKEND_URL` y exponer `POST /api/payments/webhook` para que MercadoPago notifique cambios. Validar las notificaciones con el SDK de MercadoPago.

Patrones y dónde mirar cuando generes código:
- Autorización: revisa `backend/src/middleware/auth.js` para ver cómo se añade `req.user` a la request.
- Acceso a BD: usa `backend/src/config/db.js` y `withTransaction` para operaciones multi-step.
- Rutas: `backend/src/routes/*.js` tienen validaciones (`express-validator`) y consultas SQL directas con `pool.query`.

Cómo levantar localmente (rápido):
- Preparar DB: `mysql -u root -p < schema.sql`
- Backend (PowerShell):
```powershell
cd backend
npm install
cp .env.example .env  # editar valores: DB_*, JWT_SECRET, MP_*
npm run dev
```
- Frontend (PowerShell):
```powershell
cd frontend
npm install
npm run dev
```

Notas finales y límites del archivo:
- Este archivo documenta lo descubierto en el repositorio actual. No asume integraciones externas más allá de MercadoPago y Leaflet/OpenStreetMap.
- Si quieres que incluya: ejemplos de llamadas (curl), componentes React de ejemplo o scripts de seed para crear un admin, dime y los añado.

Si te parece bien, continuo con los pasos B (levantar backend y revisar logs) y C (esqueleto del frontend con componente Map y wiring a `VITE_API_BASE` / `VITE_MP_PUBLIC_KEY`).