# TASK-6 — Vínculo de grupos na API de usuários

**Arquivo alvo:** `server/src/routes/users.ts` (existente)
**Referência SPEC:** Seção 8.10
**Depende de:** TASK-4
**Bloqueada por:** nenhuma

---

## Contexto

`users.ts` trabalha com `role` no payload e implementa duas salvaguardas que precisam sobreviver à troca de modelo: ninguém altera o próprio papel (`users.ts:93`) e o último admin ativo não pode ser rebaixado nem desativado (`users.ts:98-114`). Ambas passam a valer sobre o vínculo com o grupo de sistema. Esta task também entrega o endpoint reduzido que destrava o filtro "Responsável" para o Operacional (PRD, DP-06).

## O que fazer

**1. Schemas**

- `createUserSchema`: remover `role`; adicionar `groupIds: z.array(z.string().uuid()).default([])`.
- `updateUserSchema`: remover `role`; adicionar `groupIds: z.array(z.string().uuid()).optional()`.

**2. Rotas e permissões**

| Rota | Permissão |
|---|---|
| `GET /api/users` | `users.view` |
| `GET /api/users/basic` | `users.view_basic` |
| `POST /api/users` | `users.manage` |
| `PATCH /api/users/:id` | `users.manage` |

**3. `GET /api/users`** — devolve `groups: [{ id, name }]` no lugar de `role`.

**4. Novo `GET /api/users/basic`** — `[{ id, name }]`, apenas `active: true`, ordenado por nome. **Sem** e-mail, sem grupos, sem `mustChangePassword`. Declarar **antes** de qualquer rota com parâmetro no mesmo router.

**5. `POST /api/users`** — grava os vínculos de `groupIds`. Todo id deve existir; id inexistente → `400`.

**6. `PATCH /api/users/:id`**

- **RF-28** — alterar os próprios `groupIds` devolve `422` `"Não é possível alterar os próprios grupos"` (equivalente à regra de `users.ts:93`).
- **RF-10** — substituir a checagem baseada em `role` por:
  ```ts
  const adminGroup = await prisma.group.findFirst({ where: { isSystem: true } });
  const isTargetActiveAdmin = targetUser.active &&
    targetUser.groups.some((g) => g.groupId === adminGroup.id);
  const losesAdmin = data.groupIds !== undefined && !data.groupIds.includes(adminGroup.id);

  if (isTargetActiveAdmin && (losesAdmin || data.active === false)) {
    const activeAdmins = await prisma.user.count({
      where: { active: true, groups: { some: { groupId: adminGroup.id } } },
    });
    if (activeAdmins <= 1) {
      return res.status(422).json({
        error: 'Não é possível desativar ou remover o único administrador ativo',
      });
    }
  }
  ```
- Escrever os vínculos com `deleteMany` + `createMany` de `UserGroup` junto ao `update` do usuário, dentro de `prisma.$transaction`.
- Preservar intacto o que já existe: desativar incrementa `tokenVersion`; reset de senha define `mustChangePassword` e incrementa `tokenVersion`.

## Notas de implementação

- **Ordem de rotas:** `GET /basic` antes de qualquer `/:id`, senão o Express captura `basic` como parâmetro.
- `GET /api/users/basic` é consumido por `ClientsPage` e `KanbanPage` (TASK-14). Devolver campo a mais aqui é vazamento: o Operacional tem `users.view_basic`, não `users.view`.
- A escrita de vínculos precisa ser atômica — um `deleteMany` bem-sucedido seguido de `createMany` que falha deixaria o usuário sem nenhum grupo.
- `data.groupIds === undefined` significa "não mexer nos grupos"; `[]` significa "remover de todos". São casos diferentes.
- Os testes de `permissions.test.ts` que hoje cobrem último admin e alteração do próprio papel serão reescritos em TASK-10 para o modelo de grupos.

## Critério de aceite

- [ ] `role` não aparece mais em nenhum schema Zod nem em resposta de `users.ts`.
- [ ] `POST` e `PATCH` gravam vínculos a partir de `groupIds`; id de grupo inexistente devolve `400`.
- [ ] `GET /api/users` devolve `groups: [{ id, name }]`.
- [ ] `GET /api/users/basic` devolve só `id` e `name` de usuários ativos, e exige `users.view_basic`.
- [ ] Alterar os próprios grupos devolve `422`.
- [ ] Remover ou desativar o último usuário ativo do grupo de sistema devolve `422`.
- [ ] A gravação de vínculos é atômica.
- [ ] `groupIds` ausente não altera os vínculos; `[]` remove todos.
- [ ] Desativação e reset de senha continuam incrementando `tokenVersion`.
- [ ] Build e testes relevantes passam sem erros.
