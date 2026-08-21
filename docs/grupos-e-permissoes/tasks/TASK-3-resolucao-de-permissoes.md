# TASK-3 — Resolução das permissões efetivas na autenticação

**Arquivo alvo:** `server/src/middlewares/requireAuth.ts`, `server/src/types/express.d.ts`, `server/src/routes/auth.ts` (todos existentes)
**Referência SPEC:** Seção 8.4
**Depende de:** TASK-1, TASK-2
**Bloqueada por:** nenhuma

---

## Contexto

`requireAuth` já busca o usuário no banco a cada requisição para conferir `active` e `tokenVersion`. Basta incluir os grupos nesse mesmo `select` para ter as permissões efetivas sem consulta adicional — e, de quebra, atender RF-15 (mudança de permissão vale na sessão aberta) sem inventar mecanismo de invalidação.

## O que fazer

**1. `server/src/types/express.d.ts`**

Em `AuthUser`: remover `role`; adicionar

```ts
groups: { id: string; name: string; permissions: string[] }[];
permissions: Set<string>;
```

**2. `server/src/middlewares/requireAuth.ts`**

- No `select` do `prisma.user.findUnique`: remover `role`, adicionar
  ```ts
  groups: { select: { group: { select: { id: true, name: true, permissions: true } } } }
  ```
- Montar `req.user` com `groups` achatado (`user.groups.map((g) => g.group)`) e `permissions: mergePermissions(groups)`.
- Não alterar nada da mecânica existente: allowlist pública, `tokenVersion`, `mustChangePassword`, sessão deslizante.

**3. `server/src/routes/auth.ts`**

- `GET /me` (`auth.ts:66`) devolve, no lugar de `role`:
  ```ts
  groups: req.user.groups.map(({ id, name }) => ({ id, name })),
  permissions: [...req.user.permissions],
  ```
- `POST /login` (`auth.ts:30`) devolve o mesmo formato de usuário que `/me`, para que o frontend não precise de uma segunda chamada após autenticar.

## Notas de implementação

- **Não colocar permissões no JWT.** O token dura 7 dias; permissão revogada precisa valer na requisição seguinte (SPEC 7.2).
- `permissions` é `Set` em `req.user` (uso quente é `has()`) e **array** no JSON de `/me` (`Set` não serializa).
- `tokenVersion` continua com a responsabilidade que já tem — desativação de usuário e troca de senha. Mudança de grupo **não** precisa incrementá-lo: a leitura por requisição já resolve.
- Rotas sempre liberadas, independentemente de permissão: `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/logout`.
- Conferir que o `select` achatado não quebra `MUST_CHANGE_PASSWORD_ALLOWED_ROUTES`.

## Critério de aceite

- [ ] `AuthUser` não tem mais `role`; tem `groups` e `permissions`.
- [ ] `requireAuth` continua executando **uma** consulta por requisição.
- [ ] `req.user.permissions` é a união das permissões de todos os grupos do usuário.
- [ ] Usuário sem nenhum grupo recebe `permissions` vazio, sem erro.
- [ ] `GET /api/auth/me` devolve `groups` e `permissions`; não devolve `role`.
- [ ] `POST /api/auth/login` devolve o mesmo formato de usuário que `/me`.
- [ ] Os testes existentes de `mustChangePassword` e de invalidação por `tokenVersion` continuam passando.
- [ ] Build e testes relevantes passam sem erros.
