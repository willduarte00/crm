# PRD — Grupos e permissões de acesso

> Status: **aguardando aprovação final do usuário**.
> Versão 2 — incorpora as respostas às decisões DP-01 a DP-19 e a evolução do modelo de perfis fixos para **grupos com permissões acumuláveis**.
> Nenhuma permissão foi inventada: cada item aponta para código existente. Resta uma única decisão aberta (**DP-20**).

---

## Contexto de produto *

O produto é um CRM interno de agência de marketing, usado apenas pela equipe (sem cadastro público). Reúne pipeline comercial (Kanban), cadastro de clientes/leads, contratos de serviço, cobranças/pagamentos, dashboard de métricas, disparo de WhatsApp por link e configurações da agência.

Hoje o sistema tem apenas **dois papéis**: `admin` e `membro` (`server/prisma/schema.prisma`, campo `User.role`, string livre com default `"membro"`). A autorização existe em **dois pontos apenas** (`server/src/app.ts:43-44`):

```
app.use('/api/users', requireAdmin, usersRouter);
app.use('/api/settings', requireAdmin, settingsRouter);
```

Todo o restante da API (`/api/clients`, `/api/contracts`, `/api/payments`, `/api/files`, `/api/dashboard`, `/api/export`) exige apenas **estar autenticado** (`requireAuth`). Ou seja: qualquer usuário `membro` hoje pode criar, editar e excluir clientes, contratos e cobranças, dar baixa em pagamentos e exportar a base inteira em CSV.

A demanda surge agora porque a equipe passa a ter funções distintas — operação e financeiro — que não devem enxergar nem executar as mesmas coisas. E como uma mesma pessoa pode acumular funções, a estrutura precisa permitir **combinar** acessos em vez de escolher um perfil único.

O banco ainda está em fase de testes: **não há dado de produção a migrar**, o que libera trocar o modelo de papéis por completo.

## Problema *

1. **Não existe separação por função.** O papel `membro` é um "quase-admin": tudo que não é `/api/users` e `/api/settings` está liberado para escrita.
2. **Dados financeiros estão expostos a quem opera o pipeline.** `GET /api/dashboard` devolve MRR, faturado, recebido, inadimplência e alertas de cobrança para qualquer autenticado (`server/src/routes/dashboard.ts:24`). `GET /api/contracts` devolve `valueCents` de todo contrato.
3. **Exportação em massa está sem qualquer restrição.** `GET /api/export/clients` e `GET /api/export/payments` (`server/src/routes/export.ts:40,99`) só exigem login e despejam a base completa de clientes (com CPF/CNPJ, telefone e e-mail — dado pessoal sob LGPD) e de cobranças.
4. **Operações destrutivas não têm dono definido.** `DELETE /api/clients/:id`, `DELETE /api/contracts/:id`, `DELETE /api/files/:id` e `POST /api/clients/batch-reassign` estão abertos a qualquer autenticado.
5. **A estrutura é binária e não comporta combinação.** `requireAdmin` (`server/src/middlewares/requireAdmin.ts`) é um `if (role !== 'admin')`; o frontend espelha o mesmo binário em `RequireAuth adminOnly` e `AppShell.isAdmin`. Um campo `role` único também impede que uma pessoa acumule duas funções (ex.: operação e financeiro), o que já ocorre na prática em equipe pequena.
6. **Toda mudança de acesso exige deploy.** Com a regra em código, ajustar quem vê o quê depende do desenvolvedor.

## Objetivo *

Após a entrega:

1. O acesso é definido por **permissões granulares** agrupadas em **grupos**, e um usuário pode pertencer a **um ou mais grupos** — suas permissões efetivas são a **união** das permissões dos grupos.
2. O sistema nasce com três grupos semeados — **Admin**, **Operacional** e **Financeiro** — cobrindo as funções atuais.
3. O Admin cria novos grupos e edita as permissões de um grupo **pela interface**, sem deploy.
4. Cada operação protegida do backend valida a permissão no servidor, independentemente do que o frontend exibe.
5. Um usuário sem permissão recebe `403` ao chamar a API diretamente (curl, Postman, URL direta, parâmetro alterado), não apenas deixa de ver o botão.
6. O frontend deriva menu, rotas e botões do mesmo conjunto de permissões usado pelo backend — como camada de usabilidade, nunca como mecanismo de segurança.
7. O que não foi explicitamente concedido é negado.

---

## Inventário do sistema atual (base do catálogo de permissões)

| # | Área / Tela | Endpoints | Natureza | Escrita/exclusão? |
|---|---|---|---|---|
| 1 | Dashboard (`/`) | `GET /api/dashboard` | **Financeira agregada** (MRR, faturado, recebido, inadimplência, alertas) | Não |
| 2 | Clientes (`/clientes`) | `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id` | Operacional + **dado pessoal (LGPD)**: CPF/CNPJ, telefone, e-mail | Sim (exclusão lógica) |
| 3 | Reatribuição em lote | `POST /api/clients/batch-reassign` | Administrativa | Sim (em massa) |
| 4 | Pipeline (`/pipeline`) | `GET /api/clients`, `PATCH /api/clients/:id/stage`, `PATCH /api/clients/:id/owner` | **Operacional (núcleo)** | Sim |
| 5 | Histórico de interações | `GET/POST /api/clients/:id/logs` | Operacional | Sim (append) |
| 6 | Contratos (`/contratos`) | `GET/POST /api/contracts`, `GET/PATCH/DELETE /api/contracts/:id` | Operacional **e financeira** (`valueCents`, `billingDay`, `installments`) | Sim (exclusão lógica) |
| 7 | Anexos de contrato | `POST /api/files` (`contractId`), `GET/DELETE /api/files/:id` | Documental | Sim (exclusão **física**) |
| 8 | Financeiro (`/financeiro`) | `GET/POST /api/payments`, `GET/PATCH /api/payments/:id` | **Financeira** (cobranças, baixa, cancelamento) | Sim |
| 9 | Notas fiscais | `POST /api/files` (`paymentRecordId`), `DELETE /api/files/:id` | **Financeira/fiscal** | Sim (exclusão **física**) |
| 10 | Usuários (`/usuarios`) | `GET/POST /api/users`, `PATCH /api/users/:id` | **Administrativa** | Sim |
| 11 | Configurações (`/configuracoes`) | `GET/PUT /api/settings` | **Administrativa + financeira sensível**: `pixKey`, `bankName`, `bankBranch`, `bankAccount` | Sim |
| 12 | Exportação CSV | `GET /api/export/clients`, `GET /api/export/payments` | **Dado pessoal em massa + financeiro em massa** | Não (mas é exfiltração) |
| 13 | WhatsApp | Client-side (`server/src/domain/whatsapp.ts` gera o link) | Operacional | Não |
| 14 | Conta própria | `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/logout` | Self-service | Sim (própria senha) |
| 15 | **Grupos e permissões** (novo) | `/api/groups` | **Administrativa (define o próprio acesso)** | Sim |

### Informação sensível
- CPF/CNPJ, telefone e e-mail de clientes (áreas 2, 4, 12) — LGPD.
- Chave PIX e conta bancária da agência (área 11).
- Valores de contrato e de cobrança, inadimplência (áreas 1, 6, 8, 12).

### Endpoints que hoje concentram ações distintas
- `PATCH /api/payments/:id` (`server/src/routes/payments.ts:304`) faz **baixa**, **cancelamento** e **edição de campos** no mesmo handler. As três viram permissões separadas.
- `DELETE /api/files/:id` (`server/src/routes/files.ts:188`) apaga **anexo de contrato** e **nota fiscal** no mesmo handler, fisicamente do disco. As duas viram permissões separadas.

---

## Modelo de autorização *

### Conceitos

| Conceito | O que é |
|---|---|
| **Permissão** | A menor unidade concedível. Identificada por uma chave estável (ex.: `payments.settle`). Definida em código — é o catálogo do que o sistema sabe proteger. |
| **Grupo** | Conjunto nomeado de permissões, editável pelo Admin. Ex.: "Operacional", "Financeiro", "Estagiário de conteúdo". |
| **Vínculo usuário↔grupo** | Um usuário pertence a zero, um ou vários grupos. |
| **Permissões efetivas** | **União** das permissões de todos os grupos ativos do usuário. Não existe negação explícita: conceder em qualquer grupo concede. |

### Regras do modelo

1. **Nega por padrão.** Permissão ausente do conjunto efetivo = acesso negado. Rota protegida sem permissão declarada também nega.
2. **A fonte é sempre o banco.** O perfil/permissão considerado nunca vem do corpo, da query string ou do token — é lido do usuário persistido.
3. **Grupo Admin é de sistema.** Nasce com todas as permissões, é marcado como imutável: não pode ser editado, renomeado nem excluído. Protege contra o Admin se trancar para fora do sistema.
4. **Não é possível deixar o sistema sem Admin.** Mantém-se a regra atual (`server/src/routes/users.ts:98-99`): desvincular o último usuário ativo do grupo Admin, ou desativá-lo, é rejeitado com `422`.
5. **Grupo com usuários vinculados não pode ser excluído.** O Admin desvincula antes; a exclusão é rejeitada com `422` e informa quantos usuários dependem do grupo.
6. **Grupos Operacional e Financeiro são semeados, não de sistema.** O Admin pode editar suas permissões, renomeá-los ou excluí-los.
7. **Usuário sem nenhum grupo consegue autenticar**, mas só acessa a própria conta (`/me`, trocar senha, logout). Vê uma tela informando que não há acesso liberado.
8. **Alteração de permissão vale na sessão aberta.** Mudar o grupo de um usuário, ou as permissões de um grupo, reflete sem exigir novo login.
9. **Rota inicial é a primeira tela permitida.** Como um grupo pode não ter acesso ao Dashboard (rota `/` hoje), o login leva à primeira tela que o usuário pode ver.

### Duas categorias de permissão

- **Tela** (`screen.*`) — controla o que aparece no menu e quais rotas o frontend renderiza.
- **Recurso** (`<recurso>.<ação>`) — controla o que a API aceita executar. **É esta que protege o sistema**; a de tela é usabilidade.

---

## Catálogo de permissões *

### Telas

| Chave | Tela |
|---|---|
| `screen.dashboard` | Dashboard (`/`) |
| `screen.clientes` | Clientes (`/clientes`) |
| `screen.pipeline` | Pipeline (`/pipeline`) |
| `screen.contratos` | Contratos (`/contratos`) |
| `screen.financeiro` | Financeiro (`/financeiro`) |
| `screen.usuarios` | Usuários (`/usuarios`) |
| `screen.configuracoes` | Configurações (`/configuracoes`) |
| `screen.grupos` | Grupos e permissões (`/grupos`) — nova |

### Recursos

| Chave | Ação protegida | Endpoint |
|---|---|---|
| `clients.view` | Listar e ver detalhe de cliente | `GET /api/clients`, `GET /api/clients/:id` |
| `clients.create` | Cadastrar cliente/lead | `POST /api/clients` |
| `clients.update` | Editar cadastro | `PATCH /api/clients/:id` |
| `clients.delete` | Excluir cliente (lógica) | `DELETE /api/clients/:id` |
| `clients.stage.update` | Mover etapa no pipeline | `PATCH /api/clients/:id/stage` |
| `clients.owner.update` | Trocar responsável (individual) | `PATCH /api/clients/:id/owner` |
| `clients.batch_reassign` | Reatribuir carteira em lote | `POST /api/clients/batch-reassign` |
| `clients.export` | Exportar CSV de clientes | `GET /api/export/clients` |
| `logs.view` | Ver histórico de interações | `GET /api/clients/:id/logs` |
| `logs.create` | Registrar interação | `POST /api/clients/:id/logs` |
| `contracts.view` | Listar e ver contrato (inclui `valueCents`) | `GET /api/contracts`, `GET /api/contracts/:id` |
| `contracts.create` | Criar contrato | `POST /api/contracts` |
| `contracts.update` | Editar contrato | `PATCH /api/contracts/:id` |
| `contracts.delete` | Excluir contrato (lógica) | `DELETE /api/contracts/:id` |
| `contract_files.view` | Ver/baixar anexo de contrato | `GET /api/files/:id` |
| `contract_files.create` | Anexar arquivo a contrato | `POST /api/files` (`contractId`) |
| `contract_files.delete` | Excluir anexo de contrato (físico) | `DELETE /api/files/:id` |
| `payments.view` | Listar e ver cobrança | `GET /api/payments`, `GET /api/payments/:id` |
| `payments.create` | Emitir cobrança | `POST /api/payments` |
| `payments.update` | Editar valor / vencimento / mês de referência | `PATCH /api/payments/:id` |
| `payments.settle` | Dar baixa (marcar Pago) | `PATCH /api/payments/:id` |
| `payments.cancel` | Cancelar cobrança | `PATCH /api/payments/:id` |
| `payments.export` | Exportar CSV de cobranças | `GET /api/export/payments` |
| `invoices.view` | Ver/baixar nota fiscal | `GET /api/files/:id` |
| `invoices.create` | Anexar nota fiscal | `POST /api/files` (`paymentRecordId`) |
| `invoices.delete` | Excluir nota fiscal (físico) | `DELETE /api/files/:id` |
| `dashboard.financial.view` | KPIs financeiros e alertas de vencido | `GET /api/dashboard` |
| `dashboard.operational.view` | Clientes ativos e distribuição de serviços | `GET /api/dashboard` |
| `settings.view` | Ver configurações da agência | `GET /api/settings` |
| `settings.update` | Editar configurações da agência | `PUT /api/settings` |
| `settings.bank.view` | Ver dados bancários e chave PIX | `GET /api/settings` (subconjunto) |
| `users.view_basic` | Ver lista reduzida de usuários (id + nome dos ativos), para o filtro "Responsável" | novo endpoint reduzido |
| `users.view` | Ver lista completa de usuários | `GET /api/users` |
| `users.manage` | Criar, editar, ativar/desativar usuário e alterar seus grupos | `POST /api/users`, `PATCH /api/users/:id` |
| `groups.view` | Ver grupos e suas permissões | `GET /api/groups` |
| `groups.manage` | Criar, editar e excluir grupos | `POST/PATCH/DELETE /api/groups` |

Sempre permitido a qualquer usuário autenticado, sem permissão: `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/logout`.

---

## Grupos semeados — matriz de permissões *

Legenda: ✅ concedida · — não concedida.

| Permissão | Admin | Operacional | Financeiro |
|---|:---:|:---:|:---:|
| `screen.dashboard` | ✅ | — | ✅ |
| `screen.clientes` | ✅ | ✅ | ✅ |
| `screen.pipeline` | ✅ | ✅ | — |
| `screen.contratos` | ✅ | — | ✅ |
| `screen.financeiro` | ✅ | — | ✅ |
| `screen.usuarios` | ✅ | — | — |
| `screen.configuracoes` | ✅ | — | — |
| `screen.grupos` | ✅ | — | — |
| `clients.view` | ✅ | ✅ | ✅ |
| `clients.create` | ✅ | ✅ | — |
| `clients.update` | ✅ | ✅ | — |
| `clients.delete` | ✅ | — | — |
| `clients.stage.update` | ✅ | ✅ | — |
| `clients.owner.update` | ✅ | ✅ | — |
| `clients.batch_reassign` | ✅ | — | — |
| `clients.export` | ✅ | — | — |
| `logs.view` | ✅ | ✅ | ✅ |
| `logs.create` | ✅ | ✅ | — |
| `contracts.view` | ✅ | — | ✅ |
| `contracts.create` | ✅ | — | ✅ |
| `contracts.update` | ✅ | — | ✅ |
| `contracts.delete` | ✅ | — | — |
| `contract_files.view` | ✅ | — | ✅ |
| `contract_files.create` | ✅ | — | ✅ |
| `contract_files.delete` | ✅ | — | — |
| `payments.view` | ✅ | — | ✅ |
| `payments.create` | ✅ | — | ✅ |
| `payments.update` | ✅ | — | ✅ |
| `payments.settle` | ✅ | — | ✅ |
| `payments.cancel` | ✅ | — | — |
| `payments.export` | ✅ | — | ✅ |
| `invoices.view` | ✅ | — | ✅ |
| `invoices.create` | ✅ | — | ✅ |
| `invoices.delete` | ✅ | — | — |
| `dashboard.financial.view` | ✅ | — | ✅ |
| `dashboard.operational.view` | ✅ | — | ✅ |
| `settings.view` | ✅ | — | — |
| `settings.update` | ✅ | — | — |
| `settings.bank.view` | ✅ | — | ✅ |
| `users.view_basic` | ✅ | ✅ | — |
| `users.view` | ✅ | — | — |
| `users.manage` | ✅ | — | — |
| `groups.view` | ✅ | — | — |
| `groups.manage` | ✅ | — | — |

### Leitura da matriz em nível de acesso

| Área | Admin | Operacional | Financeiro |
|---|---|---|---|
| Dashboard | Total | **Sem acesso** | Visualizar |
| Clientes | Total | Visualizar + Criar + Editar | **Visualizar** |
| Exclusão de cliente | Excluir | Sem acesso | Sem acesso |
| Reatribuição em lote | Executar | Sem acesso | Sem acesso |
| Pipeline | Total | Visualizar + mover etapa + trocar responsável | **Sem acesso** |
| Histórico de interações | Total | Visualizar + Criar | Visualizar |
| Contratos | Total | **Sem acesso** | Visualizar + Criar + Editar |
| Exclusão de contrato | Excluir | Sem acesso | Sem acesso |
| Anexos de contrato | Total | Sem acesso | Visualizar + Enviar |
| Cobranças | Total | Sem acesso | Visualizar + Criar + Editar + Dar baixa |
| Cancelar cobrança | Executar | Sem acesso | **Sem acesso** |
| Notas fiscais | Total | Sem acesso | Visualizar + Enviar |
| Excluir nota fiscal | Excluir | Sem acesso | **Sem acesso** |
| Configurações | Total | Sem acesso | **Visualizar dados bancários/PIX** |
| Usuários | Total | **Lista reduzida** (filtro Responsável) | Sem acesso |
| Grupos e permissões | Total | Sem acesso | Sem acesso |
| Exportar clientes | Executar | Sem acesso | Sem acesso |
| Exportar cobranças | Executar | Sem acesso | Executar |
| Conta própria | Total | Total | Total |

### Consequências das decisões que exigem mudança de comportamento

| Origem | Consequência |
|---|---|
| **DP-01** (Operacional sem Dashboard) | O Dashboard é a rota `/`. O login precisa levar o usuário à primeira tela permitida — para o Operacional, `/pipeline`. |
| **DP-02/DP-03** (Operacional não vê contratos) | Em `ClientDetailsModal.tsx:129` a aba de contratos do cliente deixa de carregar para quem não tem `contracts.view`. |
| **DP-06** (Operacional vê usuários) | `ClientsPage.tsx:161` e `KanbanPage.tsx:67` hoje chamam `GET /api/users` (admin-only, devolve e-mail, papel e `mustChangePassword`). Passam a consumir um endpoint reduzido com id + nome dos usuários ativos, protegido por `users.view_basic`. |
| **DP-10** (Financeiro não cancela) | `PATCH /api/payments/:id` precisa separar baixa, cancelamento e edição; o botão de cancelar some para o Financeiro. |
| **DP-12** (Financeiro vê PIX/banco) | `FinancialPage.tsx:82` hoje chama `GET /api/settings` com `.catch()` silencioso. Passa a consumir um retorno reduzido de `Settings`, sem escrita, protegido por `settings.bank.view`. |
| **DP-16/DP-17** (sem migração) | O campo `User.role` e o valor `membro` deixam de existir. Não há migração de dados; o seed recria os usuários com seus grupos. |
| **DP-18** (acúmulo) | Nasce o modelo de grupos com união de permissões. Um usuário pode ser Operacional **e** Financeiro. |
| **DP-19** (vê todos os clientes) | O escopo é por tela e por ação, não por carteira (`ownerId`). Nenhum filtro row-level. |

---

## Coerência entre tela e permissão de dado *

**DP-20 — resolvida: avisar e impedir.** Uma permissão de tela só pode ser marcada se a permissão de leitura correspondente também estiver marcada. O sistema **não concede nada automaticamente**: ele avisa qual permissão falta e impede a marcação até que o Admin a conceda explicitamente.

| Permissão de tela | Exige |
|---|---|
| `screen.dashboard` | `dashboard.financial.view` **ou** `dashboard.operational.view` |
| `screen.clientes` | `clients.view` |
| `screen.pipeline` | `clients.view` |
| `screen.contratos` | `contracts.view` |
| `screen.financeiro` | `payments.view` |
| `screen.usuarios` | `users.view` |
| `screen.configuracoes` | `settings.view` |
| `screen.grupos` | `groups.view` |

Comportamento:

- Na tela de grupos, a permissão de tela fica **desabilitada** enquanto a permissão de leitura exigida não estiver marcada, com aviso indicando exatamente qual falta.
- Desmarcar uma permissão de leitura que sustenta uma tela já marcada **desmarca a tela junto**, com aviso.
- O backend valida a mesma regra e rejeita com `422` qualquer gravação incoerente, mesmo vinda de chamada direta — a UI não é a única barreira.

---

## Histórias de usuário *

### Administração de grupos e permissões
- **Como** Admin, **quero** criar um grupo e marcar exatamente quais telas e quais ações (visualizar, criar, editar, excluir) ele concede, **para** modelar uma função nova sem depender de desenvolvimento.
- **Como** Admin, **quero** editar as permissões de um grupo existente, **para** ajustar o acesso de todos os seus membros de uma vez.
- **Como** Admin, **quero** excluir um grupo que não uso mais, **para** manter a lista enxuta.
- **Como** Admin, **quero** ser impedido de excluir um grupo que ainda tem usuários vinculados, **para** não deixar ninguém sem acesso por engano.
- **Como** Admin, **quero** que o grupo Admin não possa ser editado nem excluído, **para** não conseguir me trancar para fora do sistema.

### Administração de usuários
- **Como** Admin, **quero** vincular um usuário a um ou mais grupos ao criá-lo ou editá-lo, **para** que ele receba a soma das permissões dessas funções.
- **Como** Admin, **quero** que uma pessoa que faz operação e financeiro pertença aos dois grupos, **para** que ela trabalhe nas duas áreas com um único login.
- **Como** Admin, **quero** que a alteração de grupos valha imediatamente na sessão aberta do usuário, **para** que a mudança de função não fique pendente até o próximo login.
- **Como** Admin, **quero** ser impedido de desvincular ou desativar o último usuário do grupo Admin, **para** que o sistema nunca fique sem administrador.

### Acesso do Admin
- **Como** Admin, **quero** continuar acessando todas as áreas e ações do sistema, **para** que a introdução dos grupos não reduza meu alcance atual.
- **Como** Admin, **quero** ser o único a alterar configurações da agência, dados bancários, usuários e grupos, **para** proteger o que é mais sensível.

### Acesso do Operacional
- **Como** usuário Operacional, **quero** abrir o pipeline e mover clientes entre etapas, **para** conduzir o funil sem depender do Admin.
- **Como** usuário Operacional, **quero** registrar interações e manter o cadastro do cliente atualizado, **para** que o histórico da conta fique completo.
- **Como** usuário Operacional, **quero** filtrar clientes por responsável, **para** encontrar minha carteira sem precisar da lista completa de usuários.
- **Como** usuário Operacional, **quero** cair direto no pipeline ao entrar, **para** não bater numa tela de dashboard que não posso ver.

### Acesso do Financeiro
- **Como** usuário Financeiro, **quero** listar e filtrar cobranças por status, mês e cliente, **para** acompanhar o que está pendente, pago ou vencido.
- **Como** usuário Financeiro, **quero** criar e ajustar contratos, **para** que a cobrança recorrente saia com o valor e o dia corretos sem depender do Admin.
- **Como** usuário Financeiro, **quero** emitir uma cobrança e dar baixa quando o pagamento entrar, **para** manter o controle de recebimentos em dia.
- **Como** usuário Financeiro, **quero** ver a chave PIX e os dados bancários da agência, **para** informá-los na cobrança sem consultar o Admin.
- **Como** usuário Financeiro, **quero** exportar as cobranças em CSV, **para** fechar o mês fora do sistema.
- **Como** usuário Financeiro, **quero** não conseguir cancelar cobrança nem apagar nota fiscal, **para** que ações irreversíveis fiquem com o Admin.

### Bloqueio de funcionalidades não autorizadas
- **Como** responsável pela segurança, **quero** que um usuário sem permissão receba acesso negado ao chamar a API diretamente, **para** que esconder o botão não seja a única proteção.
- **Como** responsável pela segurança, **quero** que abrir uma URL restrita redirecione o usuário sem permissão, **para** que ele não veja tela quebrada nem dado parcial.
- **Como** responsável pela segurança, **quero** que alterar o corpo ou os parâmetros da requisição não conceda permissão adicional, **para** que a autorização não dependa de dado enviado pelo cliente.
- **Como** responsável pela segurança, **quero** que um usuário sem nenhum grupo não acesse nada além da própria conta, **para** que a ausência de configuração não vire acesso aberto.

### Validação de autorização no backend
- **Como** desenvolvedor, **quero** que o catálogo de permissões seja declarado em um único módulo, **para** não repetir regra de acesso em cada rota e em cada tela.
- **Como** desenvolvedor, **quero** que uma rota protegida sem permissão declarada negue o acesso por padrão, **para** que esquecer de declarar não vire brecha.
- **Como** desenvolvedor, **quero** adicionar uma permissão nova sem tocar na lógica de autorização, **para** que a evolução seja incremental.

---

## Critérios de aceite *

### Modelo de grupos e permissões
- [ ] Existe um catálogo de permissões com as chaves listadas neste PRD, e o sistema rejeita chave fora do catálogo.
- [ ] O sistema nasce com os grupos `Admin`, `Operacional` e `Financeiro` semeados com exatamente as permissões da matriz.
- [ ] Um usuário pode ser vinculado a mais de um grupo.
- [ ] As permissões efetivas de um usuário são a união das permissões de seus grupos.
- [ ] Um usuário vinculado a Operacional **e** Financeiro acessa pipeline e cobranças com o mesmo login.
- [ ] O campo `User.role` e o valor `membro` não existem mais no schema nem nos tipos do frontend.

### Gestão de grupos (tela)
- [ ] O Admin acessa `/grupos` e vê a lista de grupos com a quantidade de usuários vinculados a cada um.
- [ ] O Admin cria um grupo informando nome e marcando permissões de tela e de recurso.
- [ ] O Admin edita as permissões de um grupo existente e a mudança vale para todos os seus membros.
- [ ] O Admin exclui um grupo sem usuários vinculados com sucesso.
- [ ] Excluir um grupo com usuários vinculados é rejeitado com `422` e a resposta informa quantos usuários dependem dele.
- [ ] Editar, renomear ou excluir o grupo `Admin` é rejeitado com `422`.
- [ ] Criar grupo com nome já existente é rejeitado com `400`.
- [ ] Um usuário sem `groups.manage` recebe `403` em `POST`, `PATCH` e `DELETE /api/groups`.

### Coerência entre tela e permissão de dado
- [ ] Na tela de grupos, uma permissão de tela não pode ser marcada enquanto a permissão de leitura exigida não estiver marcada.
- [ ] O aviso exibido nomeia exatamente a permissão que falta.
- [ ] Desmarcar uma permissão de leitura desmarca junto as telas que dependiam dela, com aviso.
- [ ] Salvar um grupo com permissão de tela sem a permissão de leitura correspondente é rejeitado com `422`, inclusive por chamada direta à API.
- [ ] A resposta `422` identifica a tela e a permissão de leitura ausente.
- [ ] `screen.dashboard` é aceita com `dashboard.financial.view` **ou** `dashboard.operational.view`, e rejeitada sem nenhuma das duas.

### Gestão de usuários
- [ ] O Admin atribui um ou mais grupos ao criar um usuário.
- [ ] O Admin altera os grupos de um usuário existente.
- [ ] Alterar os grupos de um usuário passa a valer na sessão já aberta desse usuário, sem novo login.
- [ ] Alterar as permissões de um grupo passa a valer nas sessões abertas de seus membros, sem novo login.
- [ ] Desvincular o último usuário ativo do grupo `Admin` é rejeitado com `422`.
- [ ] Desativar o último usuário ativo do grupo `Admin` é rejeitado com `422`.
- [ ] Um usuário sem nenhum grupo autentica com sucesso, vê a mensagem de acesso não liberado e recebe `403` em qualquer rota protegida.

### Acesso do Admin
- [ ] Um usuário do grupo Admin acessa todas as áreas e executa todas as ações existentes hoje, sem regressão.
- [ ] Um usuário do grupo Admin recebe `200` em `GET /api/users`, `PUT /api/settings`, `GET /api/export/clients`, `GET /api/export/payments` e `GET /api/groups`.

### Acesso do Operacional
- [ ] Um usuário Operacional move um cliente de etapa com sucesso (`PATCH /api/clients/:id/stage` retorna `200`).
- [ ] Um usuário Operacional troca o responsável de um cliente com sucesso (`PATCH /api/clients/:id/owner` retorna `200`).
- [ ] Um usuário Operacional cria e edita clientes com sucesso.
- [ ] Um usuário Operacional registra interação no cliente com sucesso.
- [ ] Um usuário Operacional obtém a lista reduzida de usuários ativos (id + nome) e o filtro "Responsável" funciona nas telas de Clientes e Pipeline.
- [ ] A lista reduzida de usuários **não** devolve e-mail, grupos nem `mustChangePassword`.
- [ ] Um usuário Operacional recebe `403` em `DELETE /api/clients/:id`.
- [ ] Um usuário Operacional recebe `403` em `GET /api/contracts` e `GET /api/payments`.
- [ ] Um usuário Operacional recebe `403` em `GET /api/dashboard`.
- [ ] Um usuário Operacional recebe `403` em `POST /api/clients/batch-reassign`, `GET /api/export/clients`, `GET /api/users`, `GET /api/settings`, `PUT /api/settings` e `GET /api/groups`.
- [ ] Ao entrar, um usuário Operacional é levado ao Pipeline, não ao Dashboard.
- [ ] O menu de um usuário Operacional exibe apenas Clientes e Pipeline.

### Acesso do Financeiro
- [ ] Um usuário Financeiro lista cobranças com sucesso (`GET /api/payments` retorna `200`).
- [ ] Um usuário Financeiro cria contrato e cobrança com sucesso.
- [ ] Um usuário Financeiro edita valor, vencimento e mês de referência de uma cobrança com sucesso.
- [ ] Um usuário Financeiro dá baixa numa cobrança e o registro fica com status `Pago`.
- [ ] Um usuário Financeiro anexa nota fiscal a uma cobrança com sucesso.
- [ ] Um usuário Financeiro exporta o CSV de cobranças com sucesso.
- [ ] Um usuário Financeiro obtém os dados bancários e a chave PIX em leitura, e o retorno **não** inclui campos de `Settings` fora desse subconjunto.
- [ ] Um usuário Financeiro recebe `403` ao tentar **cancelar** uma cobrança (`PATCH /api/payments/:id` com `status: "Cancelado"`).
- [ ] Um usuário Financeiro recebe `403` ao tentar excluir uma nota fiscal (`DELETE /api/files/:id`).
- [ ] Um usuário Financeiro recebe `403` em `PATCH /api/clients/:id/stage`, `POST /api/clients`, `DELETE /api/contracts/:id`, `PUT /api/settings`, `GET /api/users`, `GET /api/export/clients` e `GET /api/groups`.
- [ ] O menu de um usuário Financeiro exibe Dashboard, Clientes, Contratos e Financeiro; não exibe Pipeline, Usuários, Configurações nem Grupos.

### Separação de ações em endpoints compartilhados
- [ ] `PATCH /api/payments/:id` distingue baixa, cancelamento e edição: cada uma exige sua própria permissão e é negada isoladamente.
- [ ] `DELETE /api/files/:id` distingue anexo de contrato (`contract_files.delete`) de nota fiscal (`invoices.delete`) e nega cada um pela permissão correspondente.
- [ ] `POST /api/files` exige `contract_files.create` quando recebe `contractId` e `invoices.create` quando recebe `paymentRecordId`.
- [ ] `GET /api/dashboard` devolve apenas os blocos permitidos: sem `dashboard.financial.view`, o retorno não contém MRR, faturado, recebido, inadimplência nem alertas de cobrança.

### Bloqueio de acesso não autorizado
- [ ] Toda requisição negada por permissão retorna `403` com corpo de erro em JSON, distinto do `401` de não autenticado.
- [ ] Uma chamada direta via `curl`/Postman a um endpoint sem permissão retorna `403`, sem passar pela UI.
- [ ] Enviar `role`, `groups` ou `permissions` no corpo ou na query string de qualquer requisição não altera a permissão aplicada.
- [ ] Acessar diretamente uma URL de tela restrita redireciona sem renderizar a tela nem disparar as chamadas de dados dela.
- [ ] `GET /api/export/clients` e `GET /api/export/payments` deixam de responder a qualquer usuário autenticado e passam a exigir permissão explícita.
- [ ] Nenhuma rota protegida da API responde `200` a um usuário que não tenha a permissão correspondente.
- [ ] Uma rota protegida sem permissão declarada nega o acesso por padrão.

### Estrutura e evolução
- [ ] O catálogo de permissões está declarado num único módulo compartilhado, não espalhado por rota ou por tela.
- [ ] O frontend deriva menu, rotas e botões do conjunto de permissões devolvido por `GET /api/auth/me`.
- [ ] Adicionar uma permissão nova exige apenas incluí-la no catálogo e aplicá-la no ponto que ela protege.
- [ ] Existem testes de integração cobrindo, para cada grupo semeado, ao menos um acesso permitido e um negado por área.
- [ ] Existe teste cobrindo um usuário com dois grupos e a união correta das permissões.
- [ ] Existe teste cobrindo usuário sem nenhum grupo.

---

## Escopo

### Inclui

- Modelo de autorização em banco: catálogo de permissões, grupos, vínculo usuário↔grupo e união de permissões.
- Seed dos grupos Admin, Operacional e Financeiro conforme a matriz.
- Remoção do campo `role` e do papel `membro`.
- Middleware de autorização por permissão, aplicado em todas as rotas protegidas — inclusive `/api/export`, hoje desprotegida.
- Separação de ações dentro de `PATCH /api/payments/:id`, `POST /api/files` e `DELETE /api/files/:id`.
- Filtragem do payload de `GET /api/dashboard` conforme as permissões do usuário.
- Endpoint reduzido de usuários (id + nome dos ativos) para o filtro "Responsável".
- Leitura restrita dos dados bancários/PIX de `Settings` para quem tem `settings.bank.view`.
- Tela `/grupos`: listar, criar, editar e excluir grupos, marcando telas e ações.
- Tela de Usuários: vincular usuário a um ou mais grupos.
- Propagação de mudança de permissão para sessões abertas.
- Rota inicial derivada da primeira tela permitida.
- Reflexo das permissões no frontend: menu, rotas e botões.
- Tratamento padronizado de acesso não autorizado (`403`).
- Testes de autorização por grupo, por acúmulo de grupos e por ausência de grupo.

### Não inclui

- Criação de novos módulos de negócio.
- Alteração de regras de negócio sem relação com autorização (numeração de cobrança, validação de CPF/CNPJ, cálculo de métricas).
- Permissões atribuídas diretamente a um usuário, fora de grupo.
- Negação explícita de permissão (só existe conceder; a união nunca subtrai).
- Escopo de dado por carteira/`ownerId` — **DP-19** definiu que todos veem todos os clientes.
- Migração de usuários existentes — o banco está em teste (**DP-16/DP-17**).
- Log de auditoria de quem alterou permissão de grupo e quando.
- Hierarquia ou herança entre grupos.
- Permissão por campo (ex.: esconder `valueCents` dentro de um contrato visível) — o corte é por recurso e ação.

---

## Fluxo esperado

1. O usuário faz login em `/login` e recebe o cookie de sessão (`httpOnly`, JWT com `tokenVersion`).
2. O backend carrega os grupos do usuário a partir do banco — nunca de dado enviado pelo cliente — e calcula a união das permissões.
3. `GET /api/auth/me` devolve o usuário com seus grupos e o conjunto de permissões efetivas.
4. O frontend monta menu, rotas e botões a partir desse conjunto: o que não é permitido não é exibido.
5. O usuário é levado à primeira tela que pode ver.
6. Ao executar qualquer operação, o backend revalida a permissão no servidor, antes de tocar o banco.
7. Sem permissão, a operação é bloqueada com `403` e o frontend exibe a mensagem de acesso negado.
8. O Admin gerencia grupos em `/grupos` e vincula usuários a grupos na tela de Usuários.
9. Alterar um grupo, ou os grupos de um usuário, reflete nas sessões abertas afetadas sem exigir novo login.

---

## Restrições ou observações

**Decisões tomadas**

- Autorização por permissão granular, agrupada em grupos, com acúmulo por união.
- Grupo Admin é de sistema: imutável e não excluível.
- Nunca é possível deixar o sistema sem um usuário ativo no grupo Admin.
- Grupo com usuários vinculados não pode ser excluído.
- Usuário sem grupo autentica, mas só acessa a própria conta.
- Nega por padrão, inclusive para rota sem permissão declarada.
- Permissão de tela exige a permissão de leitura correspondente; o sistema avisa e impede a marcação incoerente, sem conceder nada por conta própria (**DP-20**).
- A autorização é obrigatória no backend; o frontend é camada de usabilidade, nunca a única barreira.
- Sem migração de dados: o banco está em teste.

**Restrições encontradas no código atual** (insumo para a SPEC, não solução)

- `User.role` é `String` livre com default `"membro"` (`server/prisma/schema.prisma`), validado por `z.enum(['admin','membro'])` em `server/src/routes/users.ts` e tipado em `client/src/types/index.ts`. Os três pontos mudam juntos.
- `requireAdmin` é binário e está montado em apenas dois pontos (`server/src/app.ts:43-44`).
- `GET /api/export/*` não tem proteção além de `requireAuth` — é a lacuna de maior impacto hoje.
- `ClientsPage.tsx:161` e `KanbanPage.tsx:67` chamam `GET /api/users`, admin-only.
- `FinancialPage.tsx:82` chama `GET /api/settings` (admin-only) com `.catch()` silencioso.
- `PATCH /api/payments/:id` concentra baixa, cancelamento e edição; `DELETE /api/files/:id` atende anexo de contrato e nota fiscal e apaga o arquivo do disco.
- `ClientDetailsModal.tsx:129` carrega contratos do cliente — precisa respeitar `contracts.view`.
- O Dashboard é a rota índice `/` (`client/src/App.tsx`), o que colide com grupos sem acesso a ele.
- Já existe `tokenVersion` (`server/src/middlewares/requireAuth.ts`) para invalidar sessões — mecanismo disponível para propagar mudança de permissão.
- Já existe `server/src/__tests__/permissions.test.ts` cobrindo admin vs membro; será a base a estender.
- A aplicação lida com dado pessoal sob LGPD: qualquer grupo novo que conceda `clients.view` ou `clients.export` amplia a exposição de CPF/CNPJ e telefone.

**Pendências**

Nenhuma. Todas as decisões de produto (DP-01 a DP-20) estão resolvidas.
