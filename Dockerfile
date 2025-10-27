# 1. BUILD STAGE: Usar la versión slim de Debian para mejor soporte de sharp
FROM node:18-slim AS builder

WORKDIR /app

# Instalar herramientas de compilación que sharp pueda necesitar
# Aunque en slim a menudo no es necesario, es más seguro.
# También instala libvips
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json y lock file
COPY package.json package-lock.json* ./

# Instalar dependencias
RUN npm install

# Copiar el código y construir
COPY src ./src 
COPY tsconfig.json ./

RUN npm run build

# 2. PRODUCTION STAGE: Usar la misma base limpia
FROM node:18-slim

WORKDIR /app

# Instalar el runtime de VIPS (a menudo llamado libvips)
# Esto es para asegurar que las librerías compartidas estén presentes
RUN apt-get update && apt-get install -y --no-install-recommends libvips \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json
COPY package.json ./

# Instalar dependencias de producción (para sharp)
RUN npm install --only=production

# Copiar build
COPY --from=builder /app/dist ./dist

EXPOSE 3002

# Crear usuario de menor privilegio
RUN groupadd -r nodejs && useradd -r -g nodejs nestjs
USER nestjs

CMD ["node", "dist/main"]