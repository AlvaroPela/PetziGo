FROM node:18

WORKDIR /usr/src/app

# instalar dependencias primero para cache de capas
COPY ./package*.json ./
RUN npm install --no-audit --no-fund

# copiar resto
COPY ./. .

EXPOSE 4000

# comando por defecto (overrideable por compose)
CMD ["npm", "run", "dev"]