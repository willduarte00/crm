# Project Context

## Resumo do produto

CRM interno para agência de marketing. Gerencia clientes e leads em pipeline Kanban, contratos de serviço (recorrentes e pontuais), cobranças/pagamentos, dashboard de métricas, disparo de mensagens WhatsApp e configurações da agência. Uso restrito à equipe interna (admin e membros), sem cadastro público.

## Objetivo principal

Centralizar em uma única ferramenta o funil comercial, os contratos e o financeiro recorrente da agência, eliminando planilhas paralelas e perda de acompanhamento de leads e cobranças.

## Stack e runtime

- Linguagem: TypeScript
- Framework principal: Express 4 (backend) + React 18 com Vite 5 (frontend)
- UI: Tailwind CSS 3, Radix UI, lucide-react, sonner, recharts, @hello-pangea/dnd
- Backend/API: REST em Express, validação com Zod, autenticação JWT em cookie, express-rate-limit, multer para upload
- Banco de dados: PostgreSQL via Prisma 5
- Ferramentas de build/test: Vitest + supertest (server), tsc + vite (build), Docker Compose e Caddy para deploy

## Arquitetura e convenções

- Monorepo com workspaces manuais: `client/`, `server/`, `scripts/`, `docs/`
- Backend em camadas: `server/src/routes/` (HTTP + Zod) chama `server/src/domain/` (regras puras, sem Express/Prisma) e `server/src/services/`
- Regras de negócio puras vivem em `server/src/domain/*.ts` e são testadas isoladamente em `server/src/__tests__/domain.*.test.ts`
- Testes de rota usam supertest em `server/src/__tests__/<recurso>.test.ts`
- Frontend por domínio em `client/src/components/<Area>/`, tipos em `client/src/types/`, helpers em `client/src/utils/formatters.ts`
- Estado de servidor no frontend via @tanstack/react-query; rotas via react-router-dom
- Regras de formatação/validação de documento existem duplicadas em `server/src/domain/clients.ts` e `client/src/utils/formatters.ts`
- Nomes de campo em inglês no código (`documentType`, `documentNumber`); textos de UI e mensagens de erro em pt-BR

## Domínio e regras importantes

- Cliente e Lead são a mesma entidade `Client`, diferenciada pelo campo `stage` do pipeline
- `documentType` aceita `CPF` ou `CNPJ`; `documentNumber` é persistido apenas com dígitos, sem máscara
- Validação de CPF e CNPJ por dígitos verificadores (módulo 11) é obrigatória na criação e na atualização
- Estágios do pipeline, origens de lead, prioridades e tipos de serviço são listas fechadas em `server/src/domain/clients.ts`
- Telefone é normalizado para E.164 brasileiro (`55` + DDD + número)
- Valores monetários trafegam e são persistidos em centavos inteiros
- Exclusão de cliente é lógica (`deletedAt`)
- Numeração de cobranças é sequencial e controlada por `PaymentSequence`

## Integrações e dependências externas

- PostgreSQL (Docker Compose em dev, container em prod)
- Caddy como proxy reverso/TLS em produção
- WhatsApp por geração de link/mensagem (`server/src/domain/whatsapp.ts`), sem API oficial
- Autenticação própria com bcryptjs + JWT em cookie httpOnly, com `tokenVersion` para invalidação
- Upload de arquivos em disco via multer

## Riscos e cuidados recorrentes

- Duplicação de lógica de documento entre `server/src/domain/clients.ts` e `client/src/utils/formatters.ts`: qualquer mudança de regra precisa ser aplicada nos dois lados
- `cleanDigits` (`replace(/\D/g, '')`) é usado em validação, persistência e busca — descarta qualquer caractere não numérico silenciosamente
- Dados legados já persistidos podem não satisfazer regras novas de validação
- Testes de domínio cobrem CPF/CNPJ com casos fixos; alterar a regra exige atualizar `domain.clients.test.ts` e `clients.test.ts`
- Sem migração automática de dados: mudanças de formato exigem migration Prisma explícita
- Aplicação lida com dados pessoais (LGPD): documento, telefone e e-mail de clientes
