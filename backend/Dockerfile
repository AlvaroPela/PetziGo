FROM node:18

WORKDIR /usr/src/app

# instalar dependencias primero para cache de capas
COPY ./package*.json ./
RUN npm install --no-audit --no-fund

# copiar resto
COPY ./. .

# Copiar entrypoint y asegurar permisos
COPY ./docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4000

# Usar entrypoint para crear admin por defecto antes de arrancar (útil en entornos de prueba)
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# comando por defecto (overrideable por compose)
CMD ["npm", "run", "dev"]