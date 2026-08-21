# TASK-12 — Tela de grupos e matriz de permissões

**Arquivo alvo:** `client/src/components/Groups/GroupsPage.tsx`, `GroupModal.tsx`, `PermissionMatrix.tsx` (todos novos)
**Referência SPEC:** Seção 8.11
**Depende de:** TASK-5, TASK-11
**Bloqueada por:** nenhuma

---

## Contexto

É a tela que entrega o pedido central: criar grupos, marcar telas e ações, vincular gente depois. A matriz também aplica a regra do DP-20 — permissão de tela só pode ser marcada com a permissão de leitura correspondente, avisando qual falta e **impedindo** a marcação incoerente.

## O que fazer

**1. `GroupsPage.tsx`** — rota `/grupos`

- Carregar `GET /api/groups` e `GET /api/permissions` em paralelo com react-query (padrão do projeto).
- Lista com nome, descrição, contagem de permissões, contagem de usuários e selo "Sistema" no grupo Admin.
- Botão "Novo grupo" (visível com `groups.manage`).
- Ações por linha: editar e excluir, **desabilitadas** em grupo de sistema, com `title` explicando o porquê.
- Exclusão via `ConfirmDialog` (`client/src/components/ui/ConfirmDialog.tsx`). O `422` de grupo com usuários vinculados deve exibir a mensagem do backend, com a contagem.
- Estados de carregando, vazio e erro com os componentes de `client/src/components/ui/States.tsx`.

**2. `GroupModal.tsx`**

- Usa `Modal` e `Field` já existentes (`client/src/components/ui/`).
- Campos: nome (obrigatório), descrição (opcional) e a matriz.
- Cria via `POST /api/groups`, edita via `PATCH /api/groups/:id`.
- Tratar `400` (nome duplicado, permissão inválida) e `422` (`violations`) exibindo a mensagem no `FormAlert`, e destacando na matriz a tela citada em `violations`.
- `toast.success` ao salvar, como nas demais telas.

**3. `PermissionMatrix.tsx`**

- Recebe `catalog: PermissionCatalog`, `value: string[]` e `onChange`.
- Agrupa as checkboxes por `category`, cada categoria em `<fieldset>` com `<legend>`.
- **Regra do DP-20**, usando `screenDependencies` vindo da API:
  - a checkbox de uma tela fica `disabled` enquanto nenhuma das permissões de `requiresAnyOf` estiver marcada; abaixo dela, texto de apoio "Requer: Ver cobranças", associado por `aria-describedby`;
  - desmarcar a última permissão de leitura que sustenta uma tela marcada **desmarca a tela junto** e anuncia o efeito num contêiner `role="status"` ("A tela Financeiro foi desmarcada porque depende de Ver cobranças").
- Exibir aviso visível ao lado das permissões `clients.export` e `payments.export`, lembrando que concedem a base completa (dado pessoal, LGPD).

## Notas de implementação

- **A regra do DP-20 é aplicada com os dados da API, não reimplementada no cliente.** `screenDependencies` é a mesma estrutura que o backend valida; a tela só a interpreta.
- A validação do cliente é conveniência. O backend rejeita com `422` de qualquer forma (TASK-5), e a tela precisa lidar com esse `422` — inclusive porque o catálogo pode mudar entre o carregamento e o salvamento.
- Grupo de sistema: além de desabilitar os botões, não abrir o modal em modo de edição. O backend recusa, mas a tela não deve oferecer a ação.
- Acessibilidade é requisito, não polimento (SPEC 11): `fieldset`/`legend` por categoria, `aria-describedby` na dependência, `role="status"` na desmarcação automática. O projeto já trata acessibilidade como critério — ver o commit `1632326`.
- Muitas checkboxes numa tela só: agrupar por categoria com cabeçalho fixo ou colapsável, e garantir que a navegação por Tab siga a ordem visual.

## Critério de aceite

- [ ] `/grupos` lista os grupos com contagem de permissões e de usuários, e selo no grupo de sistema.
- [ ] O Admin cria um grupo com nome, descrição e permissões marcadas.
- [ ] O Admin edita as permissões de um grupo existente.
- [ ] O Admin exclui um grupo sem usuários; com usuários, vê o `422` com a contagem.
- [ ] Editar ou excluir o grupo de sistema não é oferecido na interface.
- [ ] Uma permissão de tela não pode ser marcada sem a permissão de leitura exigida.
- [ ] O aviso nomeia exatamente a permissão que falta.
- [ ] Desmarcar a permissão de leitura desmarca as telas dependentes e anuncia o efeito.
- [ ] `screen.dashboard` fica habilitada com qualquer uma das duas permissões de dashboard.
- [ ] O `422` do backend é exibido e destaca a tela citada em `violations`.
- [ ] A matriz é navegável por teclado, com categorias em `fieldset`/`legend` e dependências associadas por `aria-describedby`.
- [ ] As permissões de exportação exibem o aviso sobre base completa.
- [ ] Build e testes relevantes passam sem erros.
