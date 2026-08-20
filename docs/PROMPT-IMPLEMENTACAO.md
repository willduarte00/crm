# Prompts de implementação

Prompts prontos para conduzir a construção do CRM fatia a fatia, conforme o
[PLANO.md](PLANO.md).

**Como usar:** abra uma sessão nova para cada fatia. Cole o **Prompt mestre** e, na
sequência, o prompt da fatia. Sessão nova por fatia mantém o contexto limpo e evita que
decisões de uma fatia contaminem a seguinte.

---

## Prompt mestre

> Cole isto no início de **toda** sessão de implementação.

```
Você vai implementar um CRM para agência de marketing. A especificação completa está em
docs/PLANO.md — leia o arquivo inteiro antes de escrever qualquer código. Ele é a fonte
de verdade e já contém stack, modelo de dados, requisitos funcionais numerados (RF-xx),
requisitos não funcionais, contratos de API e plano de verificação.

REGRAS PERMANENTES

1. O PLANO decide. Os mockups em docs/design/mockups/ são referência visual, e
   docs/design/mockups/README.md marca o status de cada tela (✅ referência, ⚠ corrigir,
   ❌ rejeitada). Onde mockup e plano divergirem, vale o plano. Não implemente a tela
   marcada como rejeitada.

2. As decisões técnicas estão fechadas e registradas em 13.1 com o motivo de cada uma.
   Não as reabra: Node.js + Express + TypeScript, PostgreSQL + Prisma, React 18 + Vite +
   Tailwind + Radix, @hello-pangea/dnd, Recharts, TanStack Query, Zod, bcryptjs, JWT em
   cookie httpOnly.

3. Invariantes que valem em todo o código:
   - Dinheiro sempre Int em centavos, com sufixo Cents no nome do campo. Nunca float,
     nunca Decimal.
   - Datas civis (vencimento, pagamento, início/fim de contrato) são String YYYY-MM-DD.
     Só createdAt/uploadedAt são DateTime.
   - Interface 100% em pt-BR: R$ 1.234,56, dd/mm/aaaa, telefone +55 (11) 98765-4321.
   - Regras de negócio ficam em server/src/domain/ como funções puras, sem Express e sem
     Prisma. É o que torna os testes baratos.
   - Autenticação é opt-out: app.use('/api', requireAuth) com allowlist explícita.
     Nunca proteger rota a rota.

4. Não construa nada que esteja na seção 2.2 (fora do escopo). Em especial: módulo de
   tarefas, notificações, chat, busca global, emissão de NF, boleto, integração
   bancária e tela de status de infraestrutura.

5. Escreva os testes da fatia junto com o código dela, não depois. A seção 12.1 lista
   exatamente quais — são poucos e concentrados em domain/. Não persiga cobertura ampla.

6. Se encontrar um problema real no plano — uma regra ambígua, uma contradição, uma
   decisão que não sobrevive ao contato com o código — pare e me diga, propondo a
   alteração em docs/PLANO.md. Não divirja do plano em silêncio, e não invente
   funcionalidade que ele não pede.

7. Implemente apenas a fatia pedida. Não comece a próxima.

Confirme que leu o plano resumindo em até 5 linhas o que a fatia atual precisa entregar,
e então comece.
```

---

## Fatia 1 — Fundação, autenticação e permissões

```
Implemente a Fatia 1 do plano de implementação (seção 11).

ENTREGÁVEIS

Infraestrutura
- Monorepo com server/ e client/ conforme a estrutura da seção 9.
- docker-compose.yml com serviços app e db (PostgreSQL 16), volumes nomeados,
  healthcheck no db e depends_on: condition: service_healthy no app.
- Dockerfile multi-stage; o Express serve o build do React na mesma origem.
- .env.example com as chaves esperadas e nenhum valor real.
- server/src/env.ts validando o ambiente com Zod e encerrando o processo se JWT_SECRET
  faltar ou for o valor de exemplo.

Banco
- schema.prisma com o modelo COMPLETO da seção 5: USER, CLIENT, CONTRACT,
  PAYMENT_RECORD, INVOICE_FILE, CONTRACT_FILE, INTERACTION_LOG, SETTINGS e
  METRIC_SNAPSHOT. Crie todas as tabelas agora, mesmo as que só serão usadas nas fatias
  4 e 6 — isso evita deriva de modelagem.
- Índice único em PAYMENT_RECORD (contractId, referenceMonth) e em PAYMENT_RECORD.number.
- Migration aplicada no boot do container.
- seed.ts idempotente criando o primeiro admin a partir de ADMIN_EMAIL e ADMIN_PASSWORD.

Autenticação (seção 6)
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me.
- JWT HS256 em cookie httpOnly, SameSite=Lax, Secure derivado de APP_ENV (em local sem
  HTTPS o cookie NÃO pode ter Secure, senão o navegador o descarta).
- Validade de 7 dias com renovação a cada request autenticado.
- tokenVersion no payload, conferido contra o banco a cada request.
- bcryptjs cost 12, senha mínima de 8 caracteres.
- express-rate-limit no login: 5 tentativas por IP a cada 15 minutos.

Autorização (6.5 e 7.6)
- requireAuth (401) valida cookie, tokenVersion e active, injeta req.user.
- requireAdmin (403) olha só req.user.role.
- Lista de rotas administrativas declarada em UM lugar: /api/users e /api/settings.
- RF-09: o último admin ativo não pode ser rebaixado nem desativado (422).
- RF-09a: ninguém altera o próprio papel (422).
- RF-09b: desativar incrementa tokenVersion e derruba a sessão aberta.
- RF-09c: senha inicial definida pelo admin, com mustChangePassword bloqueando as demais
  rotas até a troca.
- RF-09d: trocar a própria senha exige a senha atual e incrementa tokenVersion.

Frontend
- Tailwind configurado com os tokens de docs/design/DESIGN.md (navy #0F172A, teal
  #0D9488, Inter, tabular-nums em tabelas, sidebar 260px, raio 4px/8px).
- Tela de login. NÃO inclua "Esqueci a senha" — não há SMTP no escopo; use "fale com um
  administrador".
- Shell da aplicação: sidebar com Dashboard, Clientes, Pipeline, Contratos, Financeiro,
  Usuários e Configurações. Itens de módulos ainda não construídos podem levar a uma
  tela vazia identificada.
- RequireAuth no router, interceptor de 401 redirecionando para /login.
- O item "Usuários" só aparece no menu para admin — mas isso é cosmético: a garantia é
  o 403 do backend.
- Tela de gestão de usuários (listar, criar com papel e senha inicial, editar, ativar/
  desativar), tela de troca obrigatória no primeiro acesso e tela de troca voluntária.
  Essas três telas não têm mockup; siga o design system.

TESTES (Vitest, no server)
Os blocos "Segurança" e "Permissões" da seção 12.1, na íntegra. São 16 testes.

PRONTO QUANDO
- `docker compose up` do zero sobe app e banco, aplica as migrations e roda o seed.
- Login com o admin do seed funciona e leva ao shell.
- O admin cria um segundo usuário com papel membro.
- Esse membro loga, é obrigado a trocar a senha e recebe 403 em GET /api/users chamado
  direto por curl.
- Tentar desativar o último admin devolve 422.
- Todos os testes passam.
```

---

## Fatia 2 — Clientes e leads

```
Implemente a Fatia 2 (seção 11). Requisitos RF-01 a RF-06c.

- CRUD de clientes/leads com soft delete (deletedAt).
- Validação de CPF e CNPJ com dígito verificador; máscara na UI.
- Telefone normalizado em E.164 na gravação (RF-02); exibição em formato brasileiro,
  aceitando celular de 9 e fixo de 8 dígitos.
- Origem do lead: use a lista do RF-03, não a dos mockups.
- Etapas do funil: as SEIS do RF-04, nesta ordem. Os mockups mostram cinco e rotulam
  colunas com identificadores de requisito ("RF-01 Lead") — isso é erro de geração e
  não vai para a tela.
- Responsável (RF-06a): opcional, exibido como "sem responsável" quando vazio, nunca
  atribuído automaticamente a quem cadastrou. Filtro por responsável.
- Prioridade (RF-06b): alta/media/baixa, padrão media.
- RF-06c: desativar usuário NÃO redistribui os leads dele; ofereça filtro por
  "responsável inativo" para reatribuição em lote.
- Listagem paginada no servidor, 25 por página, com busca e filtros por etapa, origem,
  serviço e responsável.
- Ficha do cliente com abas: Dados Gerais, Contrato & Arquivos (placeholder nesta
  fatia), WhatsApp (placeholder).
- Timeline de anotações (INTERACTION_LOG) com autor e data.
- Dropdown de etapa na ficha.

Referência visual: docs/design/mockups/clients_leads_kinetic_enterprise/, com as
correções listadas no README dos mockups. Remova a seleção múltipla por checkbox.

PRONTO QUANDO: criar lead com CNPJ e WhatsApp, atribuir responsável e prioridade,
filtrar por cada critério, registrar anotação e excluir sem perder o registro do banco.
```

---

## Fatia 3 — Contratos e arquivos

```
Implemente a Fatia 3 (seção 11). Requisitos RF-10 a RF-13.

- CRUD de contratos ligados a cliente, com soft delete.
- billingType recorrente (billingDay 1..31 + billingPeriodMonths) ou pontual
  (installments >= 1). billingPeriodMonths é número de meses, não enum — 1, 3, 6, 12 e
  qualquer outro valor funcionam sem mudança de código (RF-11a).
- Grave billingDay e billingPeriodMonths já nesta fatia, mesmo sem ninguém consumir
  ainda: contratos cadastrados sem esses campos exigiriam repasse manual na fatia 4.
- middlewares/upload.ts: Multer com whitelist (contratos pdf/docx), limite de 10MB, nome
  em disco por UUID, originalName apenas persistido.
- routes/files.ts: POST /api/files e GET /api/files/:id autenticados. NÃO use
  express.static na pasta de uploads — a rota valida sessão, busca o registro e faz
  stream com Content-Disposition. DELETE remove registro e arquivo físico.
- Um contrato aceita múltiplos arquivos (original e aditivos).
- Aba "Contrato & Arquivos" da ficha do cliente funcionando.

Referência visual: contract_details_social_media_content_kinetic_enterprise/. A
"Timeline & Notes" que aparece no contrato NÃO está no modelo (INTERACTION_LOG pendura
no cliente) — não implemente sem me perguntar. O botão "Export" também não está no
escopo.

PRONTO QUANDO: criar contrato recorrente e pontual, anexar PDF, baixar preservando o
nome original, e confirmar que GET /api/files/:id sem cookie devolve 401.
```

---

## Fatia 4 — Cobranças

```
Implemente a Fatia 4 (seção 11). Requisitos RF-20 a RF-32.

Esta é a fatia de maior risco do sistema. Escreva os testes junto com o código.

- server/src/domain/dates.ts e server/src/domain/billing.ts como funções PURAS, sem
  Express e sem Prisma.
- ensurePaymentRecords(contractId): partindo de startDate, avança de
  billingPeriodMonths em billingPeriodMonths e materializa os períodos faltantes até um
  período à frente do atual. Sem cron, sem job.
- Idempotência apoiada no índice único (contractId, referenceMonth). referenceMonth é o
  mês de INÍCIO do período, formato YYYY-MM.
- dueDate = min(billingDay, últimoDiaDoMês).
- amountCents copiado de CONTRACT.valueCents na geração e nunca reescrito depois.
- Não gera para contrato com status != ativo nem com endDate no passado.
- Contrato pontual NÃO passa pela geração preguiçosa: as N parcelas nascem na criação do
  contrato, com datas e valores editáveis.
- Status persistido apenas Pendente/Pago/Cancelado. "Atrasado" é DERIVADO
  (Pendente && dueDate < hoje) — não crie campo nem job para isso.
- Baixa manual exige paidDate e paymentMethod; amountCents é editável para pagamento
  parcial ou desconto.
- Sem pro-rata automático.
- Anexo de NF (pdf/xml) reaproveitando a rota de arquivo da fatia 3.
- RF-32 numeração COB-AAAA-NNNN: gerada DENTRO da mesma transação que cria o registro,
  com lock de linha sobre um contador por ano. A geração preguiçosa materializa vários
  períodos de uma vez e duas pessoas podem criar cobrança ao mesmo tempo — número
  repetido não pode acontecer. O índice único é a rede de segurança. Número de cobrança
  cancelada não é reaproveitado.
- Listagem paginada com filtro de status e período.

TESTES: os blocos "Faturamento", "Status e datas" e "Numeração de cobranças" da seção
12.1, na íntegra.

Referência visual: financial_overview_kinetic_enterprise/ e
payment_record_may_2024_techcorp_industries/. Renomeie "New Invoice" para "Nova
cobrança" — o sistema não emite NF. Adicione a ação de cancelar cobrança, que falta nos
mockups.

PRONTO QUANDO: contrato recorrente de R$ 2.500 com vencimento dia 10 gera as cobranças
certas, dar baixa com PIX e anexar NF funciona, e os testes de dia 31, ano bissexto,
idempotência e concorrência de numeração passam.
```

---

## Fatia 5 — Kanban

```
Implemente a Fatia 5 (seção 11).

- Quadro com @hello-pangea/dnd e as SEIS colunas do RF-04.
- Card com nome, origem, avatar do responsável (RF-06a) e barra de prioridade colorida
  na lateral esquerda (RF-06b) — vermelho para alta, teal para baixa, conforme o design
  system.
- Card sobe para elevação nível 2 enquanto arrastado.
- Movimentação otimista com rollback e toast de erro se o PATCH falhar.
- Contador por coluna.
- Busca e filtro por responsável no topo do quadro.
- Desktop-only (P4). Não construa fallback mobile; o dropdown de etapa da ficha do
  cliente, feito na fatia 2, já cobre o caso de mudar etapa fora do quadro.

Referência visual: pipeline_kanban_kinetic_enterprise/ (mostra só 3 colunas — use 6).

PRONTO QUANDO: arrastar um lead pelas seis etapas persiste, e derrubar a rede no meio do
arrasto reverte o card com aviso.
```

---

## Fatia 6 — Dashboard, configurações e WhatsApp

```
Implemente a Fatia 6 (seção 11). Requisitos RF-40 a RF-53.

- server/src/domain/metrics.ts com funções PURAS para todas as fórmulas.
- MRR: soma de valueCents dos contratos recorrentes E ativos. Pausado não entra.
  Pontual não entra.
- Recebido no mês (caixa), Faturado no mês (competência), inadimplência (soma e
  contagem), taxa de inadimplência = overdueCents/invoicedCents, clientes ativos.
- RF-47 snapshot: ao carregar o dashboard, faça upsert do METRIC_SNAPSHOT do MÊS
  CORRENTE. Quando o mês vira, a linha anterior congela. Sem cron.
- RF-48: o comparativo "vs mês anterior" só aparece quando existe snapshot anterior.
  Sem snapshot, mostre apenas o valor absoluto — não exiba 0% nem estime.
- Widget de alertas: vencidas e a vencer em 7 dias.
- Gráficos Recharts: faturado vs recebido dos últimos 6 meses, e distribuição de
  clientes por serviço.
- Tela de Configurações (só admin): nome da agência, contato, chave PIX com tipo, e
  dados bancários BRASILEIROS (banco, agência, conta). Sem seletor de fuso — a aplicação
  é fixa em America/Sao_Paulo. Sem upload de logo.
- Modal de WhatsApp: link wa.me com telefone em E.164 e texto urlencoded. Quatro
  modelos (boas-vindas, lembrete de vencimento com PIX, envio de NF, personalizada),
  com substituição de nome, valor, vencimento, mês de referência, número da cobrança e
  chave PIX. Mantenha o aviso de que a NF NÃO vai anexada (RF-53).
- Exportação CSV de clientes e cobranças.

Referência visual: dashboard_kinetic_enterprise/, agency_settings_adprecision/ e
whatsapp_message_center_adprecision/ — este último está correto e já traz o aviso do
RF-53. Corrija moeda para R$ em todas.

PRONTO QUANDO: os números do dashboard batem com os dados do banco conferidos à mão, o
comparativo some no primeiro mês e aparece no segundo, e o link do WhatsApp abre com as
variáveis substituídas.
```

---

## Fatia 7 — Empacotamento e deploy

```
Implemente a Fatia 7 (seção 11) e a seção 8.2.

- Revisão do Dockerfile multi-stage e do docker-compose.yml.
- docker-compose.prod.yml sobrepondo: proxy Caddy com HTTPS automático via Let's
  Encrypt, sem porta 5432 exposta ao host.
- Caddyfile.
- Secure do cookie derivado de APP_ENV, verificado nos dois ambientes.
- Rotina de backup: pg_dump e tar da pasta de uploads capturados NO MESMO INSTANTE, com
  envio para fora da VPS. Documente o procedimento de restauração e execute-o uma vez de
  verdade — backup nunca verificado não é backup.
- README na raiz com instalação local, deploy em VPS, variáveis de ambiente e o
  procedimento de backup/restauração. **Parta de docs/EXECUCAO.md**, que já traz todos
  os comandos, a tabela de variáveis e a seção de problemas comuns — valide cada comando
  contra o que foi de fato implementado, corrija o que divergir e remova o aviso de
  "ainda não implementado" do topo.
- Manual do usuário, partindo do rascunho em docs/design/mockups/user_guide_adprecision.md.

NÃO construa tela de status de infraestrutura dentro do app. O mockup
deployment_prep_system_status_adprecision está rejeitado (ver 13.2): expor JWT_SECRET e
DATABASE_URL na interface transforma o CRM em superfície de ataque de infraestrutura.
Esse conteúdo vive em docs/design/mockups/deployment_guide_fatia_7.md, como documentação
— ajuste-o para remover Redis e S3, que não existem no plano.

PRONTO QUANDO: a verificação manual de ponta a ponta da seção 12.2 passa inteira,
incluindo derrubar tudo com docker compose down e confirmar que dados e arquivos
continuam lá.
```

---

## Checklist ao fechar cada fatia

- [ ] Os RFs da fatia estão todos implementados e localizáveis no código
- [ ] Os testes listados na seção 12.1 para esta fatia passam
- [ ] Nenhuma tela mostra `$`, `mm/dd/yyyy` ou rótulo em inglês
- [ ] Nenhuma rota nova ficou fora do `requireAuth`
- [ ] Nada da seção 2.2 foi construído por acidente
- [ ] Toda tela tem estado de carregamento, estado vazio e mensagem de erro
- [ ] Divergências em relação ao plano foram levadas ao PLANO.md, não deixadas no código
