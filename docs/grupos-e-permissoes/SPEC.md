# SPEC — Grupos e permissões de acesso

## 1. Contexto da solicitação

### 1.1 História ou tarefa do usuário

- Solicitante: Willian (produto/desenvolvimento do CRM interno)
- Tipo: feature
- História/tarefa: o CRM precisa deixar de tratar todo não-admin como um único papel. A equipe passou a ter funções distintas — operação e financeiro — e uma mesma pessoa pode acumular as duas. O Admin quer criar grupos, marcar quais telas e quais ações cada grupo concede, e vincular usuários a um ou mais grupos.
- Valor esperado: cada pessoa acessa só o que a função exige; o acesso vira configuração de produto, não deploy; e as lacunas de segurança abertas hoje (exportação de base sem restrição, dados bancários vazando no dashboard, escrita liberada a qualquer autenticado) fecham.

### 1.2 Problema observado

O sistema tem dois papéis (`admin`, `membro`) e autorização em dois pontos apenas (`server/src/app.ts:43-44`). Todo o resto da API exige só estar autenticado. Consequências reais no código atual:

- `GET /api/export/clients` e `GET /api/export/payments` (`server/src/routes/export.ts:40,99`) entregam a base completa de clientes — com CPF/CNPJ, telefone e e-mail — e de cobranças a qualquer usuário logado.
- `GET /api/dashboard` (`server/src/routes/dashboard.ts:24`) devolve MRR, faturado, recebido, inadimplência e alertas de vencido **e também** `pixKey`, `pixKeyType`, `bankName`, `bankBranch` e `bankAccount` no bloco `settings` da resposta — os mesmos dados que `/api/settings` protege com `requireAdmin`. É um segundo caminho, desprotegido, para a informação bancária da agência.
- `DELETE /api/clients/:id`, `DELETE /api/contracts/:id`, `DELETE /api/files/:id` e `POST /api/clients/batch-reassign` aceitam qualquer autenticado.
- `User.role` é um campo único: não há como acumular funções (PRD, DP-18).

Detalhe do PRD que o código confirma: `ClientsPage.tsx:161` e `KanbanPage.tsx:67` chamam `GET /api/users`, que é admin-only — o filtro "Responsável" já quebra hoje para qualquer não-admin. E `FinancialPage.tsx:82` chama `GET /api/settings` com `.catch()` silencioso, então o bloco de PIX/banco da tela financeira já falha em silêncio para não-admin.

### 1.3 Objetivo da entrega

Um usuário só executa o que suas permissões efetivas concedem, validado no servidor a cada operação; o Admin administra grupos e vínculos pela interface; e nenhuma rota protegida responde sem permissão declarada.

## 2. Objetivo técnico

Substituir o par `User.role` + `requireAdmin` por um modelo de autorização baseado em permissões granulares:

- **catálogo de permissões** declarado em `server/src/domain/permissions.ts` (domínio puro, testável isoladamente — convenção do projeto);
- **grupos** persistidos, com um conjunto de permissões cada;
- **vínculo N-N** usuário↔grupo, com permissões efetivas = união;
- **middleware `requirePermission`** aplicado em todas as rotas protegidas, mais checagens por ação dentro dos handlers que hoje concentram várias operações;
- **frontend derivando** menu, rotas e botões das permissões devolvidas por `GET /api/auth/me`.

Capacidade nova habilitada: criar um grupo e recortar acesso sem tocar em código.

## 3. Estado atual

**Autenticação** — `server/src/middlewares/requireAuth.ts` valida o JWT do cookie, busca o usuário no banco a cada requisição (`prisma.user.findUnique` com `select` de `id, email, name, role, active, mustChangePassword, tokenVersion`), confere `active` e `tokenVersion`, popula `req.user` (`server/src/types/express.d.ts`) e renova o cookie. Já existe o mecanismo de `tokenVersion` para invalidar sessões.

**Autorização** — `server/src/middlewares/requireAdmin.ts` é um `if (!req.user || req.user.role !== 'admin')` que devolve `403`. Montado em dois pontos (`server/src/app.ts:43-44`), cobrindo `/api/users` e `/api/settings`. Nenhuma outra rota tem checagem.

**Papéis** — `User.role String @default("membro")` em `server/prisma/schema.prisma`, validado por `z.enum(['admin','membro'])` em `server/src/routes/users.ts:11,17` e tipado como `Role` em `client/src/types/index.ts:1`. Regras de integridade já existentes em `server/src/routes/users.ts:93-114`: ninguém altera o próprio papel (`422`); o último admin ativo não pode ser rebaixado nem desativado (`422`); desativar incrementa `tokenVersion`.

**Endpoints que concentram várias ações**

- `PATCH /api/payments/:id` (`server/src/routes/payments.ts:304`) resolve baixa (`isMarkingPaid`), cancelamento (`status === 'Cancelado'`), reversão para pendente e edição de `amountCents`/`dueDate`/`referenceMonth`/`notes` no mesmo handler.
- `POST /api/files` (`server/src/routes/files.ts:30`) recebe `contractId` **ou** `paymentRecordId` e ramifica.
- `DELETE /api/files/:id` (`server/src/routes/files.ts:188`) procura primeiro em `contractFile`, depois em `invoiceFile`, e apaga o arquivo do disco em qualquer um dos casos.

**Frontend** — `client/src/App.tsx` define as rotas; `/usuarios` e `/configuracoes` usam `<RequireAuth adminOnly>` (`client/src/components/Auth/RequireAuth.tsx:40`), que redireciona para `/` quando `user.role !== 'admin'`. `client/src/components/Layout/AppShell.tsx:20-30` tem `NAV_ITEMS` fixos e `ADMIN_NAV_ITEMS` exibidos por `isAdmin`. `client/src/context/AuthContext.tsx` carrega o usuário de `GET /api/auth/me`. `client/src/services/api.ts` já mapeia `403` para "Você não tem permissão para executar esta ação."

**Testes** — `server/src/__tests__/permissions.test.ts` cobre admin vs membro em `/api/users` e `/api/settings`, incluindo chamada direta sem UI, regras de último admin e `mustChangePassword`.

**Banco** — em fase de testes, sem dado de produção (PRD, DP-16/DP-17).

## 4. Escopo da solução

### 4.1 O que muda

| Área | Estado atual | Estado esperado | Impacto |
|---|---|---|---|
| `server/prisma/schema.prisma` | `User.role` string livre | `role` removido; modelos `Group`, `UserGroup`; `User.groups` | Alto |
| `server/src/domain/permissions.ts` | não existe | catálogo de permissões, dependências tela→leitura, união e validações puras | Alto |
| `server/src/middlewares/requireAdmin.ts` | `if role !== 'admin'` | substituído por `requirePermission` / `requireAnyPermission` | Alto |
| `server/src/middlewares/requireAuth.ts` | carrega `role` | carrega grupos e calcula permissões efetivas em `req.user.permissions` | Médio |
| `server/src/app.ts` | 2 pontos com `requireAdmin` | montagem sem guarda global; cada rota declara sua permissão | Médio |
| `server/src/routes/groups.ts` | não existe | CRUD de grupos + catálogo de permissões | Alto |
| `server/src/routes/users.ts` | `role` no payload | `groupIds[]`; rota `/basic`; regras de último admin por grupo | Alto |
| `server/src/routes/payments.ts` | um `PATCH` para tudo | permissão por intenção: `settle`, `cancel`, `update` | Médio |
| `server/src/routes/files.ts` | um handler por tipo | permissão por tipo de arquivo em `POST`, `GET` e `DELETE` | Médio |
| `server/src/routes/dashboard.ts` | payload único, com dados bancários | blocos filtrados por permissão; bloco bancário só com `settings.bank.view` | Médio |
| `server/src/routes/settings.ts` | `GET`/`PUT` admin-only | `GET /billing` reduzido com `settings.bank.view` | Baixo |
| `server/src/routes/export.ts` | sem guarda | `clients.export` e `payments.export` | Baixo |
| `server/src/routes/clients.ts`, `contracts.ts` | sem guarda | permissão por rota | Médio |
| `server/prisma/seed.ts` | cria admin com `role` | cria os 3 grupos e vincula o admin ao grupo Admin | Médio |
| `client/src/types/index.ts` | `Role = 'admin' \| 'membro'` | `Group`, `permissions: string[]`, `User.groups` | Médio |
| `client/src/context/AuthContext.tsx` | expõe `user` | expõe `has()` e `hasAny()` | Médio |
| `client/src/components/Auth/RequireAuth.tsx` | `adminOnly` | `permission` / `anyPermission` | Médio |
| `client/src/App.tsx` | `/` = Dashboard | rota índice redireciona para a primeira tela permitida; `/grupos` | Médio |
| `client/src/components/Layout/AppShell.tsx` | `isAdmin` | itens de menu filtrados por `screen.*` | Médio |
| `client/src/components/Groups/` | não existe | `GroupsPage.tsx`, `GroupModal.tsx`, `PermissionMatrix.tsx` | Alto |
| `client/src/components/Users/UserModal.tsx` | select de papel | seleção múltipla de grupos | Médio |
| `ClientsPage.tsx`, `KanbanPage.tsx` | `GET /api/users` | `GET /api/users/basic`; botões por permissão | Médio |
| `FinancialPage.tsx`, `PaymentDetailsModal.tsx` | `GET /api/settings`; ações livres | `GET /api/settings/billing`; ações por permissão | Médio |
| `ContractsPage.tsx`, `ContractFilesModal.tsx`, `ClientDetailsModal.tsx` | ações livres | ações e aba de contratos por permissão | Médio |
| `server/src/__tests__/permissions.test.ts` | admin vs membro | por grupo, por acúmulo, por ausência de grupo | Alto |

### 4.2 O que não muda

- Mecânica de autenticação: JWT em cookie `httpOnly`, `tokenVersion`, sessão deslizante, `mustChangePassword`, rate limit no login.
- Regras de negócio: numeração `COB-AAAA-NNNN` e `PaymentSequence`, validação de CPF/CNPJ por módulo 11, normalização E.164, valores em centavos, exclusão lógica por `deletedAt`, cálculo de métricas e `MetricSnapshot`.
- Listas fechadas de `server/src/domain/clients.ts` (estágios, origens, prioridades, serviços).
- Formato de erro do `errorHandler` e o mapeamento de status em `client/src/services/api.ts`.
- Layout e navegação do `AppShell` além da filtragem de itens.
- Escopo de dado: todos que têm `clients.view` veem todos os clientes; nenhum filtro por `ownerId` (PRD, DP-19).

### 4.3 Restrições e pressupostos

- **Banco em teste, sem migração de dados.** A migration pode remover `User.role` sem conversão; o seed recria o estado inicial.
- **Não existe pacote compartilhado entre `client/` e `server/`.** O catálogo canônico vive no servidor; o cliente o obtém por API (ver 8.6) em vez de manter uma segunda cópia — o `PROJECT-CONTEXT.md` já registra a duplicação de `formatters.ts` como risco recorrente e esta SPEC não cria outra.
- **Permissões são lidas do banco a cada requisição**, não do JWT: o token vive 7 dias e uma permissão revogada precisa valer imediatamente.
- **Só existe conceder.** A união nunca subtrai; não há negação explícita.
- **O grupo Admin é imutável** (`isSystem`), e o sistema nunca fica sem um usuário ativo nele.
- Pressuposto: o volume de grupos é pequeno (unidades), o que torna aceitável carregar grupos e permissões junto com o usuário em cada requisição.

## 5. Requisitos funcionais

| ID | Requisito funcional | Prioridade | Origem |
|---|---|---|---|
| RF-01 | O sistema deve manter um catálogo fechado de permissões e rejeitar chave fora dele | must | PRD — catálogo |
| RF-02 | O sistema deve persistir grupos com nome único e um conjunto de permissões | must | PRD — modelo |
| RF-03 | O sistema deve permitir vincular um usuário a zero, um ou vários grupos | must | PRD — DP-18 |
| RF-04 | As permissões efetivas do usuário devem ser a união das permissões de seus grupos | must | PRD — modelo |
| RF-05 | O sistema deve negar por padrão: permissão ausente, ou rota protegida sem permissão declarada, resulta em `403` | must | PRD — segurança |
| RF-06 | A autorização deve ser validada no servidor em toda operação protegida, independentemente do frontend | must | PRD — segurança |
| RF-07 | O perfil considerado deve vir sempre do banco, nunca de corpo, query string ou token | must | PRD — segurança |
| RF-08 | O sistema deve semear os grupos Admin, Operacional e Financeiro conforme a matriz do PRD | must | PRD — matriz |
| RF-09 | O grupo Admin deve ser imutável: não editável, não renomeável, não excluível | must | PRD — salvaguardas |
| RF-10 | O sistema deve impedir desvincular ou desativar o último usuário ativo do grupo Admin (`422`) | must | PRD + `users.ts:98-114` |
| RF-11 | O sistema deve impedir excluir grupo com usuários vinculados (`422`), informando a quantidade | must | PRD — salvaguardas |
| RF-12 | Uma permissão de tela só pode ser concedida com a permissão de leitura correspondente; o backend rejeita com `422` | must | PRD — DP-20 |
| RF-13 | A tela de grupos deve impedir a marcação incoerente e avisar qual permissão falta | must | PRD — DP-20 |
| RF-14 | Desmarcar uma permissão de leitura deve desmarcar as telas dependentes, com aviso | must | PRD — DP-20 |
| RF-15 | Alterar grupos de um usuário, ou permissões de um grupo, deve valer nas sessões abertas sem novo login | must | PRD — fluxo |
| RF-16 | Usuário sem nenhum grupo deve autenticar e acessar apenas a própria conta | must | PRD — salvaguardas |
| RF-17 | `PATCH /api/payments/:id` deve exigir permissão distinta para baixa, cancelamento e edição | must | PRD — ações |
| RF-18 | `POST`, `GET` e `DELETE /api/files` devem distinguir anexo de contrato de nota fiscal | must | PRD — ações |
| RF-19 | `GET /api/dashboard` deve devolver apenas os blocos permitidos | must | PRD — DP-01 |
| RF-20 | `GET /api/dashboard` não deve devolver dados bancários sem `settings.bank.view` | must | vazamento em `dashboard.ts` |
| RF-21 | O sistema deve expor leitura reduzida de dados bancários para `settings.bank.view` | must | PRD — DP-12 |
| RF-22 | O sistema deve expor lista reduzida de usuários ativos (id + nome) para `users.view_basic` | must | PRD — DP-06 |
| RF-23 | As rotas de exportação devem exigir `clients.export` e `payments.export` | must | PRD — DP-07/DP-15 |
| RF-24 | O Admin deve criar, editar e excluir grupos pela interface | must | PRD — tela |
| RF-25 | O Admin deve vincular usuário a grupos pela tela de Usuários | must | PRD — tela |
| RF-26 | O frontend deve derivar menu, rotas e botões das permissões de `GET /api/auth/me` | must | PRD — fluxo |
| RF-27 | O login deve levar o usuário à primeira tela permitida | must | PRD — DP-01 |
| RF-28 | O sistema deve impedir que um usuário altere os próprios grupos (`422`) | should | análogo a `users.ts:93` |
| RF-29 | O `403` de permissão deve ser distinguível do `401` de não autenticado | must | PRD — critérios |

## 6. Cenários e fluxos esperados

### 6.1 Cenários principais

- Usuário do grupo Operacional entra, é levado ao Pipeline, arrasta um card de etapa e a alteração persiste.
- Usuário do grupo Financeiro emite cobrança a partir de um contrato ativo, dá baixa, anexa a nota fiscal e exporta o CSV do mês.
- Usuário vinculado a Operacional **e** Financeiro vê Dashboard, Clientes, Pipeline, Contratos e Financeiro no mesmo login, com a soma das ações.
- Admin cria o grupo "Estagiário de conteúdo" marcando `clients.view` e `screen.clientes`, vincula um usuário e ele passa a ver só a lista de clientes, sem botão de criar, editar ou excluir.
- Admin remove `payments.view` do grupo Financeiro; a tela Financeiro é desmarcada junto, com aviso, e some do menu dos membros do grupo na próxima requisição.

### 6.2 Edge cases e falhas esperadas

| Caso | Comportamento esperado |
|---|---|
| Usuário sem nenhum grupo faz login | Autentica; `/me` devolve `permissions: []`; vê tela "Nenhum acesso liberado"; qualquer rota protegida responde `403` |
| `curl` direto em `GET /api/export/clients` sem `clients.export` | `403`, sem passar pela UI |
| Corpo da requisição traz `permissions` ou `groupIds` forjados | Ignorado; a autorização usa o que está no banco |
| Financeiro envia `PATCH /api/payments/:id` com `status: "Cancelado"` | `403` — tem `payments.settle`, não `payments.cancel` |
| Financeiro envia baixa **e** alteração de valor na mesma requisição | Exige `payments.settle` **e** `payments.update`; falta de qualquer uma resulta em `403` |
| `DELETE /api/files/:id` de arquivo inexistente | `404`, sem revelar tipo |
| `DELETE /api/files/:id` de nota fiscal por quem só tem `contract_files.delete` | `403` |
| Admin tenta editar ou excluir o grupo Admin | `422` |
| Admin tenta excluir grupo com 3 usuários | `422` informando os 3 vínculos |
| Admin tenta se desvincular do grupo Admin sendo o último ativo | `422` |
| Admin tenta alterar os próprios grupos | `422` |
| Grupo salvo com `screen.financeiro` sem `payments.view` | `422` nomeando a tela e a permissão ausente |
| Grupo salvo com `screen.dashboard` e apenas `dashboard.operational.view` | Aceito — a dependência é OR |
| Grupo criado com nome duplicado | `400` |
| Grupo com permissão fora do catálogo | `400` |
| Permissão do usuário revogada com a tela aberta | A próxima requisição responde `403`; o frontend exibe a mensagem de acesso negado |
| Usuário com `screen.dashboard` mas sem `dashboard.financial.view` | Dashboard renderiza só os blocos operacionais; o payload não traz os financeiros |
| Operacional abre o detalhe do cliente | A aba de contratos não carrega nem chama `GET /api/contracts` |

## 7. Alternativas consideradas

### 7.1 Alternativa escolhida

**Permissões granulares em catálogo de código + grupos persistidos + união por usuário, resolvidas no banco a cada requisição.**

O catálogo em código dá integridade: só existe a permissão que algum ponto do sistema realmente protege, e renomear uma chave quebra em compilação, não em silêncio. Os grupos em banco dão ao Admin o poder de recortar acesso sem deploy. A resolução por requisição, dentro do `requireAuth` que já busca o usuário, faz a revogação valer na hora sem inventar mecanismo novo de invalidação.

### 7.2 Alternativas descartadas

| Alternativa | Vantagens | Desvantagens | Motivo da não escolha |
|---|---|---|---|
| Manter `role` único com mapa de permissões em código | Mudança mínima; sem tabelas novas | Um papel por usuário; toda mudança exige deploy | Contraria DP-18 (acúmulo) e o pedido de gerenciar grupos pela interface |
| Permissões atribuídas direto ao usuário, sem grupo | Sem entidade intermediária | Reconfigurar N usuários a cada mudança de função; sem nome para a função | O usuário pediu explicitamente agrupamento reaproveitável |
| Catálogo de permissões também em banco | Admin poderia criar permissão nova | Permissão sem ponto de aplicação no código é decorativa; abre espaço para chave órfã | Permissão só existe se algo a verifica — isso é código |
| Embutir as permissões no JWT | Zero consulta extra por requisição | Token dura 7 dias; revogação só valeria no próximo login ou exigiria invalidar todas as sessões a cada edição de grupo | Viola RF-15 |
| Biblioteca de autorização (CASL, accesscontrol) | Recursos de ABAC, condições | Dependência e vocabulário novos para o que é `Set.has(chave)` | Custo maior que o benefício nesta escala |
| Tabela `GroupPermission` (uma linha por permissão) | Consulta "quais grupos concedem X" | Mais joins e escrita mais complexa para um conjunto sempre lido inteiro | `permissions String[]` cobre o uso real; a consulta reversa não é requisito |
| Negação explícita (`deny`) além de conceder | Recortes finos dentro de um grupo | Precedência entre allow e deny é fonte clássica de bug e de auditoria confusa | União simples é suficiente e previsível |

## 8. Design da solução

### 8.1 Visão geral da abordagem

Sete blocos, nesta ordem:

1. **Domínio** — catálogo de permissões, dependências tela→leitura e funções puras de união e validação.
2. **Persistência** — `Group`, `UserGroup`, remoção de `User.role`, migration e seed.
3. **Resolução** — `requireAuth` passa a carregar grupos e a expor `req.user.permissions`.
4. **Guarda** — `requirePermission` / `requireAnyPermission` aplicados por rota, mais checagem por ação onde um handler concentra várias.
5. **API de grupos** — CRUD, catálogo e validação de coerência.
6. **API de usuários** — vínculo por `groupIds`, rota reduzida `/basic`, regras de último admin por grupo.
7. **Frontend** — contexto com `has()`, guarda de rota, menu filtrado, tela de grupos, seleção de grupos no usuário e ocultação de ações.

Os blocos 1–3 são pré-requisito de todo o resto; 4, 5 e 6 podem avançar em paralelo depois deles; 7 depende de 5 e 6.

### 8.2 Domínio — catálogo de permissões

Novo arquivo `server/src/domain/permissions.ts`, sem Express e sem Prisma (convenção do projeto: regra pura em `domain/`, testada em `domain.*.test.ts`).

```ts
export const PERMISSIONS = [
  // Telas
  'screen.dashboard', 'screen.clientes', 'screen.pipeline', 'screen.contratos',
  'screen.financeiro', 'screen.usuarios', 'screen.configuracoes', 'screen.grupos',
  // Clientes
  'clients.view', 'clients.create', 'clients.update', 'clients.delete',
  'clients.stage.update', 'clients.owner.update', 'clients.batch_reassign', 'clients.export',
  // Interações
  'logs.view', 'logs.create',
  // Contratos
  'contracts.view', 'contracts.create', 'contracts.update', 'contracts.delete',
  'contract_files.view', 'contract_files.create', 'contract_files.delete',
  // Cobranças
  'payments.view', 'payments.create', 'payments.update', 'payments.settle',
  'payments.cancel', 'payments.export',
  'invoices.view', 'invoices.create', 'invoices.delete',
  // Dashboard
  'dashboard.financial.view', 'dashboard.operational.view',
  // Configurações
  'settings.view', 'settings.update', 'settings.bank.view',
  // Usuários e grupos
  'users.view_basic', 'users.view', 'users.manage',
  'groups.view', 'groups.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Metadados para a tela de grupos: rótulo em pt-BR e agrupamento visual. */
export interface PermissionMeta {
  key: Permission;
  label: string;
  category: 'Telas' | 'Clientes' | 'Interações' | 'Contratos' | 'Cobranças'
          | 'Dashboard' | 'Configurações' | 'Usuários e grupos';
  /** Preenchido apenas em permissões de tela. */
  requiresAnyOf?: Permission[];
}

export const PERMISSION_CATALOG: PermissionMeta[] = [ /* ... */ ];

/** DP-20: cada tela exige ao menos uma permissão de leitura. */
export const SCREEN_DEPENDENCIES: Record<string, Permission[]> = {
  'screen.dashboard':      ['dashboard.financial.view', 'dashboard.operational.view'],
  'screen.clientes':       ['clients.view'],
  'screen.pipeline':       ['clients.view'],
  'screen.contratos':      ['contracts.view'],
  'screen.financeiro':     ['payments.view'],
  'screen.usuarios':       ['users.view'],
  'screen.configuracoes':  ['settings.view'],
  'screen.grupos':         ['groups.view'],
};

export function isValidPermission(value: string): value is Permission;

/** União das permissões de vários grupos, sem duplicatas. */
export function mergePermissions(groups: { permissions: string[] }[]): Set<string>;

export interface ScreenDependencyViolation {
  screen: Permission;
  missingAnyOf: Permission[];
}

/** Telas concedidas sem nenhuma das permissões de leitura exigidas. */
export function findScreenDependencyViolations(
  permissions: string[]
): ScreenDependencyViolation[];

/** Primeira tela permitida, na ordem do menu. Null quando não há nenhuma. */
export function firstAllowedScreen(permissions: Set<string>): Permission | null;
```

`SCREEN_DEPENDENCIES` é a **única** fonte da regra do DP-20 — usada pela validação do backend e devolvida ao frontend no catálogo, para que a tela de grupos aplique a mesma regra sem reimplementá-la.

### 8.3 Persistência

`server/prisma/schema.prisma`:

```prisma
model User {
  id                 String      @id @default(uuid())
  email              String      @unique
  passwordHash       String
  name               String
  active             Boolean     @default(true)
  mustChangePassword Boolean     @default(false)
  tokenVersion       Int         @default(0)
  createdAt          DateTime    @default(now())
  ownedClients       Client[]
  interactionLogs    InteractionLog[]
  groups             UserGroup[]

  @@map("users")
}

model Group {
  id          String      @id @default(uuid())
  name        String      @unique
  description String?
  isSystem    Boolean     @default(false)
  permissions String[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  users       UserGroup[]

  @@map("groups")
}

model UserGroup {
  userId    String
  groupId   String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Restrict)

  @@id([userId, groupId])
  @@index([groupId])
  @@map("user_groups")
}
```

Notas de modelagem:

- `User.role` é **removido**. Sem migração de dados (DP-16/DP-17).
- `permissions String[]` — array de texto do Postgres. O conjunto é sempre lido inteiro; a consulta reversa ("quais grupos concedem X") não é requisito.
- `onDelete: Restrict` em `UserGroup.group` é a segunda linha de defesa de RF-11: mesmo que a validação de aplicação falhe, o banco recusa apagar grupo com vínculo.
- A migration é gerada por `prisma migrate dev`; `server/prisma/migrations/20260819000000_init/migration.sql` permanece intocada.

`server/prisma/seed.ts` passa a semear os três grupos com as permissões da matriz do PRD (`isSystem: true` só no Admin) e a vincular o usuário administrador inicial ao grupo Admin, de forma idempotente (`upsert` por `name`, como já faz com o usuário por e-mail).

### 8.4 Resolução das permissões

`server/src/middlewares/requireAuth.ts` — o `select` da consulta que já existe passa a incluir os grupos:

```ts
const user = await prisma.user.findUnique({
  where: { id: decoded.id },
  select: {
    id: true, email: true, name: true, active: true,
    mustChangePassword: true, tokenVersion: true,
    groups: { select: { group: { select: { id: true, name: true, permissions: true } } } },
  },
});

const groups = user.groups.map((g) => g.group);
const permissions = mergePermissions(groups);
req.user = { ...authUser, groups, permissions };
```

`server/src/types/express.d.ts` — `AuthUser` perde `role` e ganha:

```ts
groups: { id: string; name: string; permissions: string[] }[];
permissions: Set<string>;
```

Isso atende RF-15 sem mecanismo novo: como o usuário e seus grupos já são lidos do banco a cada requisição, qualquer edição de grupo ou de vínculo vale na requisição seguinte. `tokenVersion` continua servindo ao que já serve (desativação e troca de senha).

### 8.5 Middleware de autorização

`server/src/middlewares/requirePermission.ts` substitui `requireAdmin.ts`:

```ts
export function requirePermission(permission: Permission): RequestHandler {
  return (req, res, next) => {
    if (!req.user?.permissions.has(permission)) {
      return res.status(403).json({
        error: 'Você não tem permissão para executar esta ação.',
        requiredPermission: permission,
      });
    }
    return next();
  };
}

/** Concede quando o usuário tem ao menos uma das permissões. */
export function requireAnyPermission(...permissions: Permission[]): RequestHandler;

/** Uso dentro de handler que ramifica por intenção. Lança para o errorHandler. */
export function assertPermission(req: Request, permission: Permission): void;
```

`server/src/middlewares/errorHandler.ts` ganha o tratamento de `ForbiddenError` (lançada por `assertPermission`), devolvendo `403` no mesmo formato — mantendo o handler como ponto único de tradução de erro.

**Mapa rota → permissão**

| Rota | Permissão |
|---|---|
| `GET /api/clients`, `GET /api/clients/:id` | `clients.view` |
| `POST /api/clients` | `clients.create` |
| `PATCH /api/clients/:id` | `clients.update` |
| `DELETE /api/clients/:id` | `clients.delete` |
| `PATCH /api/clients/:id/stage` | `clients.stage.update` |
| `PATCH /api/clients/:id/owner` | `clients.owner.update` |
| `POST /api/clients/batch-reassign` | `clients.batch_reassign` |
| `GET /api/clients/:id/logs` | `logs.view` |
| `POST /api/clients/:id/logs` | `logs.create` |
| `GET /api/contracts`, `GET /api/contracts/:id`, `GET /api/contracts/:id/payments` | `contracts.view` |
| `POST /api/contracts` | `contracts.create` |
| `PATCH /api/contracts/:id` | `contracts.update` |
| `DELETE /api/contracts/:id` | `contracts.delete` |
| `GET /api/payments`, `GET /api/payments/:id` | `payments.view` |
| `POST /api/payments` | `payments.create` |
| `PATCH /api/payments/:id` | por intenção (8.7) |
| `POST /api/files`, `GET /api/files/:id`, `DELETE /api/files/:id` | por tipo (8.8) |
| `GET /api/dashboard` | `requireAnyPermission('dashboard.financial.view', 'dashboard.operational.view')` |
| `GET /api/settings` | `settings.view` |
| `PUT /api/settings` | `settings.update` |
| `GET /api/settings/billing` | `settings.bank.view` |
| `GET /api/export/clients` | `clients.export` |
| `GET /api/export/payments` | `payments.export` |
| `GET /api/users` | `users.view` |
| `GET /api/users/basic` | `users.view_basic` |
| `POST /api/users`, `PATCH /api/users/:id` | `users.manage` |
| `GET /api/groups`, `GET /api/permissions` | `groups.view` |
| `POST/PATCH/DELETE /api/groups` | `groups.manage` |
| `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/logout` | nenhuma (sempre liberadas) |

`server/src/app.ts` deixa de montar `requireAdmin` em `/api/users` e `/api/settings`; cada rota declara a sua permissão dentro do próprio router, porque `/api/users/basic` e `/api/settings/billing` precisam de permissão diferente do resto do prefixo.

**Ordem de declaração:** `GET /api/users/basic` antes de qualquer rota com parâmetro no mesmo router; idem `GET /api/settings/billing`.

### 8.6 API de grupos

Novo `server/src/routes/groups.ts`.

```ts
// GET /api/permissions  → groups.view
// Catálogo para a tela de grupos: o cliente não mantém cópia da lista.
{
  permissions: [{ key, label, category, requiresAnyOf? }],
  screenDependencies: { 'screen.financeiro': ['payments.view'], ... }
}

// GET /api/groups  → groups.view
[{ id, name, description, isSystem, permissions: string[], userCount: number }]

// POST /api/groups  → groups.manage
{ name: string, description?: string, permissions: string[] }

// PATCH /api/groups/:id  → groups.manage
{ name?: string, description?: string, permissions?: string[] }

// DELETE /api/groups/:id  → groups.manage
```

Validação com Zod na rota (convenção do projeto) mais as funções puras do domínio:

1. `name` obrigatório, único (`400` em duplicata).
2. Toda chave em `permissions` deve estar no catálogo (`400`).
3. `findScreenDependencyViolations` vazio, senão `422`:
   ```json
   {
     "error": "Uma permissão de tela exige a permissão de leitura correspondente.",
     "violations": [{ "screen": "screen.financeiro", "missingAnyOf": ["payments.view"] }]
   }
   ```
4. `PATCH`/`DELETE` em grupo `isSystem` → `422` "O grupo Admin não pode ser alterado nem excluído."
5. `DELETE` com `userCount > 0` → `422` "Este grupo tem N usuário(s) vinculado(s). Desvincule antes de excluir."

### 8.7 Cobranças — permissão por intenção

Em `server/src/routes/payments.ts:304`, antes de montar `updatePayload`, classificar a intenção com a mesma lógica que o handler já usa e exigir **todas** as permissões correspondentes:

```ts
const intents: Permission[] = [];

const isMarkingPaid =
  data.status === 'Pago' ||
  (data.paidDate && data.paymentMethod &&
   data.status !== 'Cancelado' && data.status !== 'Pendente');

if (isMarkingPaid || data.status === 'Pendente') intents.push('payments.settle');
if (data.status === 'Cancelado') intents.push('payments.cancel');
if (
  data.amountCents !== undefined || data.dueDate !== undefined ||
  data.referenceMonth !== undefined || data.notes !== undefined
) intents.push('payments.update');

for (const intent of intents) assertPermission(req, intent);
```

`status: 'Pendente'` reverte uma baixa, então cai em `payments.settle` — quem pode dar baixa pode desfazê-la. Uma requisição que combina baixa e edição exige as duas permissões.

### 8.8 Arquivos — permissão por tipo

`server/src/routes/files.ts`:

- **`POST /`** — após o Multer e a leitura de `contractId`/`paymentRecordId`: `contractId` exige `contract_files.create`; `paymentRecordId` exige `invoices.create`. A checagem vem **antes** das consultas ao banco e, quando falha, remove o arquivo já gravado em disco (o handler já faz esse `unlink` nos caminhos de erro).
- **`GET /:id`** — resolve o registro; se `ContractFile`, exige `contract_files.view`; se `InvoiceFile`, exige `invoices.view`; se nenhum, `404`.
- **`DELETE /:id`** — mesma resolução; `contract_files.delete` ou `invoices.delete`. `404` antes de `403` quando o arquivo não existe, para não revelar identificadores válidos por diferença de status.

### 8.9 Dashboard — payload por permissão

`server/src/routes/dashboard.ts` monta a resposta condicionalmente:

- `dashboard.financial.view` governa `current.mrrCents`, `receivedCents`, `invoicedCents`, `overdueCents`, `overdueCount`, `delinquencyRate`, além de `previous`, `comparison`, `alerts` e `charts.billingHistory`.
- `dashboard.operational.view` governa `current.activeClients` e `charts.serviceDistribution`.
- **O bloco `settings` deixa de trazer `pixKey`, `pixKeyType`, `bankName`, `bankBranch` e `bankAccount` a menos que o usuário tenha `settings.bank.view`.** `agencyName`, `contactEmail` e `phone` permanecem — são o cabeçalho da tela.
- O `upsert` de `MetricSnapshot` continua acontecendo em toda chamada, independentemente dos blocos devolvidos: é o mecanismo de congelamento mensal e não depende de quem consulta.
- `client/src/types/dashboard.ts` passa a marcar como opcionais os campos que podem não vir, e `DashboardPage.tsx` renderiza cada bloco condicionalmente.

### 8.10 Usuários

`server/src/routes/users.ts`:

- `createUserSchema`: `role` sai, entra `groupIds: z.array(z.string().uuid()).default([])`.
- `updateUserSchema`: `role` sai, entra `groupIds: z.array(z.string().uuid()).optional()`.
- `GET /` (`users.view`) devolve `groups: [{ id, name }]` no lugar de `role`.
- **Novo `GET /basic`** (`users.view_basic`): `[{ id, name }]` apenas de `active: true`, ordenado por nome. Sem e-mail, sem grupos, sem `mustChangePassword` — é só o que os filtros "Responsável" de `ClientsPage` e `KanbanPage` consomem.
- **RF-28** — a regra de `users.ts:93` passa a valer para grupos: alterar os próprios `groupIds` devolve `422`.
- **RF-10** — a contagem de `users.ts:98-114` passa a olhar o vínculo:

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
- A escrita de `groupIds` é um `deleteMany` + `createMany` de `UserGroup` dentro de `prisma.$transaction`, junto com o `update` do usuário.

`server/src/routes/auth.ts:66` — `GET /me` devolve, além do que já devolve (menos `role`):

```ts
{ user: { id, email, name, mustChangePassword,
          groups: [{ id, name }],
          permissions: string[] } }
```

### 8.11 Frontend

**Tipos** (`client/src/types/index.ts`): `Role` sai. Entram `Group { id, name }`, `User.groups: Group[]`, `AuthUser.permissions: string[]`. `client/src/types/permission.ts` recebe só os tipos do catálogo vindo da API — a lista de chaves não é duplicada.

**Contexto** (`client/src/context/AuthContext.tsx`): expõe

```ts
has: (permission: string) => boolean;
hasAny: (...permissions: string[]) => boolean;
```
sobre um `Set` memoizado de `user.permissions`.

**Guarda de rota** (`client/src/components/Auth/RequireAuth.tsx`): `adminOnly?: boolean` vira `permission?: string` e `anyPermission?: string[]`. Sem permissão, redireciona para a primeira tela permitida — não para `/`, que pode ser justamente a proibida.

**Rotas** (`client/src/App.tsx`): a rota índice deixa de renderizar `DashboardPage` diretamente e passa por um `<HomeRedirect />` que resolve a primeira tela permitida (mesma ordem do menu). Nova rota `/grupos` protegida por `screen.grupos`. Todas as demais recebem sua `permission`.

**Menu** (`client/src/components/Layout/AppShell.tsx`): `NAV_ITEMS` e `ADMIN_NAV_ITEMS` fundem-se numa lista única com `permission`, filtrada por `has()`. `isAdmin` some. O rodapé que hoje mostra `'Admin' | 'Membro'` (`AppShell.tsx:178`) passa a listar os nomes dos grupos.

**Tela de grupos** (`client/src/components/Groups/`):

- `GroupsPage.tsx` — lista com nome, descrição, contagem de permissões, contagem de usuários e selo "Sistema" no Admin. Ações de editar e excluir desabilitadas em grupo de sistema; exclusão via `ConfirmDialog` (componente já existente).
- `GroupModal.tsx` — nome, descrição e a matriz de permissões.
- `PermissionMatrix.tsx` — checkboxes agrupados por `category` do catálogo, cada categoria num `<fieldset>` com `<legend>`. Regra do DP-20 aplicada com os dados de `screenDependencies` vindos da API:
  - a checkbox de tela fica `disabled` enquanto nenhuma das permissões de `requiresAnyOf` estiver marcada, com texto de apoio "Requer: Ver cobranças" associado por `aria-describedby`;
  - desmarcar a última permissão de leitura que sustenta uma tela marcada desmarca a tela e anuncia o efeito num `role="status"`.

**Usuários** (`client/src/components/Users/UserModal.tsx`): o `<select>` de papel (`UserModal.tsx:167`) vira lista de checkboxes de grupos, carregada de `GET /api/groups`. O guarda `if (!isSelf) payload.role = role` vira `if (!isSelf) payload.groupIds = groupIds`. `UsersPage.tsx:229` troca o selo de papel por selos de grupo.

**Ações condicionais** — botões e controles ocultos por `has()`:

| Arquivo | Controles |
|---|---|
| `ClientsPage.tsx` | Novo cliente (`clients.create`), editar (`clients.update`), excluir (`clients.delete`), reatribuir em lote (`clients.batch_reassign`), exportar (`clients.export`) |
| `KanbanPage.tsx` | arraste entre colunas (`clients.stage.update`), excluir (`clients.delete`) |
| `ClientDetailsModal.tsx` | aba de contratos e `GET /api/contracts` (`contracts.view`), registrar interação (`logs.create`), trocar responsável (`clients.owner.update`), excluir contrato (`contracts.delete`) |
| `ContractsPage.tsx` | novo (`contracts.create`), editar (`contracts.update`), excluir (`contracts.delete`) |
| `ContractFilesModal.tsx` | enviar (`contract_files.create`), excluir (`contract_files.delete`) |
| `FinancialPage.tsx` | nova cobrança (`payments.create`), exportar (`payments.export`) |
| `PaymentDetailsModal.tsx` | dar baixa (`payments.settle`), cancelar (`payments.cancel`), editar (`payments.update`), anexar nota (`invoices.create`), excluir nota (`invoices.delete`) |

**Endpoints trocados no cliente**: `ClientsPage.tsx:161` e `KanbanPage.tsx:67` passam a `GET /api/users/basic`; `FinancialPage.tsx:82` passa a `GET /api/settings/billing` e o `.catch()` silencioso é substituído por renderização condicional a `settings.bank.view`.

**Sem nenhum grupo**: `AppShell` renderiza um estado vazio ("Nenhum acesso liberado. Procure o administrador."), usando `EmptyState` de `client/src/components/ui/States.tsx`, com apenas trocar senha e sair disponíveis.

## 9. Fluxos técnicos

```text
Requisição autenticada
──────────────────────
  cookie token
      │
      ▼
  requireAuth ── JWT inválido/expirado ──────────────► 401
      │
      ├─ busca User + UserGroup + Group.permissions (banco, toda requisição)
      ├─ active? tokenVersion confere? ──── não ─────► 401
      ├─ mustChangePassword && rota não permitida ───► 403
      └─ req.user.permissions = união das permissões
      │
      ▼
  requirePermission('payments.settle')
      │
      ├─ permissions.has(...) === false ─────────────► 403 { error, requiredPermission }
      └─ true
      │
      ▼
  handler ── assertPermission por intenção ──────────► 403
      │
      ▼
  200
```

```text
Salvar grupo — coerência tela/leitura (DP-20)
─────────────────────────────────────────────
  PermissionMatrix (frontend)
      │  checkbox de tela desabilitada enquanto falta a leitura
      │  desmarcar a leitura desmarca a tela + aviso role="status"
      ▼
  POST /api/groups  { permissions: [...] }
      │
      ├─ chave fora do catálogo ─────────────────────► 400
      ├─ nome duplicado ─────────────────────────────► 400
      ├─ findScreenDependencyViolations() não vazio ─► 422 { violations }
      └─ ok ─────────────────────────────────────────► 201
```

```text
Revogação com a tela aberta
───────────────────────────
  Admin remove 'payments.view' do grupo Financeiro
      │
      ▼
  Usuário do grupo já autenticado dispara a próxima requisição
      │
      ▼
  requireAuth relê grupos do banco → permissão ausente
      │
      ▼
  403 → api.ts traduz → "Você não tem permissão para executar esta ação."
      │
      ▼
  /me na próxima carga devolve permissions sem a chave → item some do menu
```

## 10. Arquivos afetados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `server/src/domain/permissions.ts` | Criar | Catálogo, dependências de tela, união e validações puras |
| `server/src/middlewares/requirePermission.ts` | Criar | `requirePermission`, `requireAnyPermission`, `assertPermission` |
| `server/src/routes/groups.ts` | Criar | CRUD de grupos e catálogo de permissões |
| `server/src/middlewares/requireAdmin.ts` | Remover | Substituído por `requirePermission` |
| `server/prisma/schema.prisma` | Modificar | Remove `User.role`; adiciona `Group` e `UserGroup` |
| `server/prisma/migrations/<nova>/migration.sql` | Criar | Migration gerada por `prisma migrate dev` |
| `server/prisma/seed.ts` | Modificar | Semeia os 3 grupos e vincula o admin inicial |
| `server/src/middlewares/requireAuth.ts` | Modificar | Carrega grupos e calcula permissões efetivas |
| `server/src/middlewares/errorHandler.ts` | Modificar | Trata `ForbiddenError` como `403` |
| `server/src/types/express.d.ts` | Modificar | `AuthUser` perde `role`, ganha `groups` e `permissions` |
| `server/src/app.ts` | Modificar | Remove `requireAdmin`; monta `/api/groups` |
| `server/src/routes/auth.ts` | Modificar | `/me` devolve grupos e permissões |
| `server/src/routes/users.ts` | Modificar | `groupIds`, `GET /basic`, regras de último admin por grupo |
| `server/src/routes/clients.ts` | Modificar | Permissão por rota |
| `server/src/routes/contracts.ts` | Modificar | Permissão por rota |
| `server/src/routes/payments.ts` | Modificar | Permissão por intenção no `PATCH` |
| `server/src/routes/files.ts` | Modificar | Permissão por tipo de arquivo |
| `server/src/routes/dashboard.ts` | Modificar | Blocos por permissão; remove vazamento bancário |
| `server/src/routes/settings.ts` | Modificar | `GET /billing` reduzido |
| `server/src/routes/export.ts` | Modificar | Permissão nas duas rotas |
| `client/src/types/index.ts` | Modificar | Remove `Role`; adiciona `Group` e `permissions` |
| `client/src/types/permission.ts` | Criar | Tipos do catálogo recebido da API |
| `client/src/types/dashboard.ts` | Modificar | Campos opcionais conforme permissão |
| `client/src/context/AuthContext.tsx` | Modificar | Expõe `has()` e `hasAny()` |
| `client/src/components/Auth/RequireAuth.tsx` | Modificar | `permission`/`anyPermission` no lugar de `adminOnly` |
| `client/src/App.tsx` | Modificar | `HomeRedirect`, rota `/grupos`, permissões por rota |
| `client/src/components/Layout/AppShell.tsx` | Modificar | Menu filtrado; estado sem acesso; selos de grupo |
| `client/src/components/Groups/GroupsPage.tsx` | Criar | Lista de grupos |
| `client/src/components/Groups/GroupModal.tsx` | Criar | Criação e edição de grupo |
| `client/src/components/Groups/PermissionMatrix.tsx` | Criar | Matriz de permissões com a regra do DP-20 |
| `client/src/components/Users/UserModal.tsx` | Modificar | Seleção múltipla de grupos |
| `client/src/components/Users/UsersPage.tsx` | Modificar | Selos de grupo no lugar do papel |
| `client/src/components/Clients/ClientsPage.tsx` | Modificar | `/api/users/basic`; ações por permissão |
| `client/src/components/Clients/ClientDetailsModal.tsx` | Modificar | Aba de contratos e ações por permissão |
| `client/src/components/Kanban/KanbanPage.tsx` | Modificar | `/api/users/basic`; arraste e exclusão por permissão |
| `client/src/components/Contracts/ContractsPage.tsx` | Modificar | Ações por permissão |
| `client/src/components/Contracts/ContractFilesModal.tsx` | Modificar | Envio e exclusão por permissão |
| `client/src/components/Financial/FinancialPage.tsx` | Modificar | `/api/settings/billing`; ações por permissão |
| `client/src/components/Financial/PaymentDetailsModal.tsx` | Modificar | Baixa, cancelamento, edição e notas por permissão |
| `client/src/components/Dashboard/DashboardPage.tsx` | Modificar | Blocos condicionais |
| `server/src/__tests__/domain.permissions.test.ts` | Criar | União, catálogo, dependências, primeira tela |
| `server/src/__tests__/groups.test.ts` | Criar | CRUD, coerência, grupo de sistema, exclusão com vínculo |
| `server/src/__tests__/permissions.test.ts` | Modificar | Por grupo, por acúmulo, sem grupo, cobertura de rotas |

## 11. Requisitos não funcionais

| Categoria | Requisito não funcional | Meta ou critério |
|---|---|---|
| Segurança | Nega por padrão; nenhuma rota protegida sem permissão declarada | Teste que percorre o roteador do Express e falha se alguma rota fora da allowlist de auth não tiver guarda |
| Segurança | A autorização nunca deriva de dado do cliente | Teste enviando `permissions`/`groupIds`/`role` forjados no corpo e na query |
| Segurança | Dados bancários só saem com `settings.bank.view` | Teste sobre `GET /api/dashboard` e `GET /api/settings/billing` verificando ausência das chaves |
| Segurança | Ninguém consegue remover o último administrador ativo | Testes de `422` em desativação e em desvínculo |
| Segurança | Erros não revelam existência de recurso a quem não pode vê-lo | `404` antes de `403` em `GET`/`DELETE /api/files/:id` |
| Performance | Resolver permissões não deve somar consulta extra por requisição | Os grupos entram no `select` do `findUnique` que `requireAuth` já executa — permanece **uma** consulta |
| Performance | A tela de grupos carrega catálogo e grupos numa única passagem | Duas requisições paralelas em `GroupsPage`, cacheadas por react-query |
| Confiabilidade | Escrita de vínculos é atômica | `deleteMany` + `createMany` + `update` dentro de `prisma.$transaction` |
| Confiabilidade | Integridade de vínculo garantida no banco | `onDelete: Restrict` em `UserGroup.group` |
| Acessibilidade | A matriz de permissões é navegável por teclado e anunciada | `<fieldset>`/`<legend>` por categoria; `aria-describedby` na dependência; `role="status"` no aviso de desmarcação automática |
| Acessibilidade | O estado "sem acesso" é anunciado | `EmptyState` com `role="alert"`, padrão já usado em `States.tsx` |
| Compatibilidade | Sem quebra de contrato para consumidor externo | Não há: a API só serve o próprio frontend |
| Observabilidade | Toda negação registra contexto suficiente para diagnóstico | `console.warn` com `userId`, `method`, `path` e `requiredPermission` — sem dado pessoal |

## 12. Estratégia de rollout ou migração

- **Sem migração de dados** (PRD, DP-16/DP-17): o banco está em teste. A migration remove `User.role` e cria as tabelas novas; o seed reconstrói grupos e vínculo do administrador.
- **Sequência de deploy**: `prisma migrate deploy` → `prisma db seed` → subir a aplicação. O seed é idempotente (`upsert` por `name` e por e-mail), então repetir não duplica.
- **Sem feature flag.** Meio-termo aqui significaria manter `role` e permissões vivos ao mesmo tempo, com duas fontes de verdade sobre acesso — mais arriscado que a troca direta, ainda mais com o banco em teste.
- **Ordem de implementação sugerida**: domínio → schema/seed → `requireAuth` → middleware → rotas → API de grupos e usuários → frontend. A partir do middleware, cada rota migrada já fica protegida; o sistema nunca fica num estado em que `role` sumiu e nada o substituiu.
- **Rollback**: reverter o commit e aplicar a migration anterior. Como não há dado de produção, a perda se limita aos grupos criados em teste.
- **Verificação pós-deploy**: entrar com um usuário de cada grupo semeado e confirmar menu, rota inicial e uma ação permitida e uma negada.

## 13. Estratégia de validação

**Testes unitários** — `server/src/__tests__/domain.permissions.test.ts`:
- `mergePermissions` com zero, um e vários grupos, com sobreposição.
- `isValidPermission` aceitando o catálogo e rejeitando chave inventada.
- `findScreenDependencyViolations` em cada tela, incluindo o OR de `screen.dashboard`.
- `firstAllowedScreen` respeitando a ordem do menu e devolvendo `null` sem permissões.
- Consistência: toda chave de `SCREEN_DEPENDENCIES` está em `PERMISSIONS`, e todo item de `PERMISSION_CATALOG` corresponde a uma permissão existente (e vice-versa).

**Testes de integração** (supertest, padrão do projeto) — `permissions.test.ts` estendido:
- Para cada grupo semeado, um acesso permitido e um negado por área.
- Usuário com Operacional **e** Financeiro: união correta.
- Usuário sem grupo: `200` em `/me`, `403` nas protegidas.
- `403` distinto de `401`.
- Payload forjado não concede permissão.
- `PATCH /api/payments/:id`: baixa permitida, cancelamento negado para o Financeiro, combinação exigindo as duas permissões.
- `DELETE /api/files/:id`: anexo de contrato e nota fiscal negados de forma independente.
- `GET /api/dashboard`: ausência dos blocos financeiros e das chaves bancárias sem as permissões.
- `GET /api/export/*`: `403` sem a permissão.
- `GET /api/users/basic`: sem e-mail, sem grupos, só ativos.
- **Cobertura de rotas**: percorre as rotas registradas no app e falha se alguma fora da allowlist não declarar guarda — o teste que sustenta RF-05 ao longo do tempo.

`groups.test.ts`:
- CRUD completo; nome duplicado `400`; permissão inválida `400`.
- Coerência de tela `422` com `violations` no corpo.
- Grupo de sistema: `PATCH` e `DELETE` `422`.
- Exclusão com usuários vinculados `422` com a contagem.
- `403` sem `groups.manage`.

**Testes manuais/e2e** — um usuário por grupo semeado e um com dois grupos:
- login leva à tela certa; menu com os itens certos;
- ação permitida conclui, ação negada mostra a mensagem de `403`;
- criar grupo pela tela, vincular usuário, verificar o efeito sem novo login;
- na matriz: marcar tela sem a leitura (bloqueado, com aviso) e desmarcar a leitura de uma tela marcada (desmarca junto, com aviso);
- navegação por teclado na matriz.

**Sinais operacionais** — acompanhar os `console.warn` de negação após o deploy: uma permissão que nega repetidamente para um grupo inteiro indica matriz mal semeada, não ataque.

## 14. Critérios de aceite

- [ ] O catálogo de permissões existe em `server/src/domain/permissions.ts` e chave fora dele é rejeitada com `400`.
- [ ] `User.role` não existe mais no schema, nos schemas Zod nem nos tipos do frontend.
- [ ] `Group`, `UserGroup` e a migration existem; `onDelete: Restrict` protege o vínculo.
- [ ] O seed cria Admin (`isSystem`), Operacional e Financeiro com exatamente as permissões da matriz do PRD e vincula o administrador inicial ao grupo Admin.
- [ ] `req.user.permissions` é a união das permissões dos grupos, calculada em `requireAuth` sem consulta adicional.
- [ ] Toda rota protegida declara permissão; o teste de cobertura de rotas passa.
- [ ] `403` de permissão traz `error` e `requiredPermission`, e é distinto do `401`.
- [ ] `PATCH /api/payments/:id` exige `payments.settle`, `payments.cancel` ou `payments.update` conforme a intenção, e todas quando combinadas.
- [ ] `POST`, `GET` e `DELETE /api/files` exigem a permissão do tipo correto, e arquivo inexistente devolve `404`.
- [ ] `GET /api/dashboard` omite os blocos financeiros sem `dashboard.financial.view` e as chaves bancárias sem `settings.bank.view`.
- [ ] `GET /api/settings/billing` devolve apenas o subconjunto bancário e exige `settings.bank.view`.
- [ ] `GET /api/users/basic` devolve só `id` e `name` de usuários ativos e exige `users.view_basic`.
- [ ] `GET /api/export/clients` e `GET /api/export/payments` exigem suas permissões.
- [ ] `POST/PATCH/DELETE /api/groups` exigem `groups.manage`; `GET /api/groups` e `GET /api/permissions` exigem `groups.view`.
- [ ] Editar ou excluir o grupo de sistema devolve `422`.
- [ ] Excluir grupo com usuários vinculados devolve `422` com a contagem.
- [ ] Salvar grupo com tela sem a leitura correspondente devolve `422` nomeando tela e permissão ausente.
- [ ] `screen.dashboard` é aceita com qualquer uma das duas permissões de dashboard.
- [ ] Remover ou desativar o último usuário ativo do grupo Admin devolve `422`.
- [ ] Alterar os próprios grupos devolve `422`.
- [ ] Alterar grupos de um usuário, ou permissões de um grupo, vale na requisição seguinte sem novo login.
- [ ] Usuário sem grupo autentica, vê o estado "sem acesso" e recebe `403` nas rotas protegidas.
- [ ] O menu exibe apenas os itens cujas permissões `screen.*` o usuário tem.
- [ ] O login leva à primeira tela permitida; Operacional cai no Pipeline.
- [ ] A tela `/grupos` cria, edita e exclui grupos, com a matriz aplicando a regra do DP-20.
- [ ] A matriz de permissões é navegável por teclado, com dependência e desmarcação automática anunciadas a leitor de tela.
- [ ] `UserModal` vincula o usuário a múltiplos grupos.
- [ ] Os botões listados em 8.11 ficam ocultos sem a permissão correspondente.
- [ ] `ClientsPage` e `KanbanPage` consomem `/api/users/basic`; `FinancialPage` consome `/api/settings/billing`.
- [ ] Casos de erro e fallback relevantes foram considerados.
- [ ] `npm test` (server) e o build do client passam sem regressão.

## 15. Riscos e observações

- **Superfície ampla.** A entrega toca 40+ arquivos e praticamente toda rota. Mitigação: domínio e middleware primeiro, com testes; rotas migradas em lotes por recurso; o teste de cobertura de rotas impede que alguma fique para trás.
- **Vazamento de dados bancários no dashboard.** O `settings` de `GET /api/dashboard` hoje entrega `pixKey` e conta bancária a qualquer autenticado — um caminho paralelo ao `/api/settings` protegido. É corrigido aqui, mas vale tratar como achado de segurança independente do resto: se a feature atrasar, esse recorte deveria sair antes.
- **`GET /api/users` hoje quebra para não-admin.** `ClientsPage` e `KanbanPage` já falham no filtro "Responsável". A troca por `/basic` corrige um bug existente, não só habilita o perfil novo.
- **Permissão de tela é conveniência, não segurança.** Um usuário com `screen.financeiro` e sem `payments.view` vê a casca da tela e recebe `403` nos dados. A regra do DP-20 evita essa configuração, mas quem protege é sempre a permissão de recurso.
- **A união não subtrai.** Vincular alguém a um grupo permissivo concede tudo dele; não há como conceder um grupo "menos uma permissão". Se essa necessidade aparecer, o caminho é um grupo próprio, não negação — decisão registrada em 7.2.
- **Sem auditoria.** Não fica registrado quem alterou permissões de um grupo e quando. Fora do escopo do PRD, mas é o candidato natural à próxima iteração, ainda mais tratando-se de dado sob LGPD.
- **LGPD.** Todo grupo novo com `clients.view` ou `clients.export` amplia a exposição de CPF/CNPJ e telefone. A tela de grupos torna isso uma decisão de operação, não mais de desenvolvimento — vale um aviso visível na matriz junto às permissões de exportação.
- **Rota índice.** Mover `/` de Dashboard para redirecionamento afeta todo mundo, inclusive o Admin (que segue caindo no Dashboard, primeiro item do menu). Merece verificação manual explícita.
- **Débito conhecido, não tratado aqui:** a duplicação de regra de documento entre `server/src/domain/clients.ts` e `client/src/utils/formatters.ts` continua como está; esta SPEC evita criar uma segunda duplicação servindo o catálogo por API.

## 16. Questões em aberto

Nenhuma. As decisões DP-01 a DP-20 estão resolvidas no PRD e refletidas nesta SPEC.
