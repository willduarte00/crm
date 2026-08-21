# Prompts de implementação — Grupos e permissões

Prompts prontos para conduzir a implementação task a task, conforme
[SPEC.md](SPEC.md) e as tasks em [tasks/](tasks/).

**Como usar:** abra uma sessão nova para cada task. Cole o **Prompt mestre** e, na
sequência, o prompt da task. Sessão nova por task mantém o contexto limpo e evita que
decisões de uma task contaminem a seguinte.

**Ordem obrigatória:** TASK-1 → 2 → 3 → 4. Depois, 5, 6, 7, 8 e 9 podem correr em
paralelo. TASK-10 exige 6, 7, 8 e 9 concluídas. TASK-11 exige a 3; TASK-12 exige 5 e 11;
TASK-14 exige 9 e 11; TASK-13 exige 6, 11 e 12. TASK-15 é a última.

---

## Prompt mestre

> Cole isto no início de **toda** sessão de implementação.

```
Você vai implementar a feature "Grupos e permissões de acesso" no CRM que está neste
repositório. Antes de escrever qualquer código, leia na íntegra, nesta ordem:

  1. docs/PROJECT-CONTEXT.md         — stack, convenções e regras de domínio do projeto
  2. docs/grupos-e-permissoes/PRD.md — decisões de produto, catálogo e matriz de permissões
  3. docs/grupos-e-permissoes/SPEC.md — o desenho técnico completo

A SPEC é a fonte de verdade técnica. O PRD é a fonte de verdade de produto. Onde eles
divergirem, pare e me avise — não escolha sozinho.

CONTEXTO EM UMA FRASE

O sistema tem hoje dois papéis (admin, membro) e autorização em dois pontos
(server/src/app.ts:43-44). Isso vira: catálogo de permissões granulares em código,
grupos persistidos em banco, usuário vinculado a N grupos, permissões efetivas = união,
validação no servidor em toda operação protegida.

REGRAS PERMANENTES

1. Implemente APENAS a task pedida. Não comece a próxima, não "adiante" trecho de outra
   task, não refatore o que a task não pede.

2. Nega por padrão. Toda rota protegida declara sua permissão. Rota sem permissão
   declarada deve negar, nunca liberar. Não existe atalho "se for admin, libera": o
   Admin tem acesso total porque o grupo dele concede todas as permissões, não porque o
   código o trata como caso especial. Nenhum `if (isAdmin) return next()`.

3. A autorização vem sempre do banco. Nunca de corpo de requisição, query string, header
   ou payload do JWT. Permissão em JWT está explicitamente descartada na SPEC 7.2 — o
   token dura 7 dias e a revogação precisa valer na requisição seguinte.

4. O frontend é usabilidade, nunca segurança. Esconder botão não é controle de acesso.
   Toda ação escondida na interface precisa estar bloqueada no servidor.

5. Convenções do projeto, que continuam valendo:
   - Regra de negócio pura em server/src/domain/*.ts, sem Express e sem Prisma, testada
     em server/src/__tests__/domain.*.test.ts
   - Rotas em server/src/routes/ com validação Zod
   - Testes de rota com supertest em server/src/__tests__/<recurso>.test.ts
   - Nomes de campo em inglês; textos de UI e mensagens de erro em pt-BR
   - Dinheiro em centavos (Int), datas civis como String YYYY-MM-DD
   - Estado de servidor no frontend via @tanstack/react-query
   - Componentes de UI existentes em client/src/components/ui/ (Modal, Field, Button,
     ConfirmDialog, States) — use, não recrie

6. Não crie uma segunda cópia do catálogo de permissões no frontend. O cliente o obtém
   de GET /api/permissions. O PROJECT-CONTEXT já registra a duplicação de regra entre
   server/src/domain/clients.ts e client/src/utils/formatters.ts como risco recorrente;
   não repita o padrão.

7. Não altere regra de negócio existente sem relação com autorização: numeração
   COB-AAAA-NNNN e PaymentSequence, validação de CPF/CNPJ por módulo 11, normalização
   E.164, exclusão lógica por deletedAt, cálculo de métricas e MetricSnapshot,
   mecânica de autenticação (JWT em cookie httpOnly, tokenVersion, mustChangePassword,
   rate limit no login).

8. O banco está em fase de testes: não há dado de produção a migrar. A migration pode
   remover User.role sem conversão e o seed reconstrói o estado inicial.

9. Escreva os testes da task junto com o código dela, não depois.

10. Se encontrar um problema real na SPEC — uma regra ambígua, uma contradição, uma
    decisão que não sobrevive ao contato com o código — pare e me diga, propondo a
    alteração em docs/grupos-e-permissoes/SPEC.md. Não divirja em silêncio e não invente
    comportamento que a SPEC não pede.

11. Ao terminar, rode os testes do server e o build do client, e relate o resultado real.
    Se algo falhar, diga o que falhou; não declare pronto o que não está.

Confirme que leu os três documentos resumindo em até 5 linhas o que a task atual precisa
entregar, e então comece.
```

---

## TASK-1 — Catálogo de permissões

```
Implemente docs/grupos-e-permissoes/tasks/TASK-1-catalogo-de-permissoes.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.2.

Cria server/src/domain/permissions.ts (domínio puro: sem Express, sem Prisma) com o
catálogo de 44 permissões, o mapa SCREEN_DEPENDENCIES, a ordem e as rotas das telas, e
as funções isValidPermission, mergePermissions, findScreenDependencyViolations e
firstAllowedScreen. Mais os testes em server/src/__tests__/domain.permissions.test.ts.

As 44 chaves estão listadas no PRD, seção "Catálogo de permissões". Copie de lá, não
invente nem abrevie.

Atenção especial:
- SCREEN_DEPENDENCIES é a ÚNICA fonte da regra do DP-20. O backend valida por ela e a
  API a devolve ao frontend. Não replique a regra em outro lugar.
- screen.dashboard tem dependência OR: dashboard.financial.view OU
  dashboard.operational.view.
- O teste de consistência do catálogo é o item mais importante: ele precisa falhar se
  alguém adicionar chave a PERMISSIONS sem adicionar a PERMISSION_CATALOG, e vice-versa.
```

## TASK-2 — Modelo de dados e seed

```
Implemente docs/grupos-e-permissoes/tasks/TASK-2-modelo-de-dados-e-seed.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.3.

Remove User.role do schema, cria Group e UserGroup, gera a migration e reescreve o seed
para criar os três grupos e vincular o administrador inicial ao grupo Admin.

Atenção especial:
- Confira a matriz do PRD ("Grupos semeados — matriz de permissões") permissão a
  permissão. Um item a mais em Operacional ou Financeiro é falha de segurança
  silenciosa. Em particular, clients.delete, clients.export, payments.cancel,
  invoices.delete e contracts.delete NÃO pertencem a nenhum dos dois.
- O grupo Admin deriva de PERMISSIONS (todas), não de uma lista copiada.
- onDelete: Restrict em UserGroup.group é intencional — é a segunda linha de defesa
  contra excluir grupo com usuários vinculados.
- O seed é idempotente: rodar duas vezes não pode duplicar grupo nem vínculo.
- Depois desta task o projeto não compila até TASK-4. É esperado.
```

## TASK-3 — Resolução das permissões na autenticação

```
Implemente docs/grupos-e-permissoes/tasks/TASK-3-resolucao-de-permissoes.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.4.

Faz requireAuth carregar os grupos do usuário no select que ele JÁ executa, calcular as
permissões efetivas e expor em req.user.permissions. Ajusta AuthUser e faz /me e /login
devolverem grupos e permissões.

Atenção especial:
- Continua sendo UMA consulta por requisição. Os grupos entram no select existente do
  findUnique; não adicione uma segunda query.
- permissions é Set em req.user (uso quente é has()) e array no JSON de /me (Set não
  serializa).
- Não incremente tokenVersion em mudança de grupo. A leitura por requisição já resolve;
  tokenVersion continua responsável só por desativação e troca de senha.
- Não coloque permissões no JWT.
- Os testes existentes de mustChangePassword e de invalidação por tokenVersion precisam
  continuar passando.
```

## TASK-4 — Middleware de autorização

```
Implemente docs/grupos-e-permissoes/tasks/TASK-4-middleware-de-autorizacao.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.5.

Cria server/src/middlewares/requirePermission.ts com requirePermission,
requireAnyPermission e assertPermission; trata ForbiddenError no errorHandler; remove
requireAdmin.ts e suas montagens em app.ts; registra os routers de grupos e permissões.

Atenção especial:
- 403 (autenticado sem permissão) precisa ser distinguível de 401 (não autenticado).
- O texto do erro precisa passar pela sanitização de client/src/services/api.ts: no
  máximo 300 caracteres, sem < nem >, sem cara de stack trace.
- /api/users e /api/settings deixam de ter guarda de prefixo — cada rota declara a sua,
  porque /api/users/basic e /api/settings/billing exigem permissão diferente do resto.
- assertPermission LANÇA em vez de responder, para funcionar no meio de um handler já em
  andamento.
- Nenhum caminho do código pode conceder acesso por "ser admin".
- Log de negação com userId, method, path e requiredPermission. Sem nome, sem e-mail,
  sem dado pessoal.
```

## TASK-5 — API de grupos

```
Implemente docs/grupos-e-permissoes/tasks/TASK-5-api-de-grupos.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.6.

Cria server/src/routes/groups.ts com GET /api/permissions, GET /api/groups e
POST/PATCH/DELETE /api/groups, mais server/src/__tests__/groups.test.ts.

Atenção especial:
- Ordem de validação: catálogo (400) antes de coerência de tela (422). Uma chave
  inválida não deve produzir mensagem sobre dependência de tela.
- isSystem nunca é aceito no corpo. Descarte o campo se vier.
- No PATCH, valide a coerência sobre o conjunto FINAL de permissões, não sobre o delta.
- DELETE valida userCount na aplicação E o banco tem onDelete: Restrict. Traduza a
  violação de FK do Prisma para o mesmo 422 — nunca deixe vazar como 500.
- O formato de `violations` no corpo do 422 é consumido pela tela de grupos (TASK-12).
  Mantenha-o.
```

## TASK-6 — Usuários e vínculos

```
Implemente docs/grupos-e-permissoes/tasks/TASK-6-api-de-usuarios-e-vinculos.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.10.

Troca role por groupIds nos schemas e rotas de usuários, cria GET /api/users/basic e
migra as duas salvaguardas existentes (próprio papel, último admin ativo) para o modelo
de grupos.

Atenção especial:
- Declare GET /basic ANTES de qualquer rota com parâmetro, senão o Express captura
  "basic" como :id.
- /api/users/basic devolve SÓ id e name, só de usuários ativos. Campo a mais aqui é
  vazamento: o Operacional tem users.view_basic, não users.view.
- A gravação de vínculos precisa ser atômica (deleteMany + createMany + update dentro de
  prisma.$transaction). Um deleteMany bem-sucedido seguido de createMany que falha
  deixaria o usuário sem nenhum grupo.
- groupIds === undefined significa "não mexer"; [] significa "remover de todos". São
  casos diferentes.
- Preserve o que já existe: desativar incrementa tokenVersion; reset de senha define
  mustChangePassword e incrementa tokenVersion.
```

## TASK-7 — Permissões em clientes e contratos

```
Implemente docs/grupos-e-permissoes/tasks/TASK-7-permissoes-em-clientes-e-contratos.md.

Leia o arquivo da task inteiro. Ele cobre o mapa rota → permissão da SPEC 8.5.

Aplica requirePermission nas 16 rotas de server/src/routes/clients.ts e
server/src/routes/contracts.ts, conforme as tabelas da task.

Atenção especial:
- POST /batch-reassign está declarado em clients.ts:262, ANTES de GET /:id. Mantenha
  essa ordem, senão "batch-reassign" vira :id.
- PATCH /:id/stage e PATCH /:id/owner são permissões separadas de clients.update de
  propósito. Não unifique.
- GET /contracts/:id/payments usa contracts.view, não payments.view: é a visão do
  contrato, não a tela Financeiro.
- Nenhuma alteração de regra de negócio nesta task. Só guardas.
```

## TASK-8 — Cobranças e arquivos

```
Implemente docs/grupos-e-permissoes/tasks/TASK-8-permissoes-por-intencao-em-cobrancas-e-arquivos.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.7 e 8.8.

PATCH /api/payments/:id passa a exigir permissão por intenção (baixa, cancelamento,
edição) reaproveitando a classificação que o handler já faz. POST/GET/DELETE /api/files
passam a exigir permissão pelo tipo de arquivo (anexo de contrato vs nota fiscal).

Atenção especial:
- status: 'Pendente' reverte uma baixa e por isso exige payments.settle, não
  payments.update. Quem pode dar baixa pode desfazê-la.
- Uma requisição que combina baixa e edição exige AS DUAS permissões. Não use else if na
  classificação de intenção.
- Em files.ts, 404 vem ANTES de 403 quando o arquivo não existe. Devolver 403 para id
  inexistente e 404 para id válido revela quais identificadores existem.
- Em POST /api/files a permissão só pode ser checada depois do Multer (contractId chega
  no corpo multipart) mas antes de qualquer consulta ao banco. O arquivo temporário já
  está em disco nesse ponto: faça o unlink antes de responder 403, senão sobra arquivo
  órfão.
- Não altere validatePaymentSettlement, a numeração via PaymentSequence nem a regra de
  que cancelamento não libera número (RF-32).
```

## TASK-9 — Dashboard, settings e export

```
Implemente docs/grupos-e-permissoes/tasks/TASK-9-dashboard-settings-e-export.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.5 e 8.9.

Filtra o payload de GET /api/dashboard por permissão, cria GET /api/settings/billing
com leitura reduzida dos dados bancários e protege as duas rotas de exportação.

Atenção especial:
- Esta task corrige um vazamento que existe HOJE: o bloco `settings` de GET
  /api/dashboard entrega pixKey, pixKeyType, bankName, bankBranch e bankAccount a
  qualquer autenticado — um caminho paralelo ao /api/settings protegido. É o item mais
  urgente da feature inteira.
- Filtre o PAYLOAD, não a renderização. Omita o campo do JSON. Enviar e esconder na tela
  não é controle de acesso.
- Não recalcule métricas condicionalmente para "economizar": o upsert de MetricSnapshot
  depende de todas elas, e continua acontecendo em toda chamada autorizada,
  independentemente dos blocos devolvidos. Calcule tudo, devolva o permitido.
- GET /api/settings/billing inclui agencyName (a tela financeira o exibe junto dos dados
  de pagamento); os demais campos administrativos ficam de fora.
- Declare GET /billing antes de qualquer rota com parâmetro.
```

## TASK-10 — Testes de autorização

```
Implemente docs/grupos-e-permissoes/tasks/TASK-10-testes-de-autorizacao.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 13.

Reescreve server/src/__tests__/permissions.test.ts para o modelo de grupos: por grupo,
por acúmulo, sem grupo, segurança, ações compostas, payload filtrado, regras de
integridade e cobertura de rotas.

Atenção especial:
- Os fixtures de permissão devem DERIVAR das mesmas listas do seed (TASK-2), não de
  listas copiadas no teste. Matriz e teste divergirem em silêncio é o pior resultado
  possível.
- O teste de cobertura de rotas é o que impede uma rota nova nascer desprotegida. Ele
  percorre a pilha do Express e falha, de forma legível, nomeando método e caminho.
- A allowlist desse teste é a única concessão ao "nega por padrão". Mantenha curta e
  comentada: /api/health, /api/auth/login, /api/auth/logout, /api/auth/me,
  /api/auth/change-password, mais as rotas que resolvem permissão dentro do handler
  (PATCH /api/payments/:id e as de /api/files, ambas de TASK-8).
- Preserve os casos existentes que continuam válidos. O arquivo é reescrito, não
  descartado.
```

## TASK-11 — Fundação de permissões no frontend

```
Implemente docs/grupos-e-permissoes/tasks/TASK-11-fundacao-de-permissoes-no-frontend.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.11.

Remove Role/user.role do frontend, expõe has() e hasAny() no AuthContext, troca
adminOnly por permission/anyPermission no RequireAuth, cria o redirecionamento inicial
por permissão e filtra o menu do AppShell.

Atenção especial:
- O Dashboard hoje é a rota "/" e o Operacional não tem acesso a ele (PRD, DP-01). A
  rota índice passa a redirecionar para a primeira tela permitida, e o Dashboard ganha
  caminho próprio (/dashboard).
- A ordem do menu e a ordem do redirecionamento inicial são a MESMA lista. Defina uma
  vez e derive as duas; duas listas paralelas divergem.
- Sem permissão, RequireAuth redireciona para a primeira tela permitida, não para "/" —
  que pode ser justamente a proibida.
- Memoize o Set de permissões: has() instável entre renders vira churn em toda tela.
- Usuário sem nenhuma permissão de tela vê EmptyState ("Nenhum acesso liberado"), com
  trocar senha e sair funcionando. Use o componente existente em
  client/src/components/ui/States.tsx.
- Não replique a lista de chaves de permissão no cliente. Só os tipos.
```

## TASK-12 — Tela de grupos

```
Implemente docs/grupos-e-permissoes/tasks/TASK-12-tela-de-grupos.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.11.

Cria client/src/components/Groups/ com GroupsPage, GroupModal e PermissionMatrix. É a
tela que entrega o pedido central da feature: criar grupos, marcar telas e ações.

Atenção especial:
- A regra do DP-20 é APLICADA com os dados de screenDependencies vindos de
  GET /api/permissions, não reimplementada no cliente.
- Comportamento exigido: a checkbox de tela fica desabilitada enquanto falta a permissão
  de leitura, com aviso nomeando exatamente qual falta; desmarcar a última permissão de
  leitura que sustenta uma tela marcada desmarca a tela junto, anunciando o efeito.
- A validação do cliente é conveniência. O backend rejeita com 422 de qualquer forma, e
  a tela precisa tratar esse 422 destacando a tela citada em `violations`.
- Grupo de sistema: além de desabilitar os botões, não abra o modal em edição. O backend
  recusa, mas a tela não deve oferecer a ação.
- Acessibilidade é requisito, não polimento: fieldset/legend por categoria,
  aria-describedby na dependência, role="status" na desmarcação automática. O projeto
  já trata acessibilidade como critério — ver o commit 1632326.
- Aviso visível junto de clients.export e payments.export: concedem a base completa
  (dado pessoal, LGPD).
- Use Modal, Field, Button, ConfirmDialog e States já existentes em
  client/src/components/ui/.
```

## TASK-13 — Vínculo de grupos na tela de usuários

```
Implemente docs/grupos-e-permissoes/tasks/TASK-13-vinculo-de-grupos-na-tela-de-usuarios.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.11.

Troca o select de papel de UserModal por seleção múltipla de grupos e os selos de papel
de UsersPage por selos de grupo.

Atenção especial:
- Um usuário pode ficar sem nenhum grupo — é estado válido (autentica, não acessa nada).
  Não force ao menos uma seleção; o selo "Sem grupo" torna isso visível na listagem.
- Ao editar a si mesmo, desabilite a seleção e NÃO envie groupIds. Enviar [] seria pedir
  remoção de todos e receber 422.
- Não antecipe no cliente a regra do último administrador ativo: a contagem é estado do
  servidor. Exiba o 422 que vier.
- Atualize o texto de `description` do Modal, que hoje cita "papel de acesso".
```

## TASK-14 — Ações condicionais nas telas

```
Implemente docs/grupos-e-permissoes/tasks/TASK-14-acoes-condicionais-nas-telas.md.

Leia o arquivo da task inteiro. Ele cobre a SPEC 8.11.

Oculta os controles sem permissão nas telas de clientes, pipeline, contratos e
financeiro; troca os dois consumos de endpoint admin-only; e torna o Dashboard tolerante
a payload parcial. A tabela completa de controle → permissão está no arquivo da task.

Atenção especial:
- ClientsPage.tsx:161 e KanbanPage.tsx:67 chamam GET /api/users, que é admin-only — o
  filtro "Responsável" JÁ quebra hoje para não-admin. Troque por /api/users/basic. É
  correção de bug existente, não só habilitação do perfil novo.
- FinancialPage.tsx:82 chama GET /api/settings com .catch() silencioso. Troque por
  /api/settings/billing e renderize condicionalmente a has('settings.bank.view').
- ClientDetailsModal.tsx:129 não pode chamar GET /api/contracts sem contracts.view: a
  chamada daria 403 e um erro visível na aba. Não monte a aba.
- No Kanban, desabilite o arraste sem clients.stage.update (isDragDisabled no
  Draggable). Um arraste que sempre volta é pior que um quadro estático.
- Ausência de dado no dashboard é diferente de zero: sem dashboard.financial.view o
  bloco NÃO existe; renderizar "R$ 0,00" seria informação falsa.
- Oculte, não desabilite. Botão desabilitado sem explicação sugere problema temporário.
- Toda queryFn precisa de `enabled` conforme a permissão: nenhuma tela pode disparar
  chamada que resulte em 403 para o usuário logado.
```

## TASK-15 — Verificação end-to-end

```
Execute docs/grupos-e-permissoes/tasks/TASK-15-verificacao-e2e.md.

Leia o arquivo da task inteiro. São 8 seções de verificação sobre a aplicação em
execução: rota inicial e menu, ações permitidas, ações negadas, vazamento de dado,
gestão de grupos, propagação sem novo login, salvaguardas e regressão.

Esta task NÃO escreve código de feature. Ela verifica e relata.

Preparação: base limpa (prisma migrate deploy + prisma db seed), aplicação no dev server
do projeto (.claude/launch.json), e quatro usuários criados pelo Admin — um Operacional,
um Financeiro, um com os dois grupos e um sem nenhum.

Atenção especial:
- A seção 6 (propagação sem novo login) valida o requisito mais fácil de quebrar sem
  perceber. Se as permissões vazarem para o JWT em alguma otimização, é aqui que aparece.
- A seção 4 verifica a correção do vazamento de dados bancários no dashboard — o achado
  de segurança que existia antes desta feature.
- Nas verificações por curl, extraia o cookie de sessão do login e reutilize-o; o cookie
  é httpOnly e não dá para copiá-lo do console do navegador.
- Anote o que falhar com o passo exato de reprodução, EM VEZ de corrigir no meio da
  verificação. Correção durante a checagem invalida os itens já marcados.
- Ao final, relate: itens verificados, itens que falharam com reprodução, e o resultado
  real de `npm test` no server e do build do client. Não declare pronto o que não está.
```
