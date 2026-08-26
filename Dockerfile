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

# Copia build do servidor
COPY --from=server-builder /app/server/dist ./dist

# Copia fontes TypeScript necessários para o seed (tsx executa .ts diretamente)
COPY --from=server-builder /app/server/src ./src
COPY --from=server-builder /app/server/tsconfig.json ./tsconfig.json

# Copia build do cliente para a pasta pública do Express
COPY --from=client-builder /app/client/dist ./public-client

# Diretório para uploads
RUN mkdir -p /app/uploads

EXPOSE 3000

# Executa migrations, seed idempotente e inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/index.js"]
