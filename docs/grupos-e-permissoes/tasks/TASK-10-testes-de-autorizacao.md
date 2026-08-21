# TASK-10 — Testes de autorização por grupo e cobertura de rotas

**Arquivo alvo:** `server/src/__tests__/permissions.test.ts` (existente, reescrita ampla)
**Referência SPEC:** Seção 13
**Depende de:** TASK-6, TASK-7, TASK-8, TASK-9
**Bloqueada por:** nenhuma

---

## Contexto

`permissions.test.ts` cobre hoje admin vs membro em `/api/users` e `/api/settings`, incluindo chamada direta sem UI e as regras de último admin. Com o modelo novo, os casos passam a ser por grupo, por acúmulo e por ausência de grupo. Entra também o teste que sustenta RF-05 no tempo: nenhuma rota protegida sem permissão declarada.

## O que fazer

Reescrever `server/src/__tests__/permissions.test.ts` mantendo o padrão dos testes existentes (supertest + mock de `prisma`), com fixtures de usuário para cada grupo semeado, um usuário com dois grupos e um sem nenhum.

**1. Por grupo** — para Admin, Operacional e Financeiro, ao menos um acesso permitido e um negado por área, cobrindo os critérios do PRD:

- Operacional: `200` em `PATCH /api/clients/:id/stage`, `PATCH /api/clients/:id/owner`, `POST /api/clients`, `POST /api/clients/:id/logs` e `GET /api/users/basic`; `403` em `DELETE /api/clients/:id`, `GET /api/contracts`, `GET /api/payments`, `GET /api/dashboard`, `POST /api/clients/batch-reassign`, `GET /api/export/clients`, `GET /api/users`, `GET /api/settings`, `PUT /api/settings` e `GET /api/groups`.
- Financeiro: `200` em `GET /api/payments`, `POST /api/payments`, `POST /api/contracts`, `PATCH /api/contracts/:id`, `GET /api/export/payments` e `GET /api/settings/billing`; `403` em `PATCH /api/clients/:id/stage`, `POST /api/clients`, `DELETE /api/contracts/:id`, `PUT /api/settings`, `GET /api/users`, `GET /api/export/clients` e `GET /api/groups`.
- Admin: `200` em `GET /api/users`, `PUT /api/settings`, `GET /api/export/clients`, `GET /api/export/payments` e `GET /api/groups`.

**2. Acúmulo** — usuário vinculado a Operacional **e** Financeiro obtém `200` tanto em `PATCH /api/clients/:id/stage` quanto em `GET /api/payments`, e o `/me` devolve a união sem duplicatas.

**3. Sem grupo** — `200` em `GET /api/auth/me` com `permissions: []`; `403` em qualquer rota protegida.

**4. Segurança**

- `403` distinto de `401`: sem cookie → `401`; autenticado sem permissão → `403` com `requiredPermission`.
- Payload forjado: enviar `role`, `groupIds` e `permissions` no corpo e na query string de uma rota qualquer não altera a autorização aplicada.
- Chamada direta sem passar pela UI continua devolvendo `403` (preservar o caso que já existe).

**5. Ações compostas**

- `PATCH /api/payments/:id`: Financeiro dá baixa (`200`); cancela (`403`); combina baixa e alteração de valor exigindo as duas permissões.
- `DELETE /api/files/:id`: anexo de contrato e nota fiscal negados de forma independente; arquivo inexistente → `404`.

**6. Payload filtrado**

- `GET /api/dashboard` sem `dashboard.financial.view`: resposta sem MRR, alertas e `billingHistory`.
- `GET /api/dashboard` sem `settings.bank.view`: resposta sem `pixKey`, `bankName`, `bankBranch`, `bankAccount`.
- `GET /api/users/basic`: itens só com `id` e `name`, e nenhum usuário inativo.

**7. Regras de integridade** (adaptando os casos que já existem para grupos)

- Remover o último usuário ativo do grupo de sistema → `422`.
- Desativar o último usuário ativo do grupo de sistema → `422`.
- Alterar os próprios grupos → `422`.
- Desativar usuário incrementa `tokenVersion` e invalida a sessão aberta (preservar).
- `mustChangePassword` continua bloqueando as demais rotas (preservar).

**8. Cobertura de rotas** — percorrer a pilha de rotas registrada no app Express e falhar se alguma rota sob `/api` fora da allowlist (`/api/health`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password`) não tiver guarda de permissão. Para as rotas que resolvem permissão dentro do handler (`PATCH /api/payments/:id`, `POST|GET|DELETE /api/files/:id`), manter uma allowlist explícita e comentada apontando para TASK-8.

## Notas de implementação

- O teste de cobertura de rotas é o que impede uma rota nova nascer desprotegida. Ele precisa falhar de forma legível, nomeando método e caminho.
- A allowlist do item 8 é a única concessão do "nega por padrão" — mantê-la curta e justificada. Cada entrada nova ali deveria doer.
- Os fixtures de permissão devem derivar das mesmas listas do seed (TASK-2), não de listas copiadas no teste: matriz e teste divergirem em silêncio é o pior resultado possível.
- Preservar os casos existentes que continuam válidos — o arquivo é reescrito, não descartado.

## Critério de aceite

- [ ] Cada grupo semeado tem ao menos um acesso permitido e um negado por área.
- [ ] Usuário com dois grupos obtém a união correta das permissões.
- [ ] Usuário sem grupo autentica e recebe `403` nas rotas protegidas.
- [ ] `403` e `401` são verificados como distintos.
- [ ] Payload forjado com `role`/`groupIds`/`permissions` não altera a autorização.
- [ ] Baixa, cancelamento e edição de cobrança são negados de forma independente.
- [ ] Exclusão de anexo de contrato e de nota fiscal são negadas de forma independente.
- [ ] Os testes de payload filtrado do dashboard e de `/api/users/basic` passam.
- [ ] As regras de último admin, próprio vínculo, `tokenVersion` e `mustChangePassword` estão cobertas.
- [ ] O teste de cobertura de rotas passa e falha de forma legível quando uma rota fica sem guarda.
- [ ] Build e testes relevantes passam sem erros.
