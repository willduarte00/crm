# TASK-2 — Modelo de dados de grupos, migration e seed

**Arquivo alvo:** `server/prisma/schema.prisma` (existente), `server/prisma/migrations/<nova>/migration.sql` (novo), `server/prisma/seed.ts` (existente)
**Referência SPEC:** Seção 8.3
**Depende de:** TASK-1
**Bloqueada por:** nenhuma

---

## Contexto

O acesso hoje é o campo `User.role String @default("membro")`. Ele sai por completo e dá lugar a `Group` + `UserGroup`. O banco está em fase de testes e **não há dado de produção a migrar** (PRD, DP-16/DP-17), então a migration pode remover a coluna sem conversão e o seed reconstrói o estado inicial.

## O que fazer

**1. `server/prisma/schema.prisma`**

- Remover `role` de `User`.
- Adicionar `groups UserGroup[]` em `User`.
- Criar `Group`: `id`, `name @unique`, `description String?`, `isSystem Boolean @default(false)`, `permissions String[]`, `createdAt`, `updatedAt`, `users UserGroup[]`, `@@map("groups")`.
- Criar `UserGroup`: `userId`, `groupId`, `createdAt`, relação com `User` (`onDelete: Cascade`) e com `Group` (`onDelete: Restrict`), `@@id([userId, groupId])`, `@@index([groupId])`, `@@map("user_groups")`.

**2. Migration**

Gerar com `prisma migrate dev`. Não editar `server/prisma/migrations/20260819000000_init/migration.sql`.

**3. `server/prisma/seed.ts`**

- Semear os três grupos com as permissões exatas da matriz do PRD ("Grupos semeados — matriz de permissões"), usando `upsert` por `name` para manter a idempotência que o seed já tem:
  - **Admin** — `isSystem: true`, todas as permissões de `PERMISSIONS`.
  - **Operacional** — `screen.clientes`, `screen.pipeline`, `clients.view`, `clients.create`, `clients.update`, `clients.stage.update`, `clients.owner.update`, `logs.view`, `logs.create`, `users.view_basic`.
  - **Financeiro** — `screen.dashboard`, `screen.clientes`, `screen.contratos`, `screen.financeiro`, `clients.view`, `logs.view`, `contracts.view`, `contracts.create`, `contracts.update`, `contract_files.view`, `contract_files.create`, `payments.view`, `payments.create`, `payments.update`, `payments.settle`, `payments.export`, `invoices.view`, `invoices.create`, `dashboard.financial.view`, `dashboard.operational.view`, `settings.bank.view`.
- Ao criar o usuário administrador inicial, vincular ao grupo Admin via `UserGroup`. Quando o usuário já existir, garantir o vínculo sem duplicar (`upsert` na chave composta).
- Remover `role: 'admin'` do `create` do usuário.

## Notas de implementação

- **`onDelete: Restrict` em `UserGroup.group` é intencional:** é a segunda linha de defesa de RF-11 (grupo com usuários não pode ser excluído). Mesmo que a validação de aplicação falhe, o banco recusa.
- `permissions String[]` é array de texto do Postgres — o conjunto é sempre lido inteiro; não há requisito de consultar "quais grupos concedem X".
- O grupo Admin deriva de `PERMISSIONS`, não de uma lista copiada: adicionar permissão nova ao catálogo deve concedê-la ao Admin automaticamente no próximo seed.
- Conferir a matriz do PRD permissão a permissão. Um item a mais no grupo Operacional ou Financeiro é uma falha de segurança silenciosa — em especial `clients.delete`, `clients.export`, `payments.cancel`, `invoices.delete` e `contracts.delete`, que **não** pertencem a nenhum dos dois.
- Depois desta task o projeto não compila até TASK-3 e TASK-4 removerem os usos de `role`. É esperado: as três formam a fundação e devem ser concluídas em sequência.

## Critério de aceite

- [ ] `User.role` não existe mais no schema.
- [ ] `Group` e `UserGroup` existem com os mapeamentos, índice e `onDelete` descritos.
- [ ] A migration aplica em base limpa sem erro.
- [ ] O seed cria os três grupos com exatamente as permissões da matriz do PRD.
- [ ] O grupo Admin tem `isSystem: true` e todas as permissões do catálogo.
- [ ] O administrador inicial fica vinculado ao grupo Admin.
- [ ] Rodar o seed duas vezes seguidas não duplica grupo nem vínculo.
- [ ] Build e testes relevantes passam sem erros.
