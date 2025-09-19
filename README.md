# PetziGo – MVP (React + Node.js + MySQL)
Este repositorio contiene un MVP funcional para la plataforma PetziGo con:
- **Backend**: Node.js/Express, JWT, MySQL.
- **Frontend**: React con páginas de Home, Registro, Login, Dashboard de Usuario y Proveedor.
- **Base de datos**: `schema.sql` con tablas clave (users, services, orders, reviews).

## Requisitos
- Node.js 18+
- MySQL 8+
- Crear `.env` en `backend/` a partir de `.env.example`

## Pasos
1. `mysql -u root -p < schema.sql`
2. Backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Editar credenciales
   npm run dev
   ```
3. Frontend:
   ```bash
   cd ../frontend
   npm install
   npm start
   ```

## Endpoints principales
- `POST /api/auth/register`  (name, email, password, role: USER|PROVIDER)
- `POST /api/auth/login`     (email, password) -> token JWT
- `GET  /api/services`       (público)
- `POST /api/services`       (PROVIDER) crear servicio
- `POST /api/orders`         (USER) solicitar servicio
- `GET  /api/orders/me`      (USER/PROVIDER) ver pedidos propios
- `GET  /api/users/me`       (autenticado) perfil
- `PUT  /api/users/me`       (autenticado) actualizar perfil

> La integración con MercadoPago y Google Maps se deja preparada para conectar desde el frontend usando el token del backend.


## Integraciones
### MercadoPago
1. Crea tus credenciales (Access Token y Public Key) en MercadoPago.
2. En `backend/.env` agrega:
   ```env
   MP_ACCESS_TOKEN=TU_ACCESS_TOKEN
   MP_PUBLIC_KEY=TU_PUBLIC_KEY
   APP_URL=http://localhost:4000
   ```
3. Inicia backend y frontend. Desde el **Dashboard de Usuario**, usa **Pagar con MercadoPago**.

### Google Maps
1. Obtén tu `YOUR_GOOGLE_MAPS_API_KEY` en Google Cloud.
2. Edita `frontend/public/index.html` y reemplaza `YOUR_GOOGLE_MAPS_API_KEY`.
3. En **Inicio**, se renderiza un mapa base (centro: Medellín).

