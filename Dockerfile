# ---------------------------
# STAGE 1: Build
# ---------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copiamos los archivos necesarios
COPY package*.json ./

# Instalamos TODAS las dependencias (incluye dev)
RUN npm install

# Copiamos el resto del proyecto
COPY . .

# Compilamos NestJS
RUN npm run build

# ---------------------------
# STAGE 2: Run
# ---------------------------
FROM node:20-alpine

WORKDIR /app

# Copiamos solo lo necesario desde el builder
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env ./.env

# Exponemos el puerto NestJS
EXPOSE 8080

# Variables de entorno por defecto (Cloud Run puede sobreescribirlas)
ENV NODE_ENV=production

# Comando de inicio
CMD ["node", "dist/main.js"]
