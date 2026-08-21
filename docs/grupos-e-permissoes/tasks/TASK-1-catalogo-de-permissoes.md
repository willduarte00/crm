# TASK-1 — Catálogo de permissões no domínio

**Arquivo alvo:** `server/src/domain/permissions.ts` (novo), `server/src/__tests__/domain.permissions.test.ts` (novo)
**Referência SPEC:** Seção 8.2
**Depende de:** nenhuma
**Bloqueada por:** nenhuma

---

## Contexto

Toda a autorização parte de um catálogo fechado de permissões e de um punhado de funções puras (união, validação, coerência tela↔leitura). O projeto já concentra regra pura em `server/src/domain/*.ts`, sem Express nem Prisma, testada isoladamente em `domain.*.test.ts` — esta task segue essa convenção. Nenhuma outra task avança sem ela.

## O que fazer

Criar `server/src/domain/permissions.ts` exportando:

1. `PERMISSIONS` — array `as const` com as 44 chaves do catálogo (SPEC 8.2 e PRD "Catálogo de permissões").
2. `type Permission = (typeof PERMISSIONS)[number]`.
3. `PERMISSION_CATALOG: PermissionMeta[]` — para cada permissão: `key`, `label` em pt-BR, `category` (`'Telas' | 'Clientes' | 'Interações' | 'Contratos' | 'Cobranças' | 'Dashboard' | 'Configurações' | 'Usuários e grupos'`) e, nas permissões de tela, `requiresAnyOf`.
4. `SCREEN_DEPENDENCIES: Record<string, Permission[]>` — o mapa tela → permissões de leitura aceitas (SPEC 8.2).
5. `SCREEN_ORDER: Permission[]` — ordem do menu, usada por `firstAllowedScreen`: dashboard, clientes, pipeline, contratos, financeiro, usuários, configurações, grupos.
6. `SCREEN_ROUTES: Record<string, string>` — tela → caminho do frontend (`screen.dashboard` → `/`, `screen.pipeline` → `/pipeline`, …), consumido pelo redirecionamento inicial.
7. `isValidPermission(value: string): value is Permission`.
8. `mergePermissions(groups: { permissions: string[] }[]): Set<string>`.
9. `findScreenDependencyViolations(permissions: string[]): ScreenDependencyViolation[]` — para cada tela concedida, se nenhuma das permissões de `SCREEN_DEPENDENCIES` estiver presente, devolve `{ screen, missingAnyOf }`.
10. `firstAllowedScreen(permissions: Set<string>): Permission | null`.

Criar `server/src/__tests__/domain.permissions.test.ts` cobrindo:

- `mergePermissions` com zero grupos, um grupo, vários grupos com sobreposição — resultado sem duplicatas.
- `isValidPermission` aceitando cada chave do catálogo e rejeitando chave inventada.
- `findScreenDependencyViolations`: uma tela sem a leitura correspondente; a mesma tela com a leitura presente; `screen.dashboard` com apenas `dashboard.financial.view`, com apenas `dashboard.operational.view` e sem nenhuma das duas.
- `firstAllowedScreen` respeitando `SCREEN_ORDER`, devolvendo `null` com conjunto vazio, e devolvendo `screen.pipeline` para o conjunto do grupo Operacional.
- **Consistência do catálogo:** toda chave de `SCREEN_DEPENDENCIES`, `SCREEN_ORDER` e `SCREEN_ROUTES` existe em `PERMISSIONS`; todo item de `PERMISSION_CATALOG` corresponde a uma permissão existente e vice-versa (sem sobra dos dois lados); todo valor de `requiresAnyOf` existe em `PERMISSIONS`.

## Notas de implementação

- O arquivo não importa Express nem Prisma. É domínio puro.
- `SCREEN_DEPENDENCIES` é a **única** fonte da regra do DP-20: backend valida por ela e a API a devolve ao frontend. Não replicar a regra em outro lugar.
- `mergePermissions` devolve `Set`, não array: o uso quente é `has()` em cada requisição.
- O teste de consistência do catálogo é o que impede uma chave órfã aparecer depois. Ele deve falhar se alguém adicionar a `PERMISSIONS` sem adicionar ao `PERMISSION_CATALOG`.
- Rótulos em pt-BR; chaves em inglês — a convenção do projeto (`PROJECT-CONTEXT.md`).

## Critério de aceite

- [ ] `PERMISSIONS` tem exatamente as 44 chaves listadas no PRD.
- [ ] `findScreenDependencyViolations` trata `screen.dashboard` como OR entre as duas permissões de dashboard.
- [ ] `firstAllowedScreen` devolve `null` para conjunto vazio.
- [ ] O teste de consistência falha se catálogo e lista de permissões divergirem.
- [ ] Build e testes relevantes passam sem erros.
