# TASK-5 — API de grupos e catálogo de permissões

**Arquivo alvo:** `server/src/routes/groups.ts` (novo), `server/src/__tests__/groups.test.ts` (novo)
**Referência SPEC:** Seção 8.6
**Depende de:** TASK-4
**Bloqueada por:** nenhuma

---

## Contexto

O Admin precisa criar grupos, marcar permissões e excluir grupos pela interface. Esta task entrega a API e as salvaguardas que impedem o Admin de se trancar para fora do sistema.

## O que fazer

**1. `server/src/routes/groups.ts`**

```
GET    /api/permissions   → groups.view
GET    /api/groups        → groups.view
POST   /api/groups        → groups.manage
PATCH  /api/groups/:id    → groups.manage
DELETE /api/groups/:id    → groups.manage
```

- `GET /api/permissions` devolve `{ permissions: PERMISSION_CATALOG, screenDependencies: SCREEN_DEPENDENCIES }`. É o que evita o frontend manter uma segunda cópia do catálogo.
- `GET /api/groups` devolve `[{ id, name, description, isSystem, permissions, userCount }]`, ordenado por nome, com `userCount` vindo de `_count.users`.
- `POST` recebe `{ name, description?, permissions[] }`; `PATCH` recebe os mesmos campos, todos opcionais.

**2. Validação** — Zod na rota (convenção do projeto) mais as funções puras de TASK-1:

| Regra | Status | Corpo |
|---|---|---|
| `name` vazio | `400` | mensagem do Zod |
| `name` duplicado | `400` | `"Já existe um grupo com este nome."` |
| Permissão fora do catálogo (`isValidPermission`) | `400` | nomeia a chave inválida |
| `findScreenDependencyViolations` não vazio | `422` | `{ error, violations: [{ screen, missingAnyOf }] }` |
| `PATCH` ou `DELETE` em grupo `isSystem` | `422` | `"O grupo Admin não pode ser alterado nem excluído."` |
| `DELETE` com `userCount > 0` | `422` | `"Este grupo tem N usuário(s) vinculado(s). Desvincule antes de excluir."` |

**3. `server/src/__tests__/groups.test.ts`** (supertest, mock de `prisma` como nos testes existentes):

- CRUD completo pelo Admin.
- Nome duplicado → `400`. Permissão inexistente → `400`.
- Tela sem a leitura correspondente → `422` com `violations` no corpo identificando tela e permissão ausente.
- `screen.dashboard` aceita com só `dashboard.financial.view`; aceita com só `dashboard.operational.view`; rejeitada sem nenhuma das duas.
- `PATCH` e `DELETE` no grupo `isSystem` → `422`.
- `DELETE` de grupo com usuários → `422` com a contagem correta.
- Usuário sem `groups.manage` → `403` em `POST`, `PATCH` e `DELETE`; sem `groups.view` → `403` em `GET /api/groups` e `GET /api/permissions`.

## Notas de implementação

- A ordem de validação importa: catálogo (`400`) antes de coerência (`422`). Uma chave inválida não deve produzir uma mensagem sobre dependência de tela.
- `isSystem` nunca é aceito no corpo de `POST` nem de `PATCH` — só o seed cria grupo de sistema. Descartar o campo se vier.
- No `PATCH`, validar coerência sobre o conjunto **final** de permissões, não sobre o delta.
- `DELETE` valida `userCount` na aplicação **e** o banco tem `onDelete: Restrict` (TASK-2). O erro do Prisma por violação de FK deve ser traduzido para o mesmo `422`, nunca vazar como `500`.
- `violations` no corpo é o que a tela de grupos usa para apontar a permissão faltante (TASK-12). Manter o formato.

## Critério de aceite

- [ ] As cinco rotas existem com as permissões da tabela acima.
- [ ] `GET /api/permissions` devolve catálogo e dependências de tela.
- [ ] `GET /api/groups` traz `userCount` por grupo.
- [ ] Grupo de sistema não pode ser editado, renomeado nem excluído (`422`).
- [ ] Grupo com usuários vinculados não pode ser excluído (`422`, com a contagem).
- [ ] Salvar com tela sem a leitura correspondente devolve `422` com `violations`.
- [ ] `isSystem` enviado no corpo é ignorado.
- [ ] Violação de FK no banco vira `422`, não `500`.
- [ ] Build e testes relevantes passam sem erros.
