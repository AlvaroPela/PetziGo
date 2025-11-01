# Crear un usuario administrador (ADMIN) — PetziGo

Este documento explica las formas recomendadas y alternativas para crear o promocionar un usuario con rol `ADMIN` en tu instalación de PetziGo. Incluye por qué es seguro usar el script incluido, pasos prácticos para Windows PowerShell y una alternativa SQL pura.

> Ubicación del script seguro incluido:
> - `backend/src/scripts/create_admin.js`
> - npm script: `npm run create:admin`

## Resumen rápido (comando recomendado)

Desde la carpeta `backend` (PowerShell):

```powershell
cd backend
npm run create:admin -- "Administrador" admin@tu-dominio.com "TuContraseñaSegura123!"
```

O usando variables de entorno (no pasar contraseña en la línea de comandos si prefieres):

```powershell
cd backend
$env:ADMIN_NAME = "Administrador"; $env:ADMIN_EMAIL = "admin@tu-dominio.com"; $env:ADMIN_PASSWORD = "TuContraseñaSegura123!"; npm run create:admin
```

El script crea el usuario si no existe, o lo actualiza (nombre, contraseña, `role = 'ADMIN'`, `status = 'ACTIVE'`) si el email ya existe.


## Requisitos previos

1. Variables de entorno de backend correctamente configuradas en `backend/.env`:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — para que el script pueda conectar a la base de datos.
   - `JWT_SECRET` — usado por la app para JWT (no es estrictamente necesario para el seed, pero debe existir para arrancar la app con coherencia).

2. La base de datos MySQL debe estar accesible desde donde ejecutes el script. Si usas Docker Compose, arranca el servicio de DB primero.

3. Node.js y dependencias instaladas en `backend`:

```powershell
cd backend
npm install
```


## ¿Por qué preferir el script en vez de ejecutar SQL manualmente?

- Seguridad del hash de contraseña: el script usa `bcrypt` (mismo mecanismo que el servidor) para hashear la contraseña antes de guardarla en la base de datos. No debes poner contraseñas en texto plano en la DB.
- Reutiliza la pool de conexión y evita errores humanos: usa el mismo `pool`/config de conexión que la app.
- Idempotencia razonable: si el usuario ya existe, el script lo actualiza en vez de crear duplicados.
- Evita inconsistencias: el script asegura `role = 'ADMIN'` y `status = 'ACTIVE'` al crear o promocionar.


## ¿Qué hace exactamente `backend/src/scripts/create_admin.js`?

- Lee argumentos posicionales o variables de entorno: `NAME`, `EMAIL`, `PASSWORD`.
- Valida que existan `email` y `password` (o muestra instrucciones de uso).
- Genera un `password_hash` con `bcrypt` (salt 10).
- Si existe un usuario con ese email, hace `UPDATE` para **actualizar nombre, hash, role y status**.
- Si no existe, hace `INSERT` con `role = 'ADMIN'` y `status = 'ACTIVE'`.
- Cierra la pool/conn al terminar.


## Verificación posterior

1. Accede al login del frontend y utiliza el email/contraseña creados.
2. En la UI, el usuario con rol `ADMIN` verá el enlace `Admin` en la barra de navegación (y podrá entrar a `/admin`).
3. Puedes verificar directamente en la base de datos:

```sql
SELECT id, name, email, role, status FROM users WHERE email = 'admin@tu-dominio.com';
```


## Alternativa (SQL directo) — Cuando usarla y riesgos

Si por alguna razón no puedes ejecutar Node para correr el script, puedes usar SQL directo para *promover* un usuario. Ten en cuenta que esta alternativa no cambia la contraseña a menos que insertes un hash válido.

- Promover un usuario existente por email:

```sql
UPDATE users
SET role = 'ADMIN', status = 'ACTIVE'
WHERE email = 'admin@tu-dominio.com';
```

- Insertar un nuevo admin (NO recomendable porque no hay hash generado):

```sql
INSERT INTO users (name, email, password_hash, role, status)
VALUES ('Administrador', 'admin@tu-dominio.com', '<PASSWORD_HASH_AQUI>', 'ADMIN', 'ACTIVE');
```

Para la contraseña necesitarías un `password_hash` generado con bcrypt; por seguridad **no** pongas la contraseña en texto plano en la columna `password_hash`.

Riesgos de SQL directo:
- Si no generas correctamente el `password_hash`, el usuario no podrá loguear.
- Mayor propensión a errores (roles mal escritos, olvidar activar cuenta, etc.).


## Buenas prácticas y seguridad

- Evita pasar contraseñas en claras en shells compartidos o en historia de comandos. En PowerShell, preferir variables de entorno para ejecuciones temporales o usar prompt interactivo.
- El script está pensado para usarse en entornos controlados (dev/qa/prod admin creation por equipo de ops). No lo expongas como endpoint público.
- Cambia o elimina el script del repositorio de producción si tu política de seguridad lo requiere después del uso.
- Para producción, registra el evento de creación/promoción de admin en un sistema de auditoría (no incluido en el script) y protege el acceso a la DB y al servidor.


## Limpieza opcional

Si quieres eliminar el script (por razones de seguridad) simplemente bórralo:

```powershell
rm backend/src/scripts/create_admin.js
```

O guárdalo en un directorio `scripts/secure/` fuera del repo fuente.


## Solución rápida para entornos Docker

Si tu BD corre en Docker Compose y el backend también, puedes ejecutar el script dentro del contenedor backend:

```powershell
# Asumiendo docker-compose.yml en la raíz y servicio llamado 'backend'
docker compose run --rm backend npm run create:admin -- "Administrador" admin@ejemplo.com "Password123!"
```

Asegúrate de que las variables de entorno en el contenedor estén configuradas (o pásalas en la invocación según tu compose).


## Troubleshooting

- Error de conexión a DB: revisa `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` en `backend/.env` y que la DB acepte conexiones desde tu host.
- `npm run create:admin` dice que no encuentra `pool` o error de import: asegúrate de ejecutar desde la carpeta `backend` y tener `type: module` en `package.json` (ya está configurado).
- Si el script crea el usuario pero no puedes loguear: verifica que la contraseña pasada sea la misma y que se haya hecho `bcrypt.hash` (usa el script, no la alternativa SQL sin hash).


---

Si quieres, puedo:
- Añadir una versión interactiva del script que pregunte la contraseña ocultando el input.
- Agregar un pequeño endpoint protegido (solo accesible desde localhost) para crear admins (no recomendado por seguridad sin autenticación fuerte).
- Crear una tarea CI/CD que agregue un admin en entornos de staging automáticamente con credenciales provisionales.

¿Te lo dejo así o quieres que añada la versión interactiva que pide la contraseña en runtime?