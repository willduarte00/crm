# TASK-15 — Verificação end-to-end

**Arquivo alvo:** nenhum (verificação sobre a aplicação em execução)
**Referência SPEC:** Seções 12 e 13
**Depende de:** TASK-1 a TASK-14
**Bloqueada por:** nenhuma

---

## Contexto

Os testes automatizados cobrem a autorização rota a rota. Falta verificar o comportamento composto na aplicação real: rota inicial por grupo, menu, propagação de mudança de permissão sem novo login e as salvaguardas que impedem o Admin de se trancar para fora.

## O que fazer

**Preparação**

1. Base limpa: `prisma migrate deploy` → `prisma db seed`.
2. Subir a aplicação pelo dev server do projeto (`.claude/launch.json`).
3. Criar quatro usuários pelo Admin: um Operacional, um Financeiro, um com **os dois** grupos e um **sem nenhum**.

**1. Rota inicial e menu**

- [ ] Admin entra e cai no Dashboard; menu com as oito áreas.
- [ ] Operacional entra e cai no **Pipeline**; menu só com Clientes e Pipeline.
- [ ] Financeiro entra e cai no Dashboard; menu com Dashboard, Clientes, Contratos e Financeiro.
- [ ] Usuário com os dois grupos vê a união das áreas.
- [ ] Usuário sem grupo vê "Nenhum acesso liberado" e consegue trocar a senha e sair.

**2. Ações permitidas**

- [ ] Operacional move um card no Pipeline e a mudança persiste após recarregar.
- [ ] Operacional cria e edita um cliente, registra uma interação e usa o filtro "Responsável".
- [ ] Financeiro cria um contrato, emite uma cobrança, dá baixa, anexa uma nota fiscal e exporta o CSV de cobranças.
- [ ] Financeiro vê a chave PIX e os dados bancários na tela Financeiro.

**3. Ações negadas**

- [ ] Operacional não vê os botões de excluir cliente, reatribuir em lote nem exportar.
- [ ] Operacional forçando `/financeiro` na barra de endereços é redirecionado, sem tela quebrada.
- [ ] Financeiro não vê o botão de cancelar cobrança nem o de excluir nota fiscal.
- [ ] Financeiro forçando `/pipeline` é redirecionado.
- [ ] `curl` autenticado como Operacional em `GET /api/export/clients` devolve `403`.
- [ ] `curl` autenticado como Financeiro em `PATCH /api/payments/:id` com `{"status":"Cancelado"}` devolve `403`.
- [ ] `curl` autenticado como Operacional em `GET /api/dashboard` devolve `403`.

**4. Vazamento de dado**

- [ ] `GET /api/dashboard` como Operacional: `403`.
- [ ] `GET /api/dashboard` com um grupo que tenha `dashboard.operational.view` e **não** tenha `settings.bank.view`: a resposta não contém `pixKey`, `bankName`, `bankBranch` nem `bankAccount`.
- [ ] `GET /api/users/basic` como Operacional: itens só com `id` e `name`, sem usuários inativos.

**5. Gestão de grupos**

- [ ] Criar o grupo "Somente leitura de clientes" com `clients.view` + `screen.clientes`, vincular um usuário e confirmar que ele vê a lista sem botões de ação.
- [ ] Tentar marcar `screen.financeiro` sem `payments.view`: a checkbox fica desabilitada e o aviso nomeia a permissão faltante.
- [ ] Marcar `payments.view`, marcar a tela, depois desmarcar `payments.view`: a tela é desmarcada junto, com aviso.
- [ ] Enviar por `curl` um `POST /api/groups` com `screen.financeiro` sem `payments.view`: `422` com `violations`.
- [ ] Tentar editar ou excluir o grupo Admin: ação não oferecida na interface; por `curl`, `422`.
- [ ] Tentar excluir um grupo com usuários vinculados: `422` com a contagem correta.

**6. Propagação sem novo login**

- [ ] Com o Financeiro logado em outra janela, remover `payments.export` do grupo. A próxima tentativa de exportar falha com a mensagem de permissão, e ao recarregar o botão some — **sem** novo login.
- [ ] Vincular o Operacional também ao grupo Financeiro. Ao recarregar, o menu ganha as áreas novas — sem novo login.

**7. Salvaguardas**

- [ ] Tentar remover o único Admin ativo do grupo Admin: `422`.
- [ ] Tentar desativar o único Admin ativo: `422`.
- [ ] Tentar alterar os próprios grupos: `422`.
- [ ] Criar um segundo Admin e repetir a remoção do primeiro: agora permitido.

**8. Regressão**

- [ ] `npm test` no `server/` passa por inteiro.
- [ ] Build do `client/` passa sem erro de tipo.
- [ ] Login, logout, troca de senha e `mustChangePassword` no primeiro acesso continuam funcionando.
- [ ] Nenhuma referência remanescente a `role`, `membro`, `requireAdmin` ou `adminOnly` no código (`grep`).

## Notas de implementação

- O item 6 é o que valida RF-15, o requisito mais fácil de quebrar sem perceber: se as permissões vazarem para o JWT em alguma otimização futura, é aqui que aparece.
- O item 4 verifica a correção do vazamento de dados bancários no dashboard — o achado de segurança que existia antes desta feature.
- Nas verificações por `curl`, extrair o cookie de sessão do login e reutilizá-lo; o cookie é `httpOnly`, então não dá para copiá-lo do console do navegador.
- Anotar o que falhar com o passo exato de reprodução, em vez de corrigir no meio da verificação: correção durante a checagem invalida os itens já marcados.

## Critério de aceite

- [ ] Todos os itens das seções 1 a 8 verificados e marcados.
- [ ] Nenhuma tela dispara chamada que resulte em `403` para o usuário logado.
- [ ] Nenhum resíduo de `role`, `membro`, `requireAdmin` ou `adminOnly` no código.
- [ ] Build e testes relevantes passam sem erros.
