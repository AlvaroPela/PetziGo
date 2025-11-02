#!/bin/sh
set -e

echo "[entrypoint] Iniciando entrypoint del backend"

# Valores por defecto para pruebas (puedes sobrescribir con env vars al ejecutar el contenedor)
ADMIN_NAME=${ADMIN_NAME:-"Administrador"}
ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@petzigo.com"}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-"Petzigo.2025"}

# Número máximo de intentos para crear el admin (espera a que la DB esté lista)
MAX_RETRIES=${ADMIN_CREATE_RETRIES:-10}
SLEEP_SECONDS=${ADMIN_CREATE_SLEEP:-3}

try_create_admin() {
  echo "[entrypoint] Intentando crear/actualizar admin: $ADMIN_EMAIL"
  # Ejecutar el script con los argumentos
  npm run create:admin -- "$ADMIN_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
}

i=0
while [ "$i" -lt "$MAX_RETRIES" ]; do
  if try_create_admin; then
    echo "[entrypoint] create:admin ejecutado correctamente"
    break
  else
    i=$((i+1))
    echo "[entrypoint] create:admin falló, intento $i/$MAX_RETRIES — esperando $SLEEP_SECONDS s"
    sleep $SLEEP_SECONDS
  fi
done

if [ "$i" -ge "$MAX_RETRIES" ]; then
  echo "[entrypoint] Aviso: no se pudo crear el admin tras $MAX_RETRIES intentos. Continuando para iniciar el servidor..."
fi

echo "[entrypoint] Iniciando servidor: npm run dev"
exec npm run dev
