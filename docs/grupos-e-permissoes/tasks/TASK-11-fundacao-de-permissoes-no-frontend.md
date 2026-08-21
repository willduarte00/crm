# TASK-11 — Fundação de permissões no frontend

**Arquivo alvo:** `client/src/types/index.ts`, `client/src/types/permission.ts` (novo), `client/src/context/AuthContext.tsx`, `client/src/components/Auth/RequireAuth.tsx`, `client/src/App.tsx`, `client/src/components/Layout/AppShell.tsx`
**Referência SPEC:** Seção 8.11
**Depende de:** TASK-3
**Bloqueada por:** nenhuma

---

## Contexto

O frontend hoje tem um único eixo de acesso: `user.role === 'admin'`, usado em `RequireAuth.tsx:40` e `AppShell.tsx:46`. Esta task troca esse eixo por permissões e resolve o efeito colateral do DP-01: o Dashboard é a rota `/`, e o Operacional não tem acesso a ele.

## O que fazer

**1. Tipos**

`client/src/types/index.ts`:
- Remover `Role` e `User.role`.
- Adicionar `Group { id: string; name: string }` e `User.groups: Group[]`.
- `AuthResponse.user` ganha `permissions: string[]`.

`client/src/types/permission.ts` (novo) — tipos do catálogo recebido da API:
```ts
export type PermissionKey = string;
export interface PermissionMeta { key: PermissionKey; label: string; category: string; requiresAnyOf?: PermissionKey[]; }
export interface PermissionCatalog { permissions: PermissionMeta[]; screenDependencies: Record<string, PermissionKey[]>; }
```
**Não** replicar a lista de chaves — ela vem de `GET /api/permissions`.

**2. `client/src/context/AuthContext.tsx`**

Expor, sobre um `Set` memoizado de `user.permissions`:
```ts
has: (permission: string) => boolean;
hasAny: (...permissions: string[]) => boolean;
```
Ambos devolvem `false` quando não há usuário.

**3. `client/src/components/Auth/RequireAuth.tsx`**

- `adminOnly?: boolean` sai; entram `permission?: string` e `anyPermission?: string[]`.
- Sem a permissão, redirecionar para a **primeira tela permitida**, não para `/` — que pode ser justamente a proibida.
- Preservar o que já existe: estado de carregamento, redirecionamento para `/login` sem usuário, `ForceChangePasswordModal` em `mustChangePassword`.

**4. `client/src/App.tsx`**

- Criar `HomeRedirect`: resolve a primeira tela permitida na ordem do menu (dashboard, clientes, pipeline, contratos, financeiro, usuários, configurações, grupos) e faz `<Navigate replace>`. Sem nenhuma tela permitida, renderiza o estado "sem acesso".
- A rota índice passa a renderizar `HomeRedirect`; o Dashboard ganha caminho próprio (`/dashboard`) protegido por `screen.dashboard`.
- Cada rota recebe sua permissão: `/clientes` → `screen.clientes`, `/pipeline` → `screen.pipeline`, `/contratos` → `screen.contratos`, `/financeiro` → `screen.financeiro`, `/usuarios` → `screen.usuarios`, `/configuracoes` → `screen.configuracoes`.
- Nova rota `/grupos` → `screen.grupos`, com `lazy` como as demais rotas pesadas.

**5. `client/src/components/Layout/AppShell.tsx`**

- Fundir `NAV_ITEMS` e `ADMIN_NAV_ITEMS` numa lista única, cada item com `permission`, filtrada por `has()`. `isAdmin` sai.
- Acrescentar o item "Grupos e permissões" (`/grupos`, `screen.grupos`).
- O rodapé que hoje mostra `'Admin' | 'Membro'` (`AppShell.tsx:178`) passa a listar os nomes dos grupos do usuário; sem grupo, "Sem grupo".
- Usuário sem nenhuma permissão de tela: renderizar `EmptyState` ("Nenhum acesso liberado. Procure o administrador."), mantendo disponíveis apenas trocar senha e sair.
- `pageTitleFor` passa a derivar da lista unificada.

## Notas de implementação

- **A ordem do menu é a mesma ordem do redirecionamento inicial.** Definir a lista uma vez e derivar as duas coisas dela; duas listas paralelas divergem.
- Mover o Dashboard de `/` para `/dashboard` afeta todo mundo, inclusive o Admin — que continua caindo nele por ser o primeiro item do menu. Verificar manualmente.
- Permissão de tela é conveniência: quem forçar a URL vê a casca e recebe `403` nos dados. A proteção real está no backend.
- `has()` deve ser estável entre renders (memoizar o `Set`), senão vira churn de re-render em toda tela que o consome.
- Aproveitar `EmptyState` de `client/src/components/ui/States.tsx` (já usa `role="alert"`), em vez de criar componente novo.

## Critério de aceite

- [ ] `Role` e `user.role` não existem mais no frontend.
- [ ] `AuthContext` expõe `has()` e `hasAny()`, com `false` sem usuário.
- [ ] `RequireAuth` aceita `permission` e `anyPermission`; `adminOnly` não existe mais.
- [ ] Sem permissão, o redirecionamento vai para a primeira tela permitida, não para `/`.
- [ ] A rota índice redireciona conforme as permissões; o Operacional cai no Pipeline.
- [ ] `/grupos` existe e é protegida por `screen.grupos`.
- [ ] O menu exibe apenas os itens cujas permissões `screen.*` o usuário tem.
- [ ] O rodapé mostra os nomes dos grupos do usuário.
- [ ] Usuário sem nenhuma tela permitida vê o estado "sem acesso", com trocar senha e sair funcionando.
- [ ] Build e testes relevantes passam sem erros.
