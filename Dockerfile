# Etapa de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . . 
RUN npm run build

# Etapa final
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/main.js"]
