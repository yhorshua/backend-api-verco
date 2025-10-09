# 1. Usa Node.js como base
FROM node:20-alpine

# 2. Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Copia los archivos necesarios
COPY package*.json ./

# 4. Instala solo las dependencias necesarias
RUN npm ci --only=production

# 5. Copia el resto del código
COPY . .

# 6. Compila el proyecto (si usas TypeScript)
RUN npm run build

# 7. Expone el puerto que usa NestJS
EXPOSE 3001

# 8. Comando de inicio
CMD ["node", "dist/main.js"]
