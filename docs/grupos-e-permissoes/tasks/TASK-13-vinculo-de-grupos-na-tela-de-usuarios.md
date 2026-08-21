# TASK-13 — Vínculo de grupos na tela de usuários

**Arquivo alvo:** `client/src/components/Users/UserModal.tsx`, `client/src/components/Users/UsersPage.tsx` (existentes)
**Referência SPEC:** Seção 8.11
**Depende de:** TASK-6, TASK-11
**Bloqueada por:** TASK-12 (para carregar a lista de grupos já existente na interface)

---

## Contexto

`UserModal.tsx:167` tem um `<select>` de papel com duas opções, e `UsersPage.tsx:229` exibe um selo "Admin"/"Membro". Ambos passam a trabalhar com múltiplos grupos (PRD, DP-18).

## O que fazer

**1. `UserModal.tsx`**

- Estado `role` sai; entra `groupIds: string[]`.
- Carregar `GET /api/groups` para montar a lista de opções (nome + descrição).
- Substituir o `<select>` por uma lista de checkboxes de grupos, dentro de `<fieldset>` com `<legend>` "Grupos de acesso".
- No `useEffect` de abertura: em edição, preencher com os grupos do usuário; em criação, lista vazia.
- No submit:
  - criação → `POST /api/users` com `{ name, email, password, groupIds }`;
  - edição → `PATCH /api/users/:id` com `{ name, email, active, groupIds }`, e `password` quando preenchida.
- Preservar o guarda de auto-alteração: onde hoje está `if (!isSelf) payload.role = role`, passa a ser `if (!isSelf) payload.groupIds = groupIds`. Ao editar a si mesmo, as checkboxes ficam desabilitadas com texto explicando que não é possível alterar os próprios grupos.
- Exibir a mensagem do `422` do backend (último administrador ativo, próprios grupos) no `FormAlert`.
- Atualizar o `description` do `Modal`, que hoje cita "papel de acesso".

**2. `UsersPage.tsx`**

- Trocar o selo de papel (`UsersPage.tsx:229`) por selos com os nomes dos grupos do usuário; sem grupo, um selo neutro "Sem grupo".
- A coluna passa a se chamar "Grupos".

## Notas de implementação

- **Um usuário pode ficar sem nenhum grupo** — é estado válido (autentica, não acessa nada). A tela não deve forçar ao menos uma seleção; o selo "Sem grupo" existe para tornar isso visível na listagem.
- `groupIds` ausente no `PATCH` significa "não mexer nos grupos"; `[]` significa "remover de todos" (TASK-6). Ao editar a si mesmo, **não enviar o campo** — enviar `[]` seria pedir remoção e receber `422`.
- O `422` de último administrador ativo vem do backend, sempre. Não tentar antecipar a regra no cliente: a contagem de admins ativos é estado do servidor.
- Aproveitar `Field` e `controlClass` (`client/src/components/ui/Field.tsx`), como o restante do modal.
- Sem grupos cadastrados além do Admin, a lista mostra só ele — comportamento correto, não estado de erro.

## Critério de aceite

- [ ] O `<select>` de papel não existe mais; há seleção múltipla de grupos.
- [ ] Criar usuário grava os grupos marcados.
- [ ] Editar usuário atualiza os grupos.
- [ ] Editar a si mesmo desabilita a seleção de grupos e não envia `groupIds`.
- [ ] O `422` de último administrador ativo é exibido na interface.
- [ ] Usuário sem grupo é criado com sucesso e aparece com o selo "Sem grupo".
- [ ] A listagem mostra os nomes dos grupos de cada usuário.
- [ ] A seleção de grupos é navegável por teclado, em `fieldset` com `legend`.
- [ ] Build e testes relevantes passam sem erros.
