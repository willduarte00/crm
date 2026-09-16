# Estágio 1: Build do Frontend (React + Vite)
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Estágio 2: Build do Backend (Express + TypeScript + Prisma)
FROM node:20-alpine AS server-builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app/server
COPY server/package*.json ./
COPY server/prisma ./prisma/
RUN npm ci
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Estágio 3: Imagem final de execução
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Instala dependências de produção do servidor
COPY server/package*.json ./
COPY server/prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate

# Copia build do servidor (inclui dist/prisma/seed.js e dist/src/index.js)
COPY --from=server-builder /app/server/dist ./dist

# Copia build do cliente para a pasta pública do Express
COPY --from=client-builder /app/client/dist ./public-client

# Diretório para uploads, pertencente ao usuário não-root que executará o processo
RUN mkdir -p /app/uploads && chown -R node:node /app

EXPOSE 3000

USER node

# Executa migrations, seed idempotente e inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/index.js"]
