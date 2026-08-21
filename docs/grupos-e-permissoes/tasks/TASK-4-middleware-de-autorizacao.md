# TASK-4 — Middleware de autorização por permissão

**Arquivo alvo:** `server/src/middlewares/requirePermission.ts` (novo), `server/src/middlewares/requireAdmin.ts` (remover), `server/src/middlewares/errorHandler.ts`, `server/src/app.ts` (existentes)
**Referência SPEC:** Seção 8.5
**Depende de:** TASK-3
**Bloqueada por:** nenhuma

---

## Contexto

`requireAdmin` é um `if (role !== 'admin')` montado em dois pontos (`app.ts:43-44`). Ele sai e entra um middleware por permissão, mais um utilitário para uso dentro de handlers que ramificam por intenção (cobranças e arquivos).

## O que fazer

**1. Criar `server/src/middlewares/requirePermission.ts`**

```ts
export class ForbiddenError extends Error {
  constructor(public readonly requiredPermission: Permission) { super('Forbidden'); }
}

/** Guarda de rota: exige uma permissão. */
export function requirePermission(permission: Permission): RequestHandler;

/** Guarda de rota: concede quando o usuário tem ao menos uma das permissões. */
export function requireAnyPermission(...permissions: Permission[]): RequestHandler;

/** Uso dentro de handler que ramifica por intenção. Lança ForbiddenError. */
export function assertPermission(req: Request, permission: Permission): void;
```

Resposta de negação, nos três casos:

```json
{ "error": "Você não tem permissão para executar esta ação.", "requiredPermission": "payments.cancel" }
```

com status `403`. Em `requireAnyPermission`, `requiredPermission` traz a primeira das permissões avaliadas.

Registrar a negação com `console.warn` contendo `userId`, `method`, `path` e `requiredPermission` — **sem** nome, e-mail ou qualquer dado pessoal.

**2. `server/src/middlewares/errorHandler.ts`**

Antes do tratamento de `ZodError`, tratar `ForbiddenError` devolvendo `403` no mesmo formato acima. Mantém o handler como ponto único de tradução de erro.

**3. `server/src/app.ts`**

- Remover o import e as duas montagens de `requireAdmin`.
- Montar `/api/users` e `/api/settings` sem guarda de prefixo — cada rota declara a sua permissão dentro do router, porque `/api/users/basic` e `/api/settings/billing` exigem permissão diferente do resto do prefixo.
- Registrar `app.use('/api/groups', groupsRouter)` e `app.use('/api/permissions', permissionsRouter)` (criados em TASK-5).

**4. Excluir `server/src/middlewares/requireAdmin.ts`.**

## Notas de implementação

- **`403` e `401` são distintos** (RF-29): `401` = não autenticado (já tratado em `requireAuth`); `403` = autenticado sem permissão.
- `client/src/services/api.ts` já mapeia `403` para "Você não tem permissão para executar esta ação." — o texto do backend deve bater com esse padrão, e a sanitização de mensagem em `api.ts` (máx. 300 caracteres, sem `<>`) precisa aceitá-lo.
- `assertPermission` **lança** em vez de responder, para funcionar no meio de um handler já em andamento sem `return res` espalhado.
- Não introduzir permissão implícita para "admin": no modelo novo, o Admin tem todas as permissões porque o grupo concede todas, não porque o código o trata como caso especial. Nenhum `if (isAdmin) return next()`.
- Depois desta task, as rotas ainda estão sem guarda — TASK-7, TASK-8 e TASK-9 aplicam. O sistema não regride nesse intervalo: `requireAdmin` protegia só dois prefixos, que TASK-6 e TASK-9 recuperam com permissão equivalente.

## Critério de aceite

- [ ] `requirePermission`, `requireAnyPermission` e `assertPermission` existem e devolvem `403` com `error` e `requiredPermission`.
- [ ] `ForbiddenError` lançada dentro de um handler vira `403` no `errorHandler`.
- [ ] `requireAdmin.ts` não existe mais e não há import remanescente.
- [ ] Nenhum caminho do código concede acesso por ser "admin" fora do conjunto de permissões.
- [ ] A negação é registrada em log com `userId`, `method`, `path` e `requiredPermission`, sem dado pessoal.
- [ ] Build e testes relevantes passam sem erros.
