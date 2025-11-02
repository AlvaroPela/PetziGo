### Multi-stage build: build with Node, serve with nginx ###
ARG NODE_ENV=production
ARG VITE_API_BASE=/api

FROM node:18 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
# Custom nginx config to proxy /api to backend service
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
