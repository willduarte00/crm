# TASK-14 — Ações condicionais e endpoints trocados nas telas

**Arquivo alvo:** `ClientsPage.tsx`, `ClientDetailsModal.tsx`, `KanbanPage.tsx`, `ContractsPage.tsx`, `ContractFilesModal.tsx`, `FinancialPage.tsx`, `PaymentDetailsModal.tsx`, `DashboardPage.tsx`, `client/src/types/dashboard.ts` (todos existentes)
**Referência SPEC:** Seção 8.11
**Depende de:** TASK-9, TASK-11
**Bloqueada por:** nenhuma

---

## Contexto

Com o backend protegido, as telas ainda oferecem botões que resultarão em `403`. Esta task oculta as ações sem permissão, ajusta os dois consumos que hoje chamam endpoints admin-only e torna o Dashboard tolerante a payload parcial.

## O que fazer

**1. Endpoints trocados**

- `ClientsPage.tsx:161` e `KanbanPage.tsx:67`: `GET /api/users` → `GET /api/users/basic`. O tipo local passa a ser `{ id, name }[]`; carregar apenas com `users.view_basic`, senão ocultar o filtro "Responsável".
- `FinancialPage.tsx:82`: `GET /api/settings` → `GET /api/settings/billing`. Remover o `.catch(() => null as any)` e passar a carregar condicionalmente a `has('settings.bank.view')`, escondendo o bloco de PIX/banco quando não houver permissão.

**2. Ações por permissão** — ocultar (não apenas desabilitar) os controles:

| Arquivo | Controle | Permissão |
|---|---|---|
| `ClientsPage.tsx` | Novo cliente | `clients.create` |
| | Editar | `clients.update` |
| | Excluir | `clients.delete` |
| | Reatribuir em lote | `clients.batch_reassign` |
| | Exportar CSV | `clients.export` |
| `KanbanPage.tsx` | Arraste entre colunas | `clients.stage.update` |
| | Excluir | `clients.delete` |
| `ClientDetailsModal.tsx` | Aba de contratos e a chamada `GET /api/contracts` | `contracts.view` |
| | Registrar interação | `logs.create` |
| | Trocar responsável | `clients.owner.update` |
| | Excluir contrato | `contracts.delete` |
| `ContractsPage.tsx` | Novo contrato | `contracts.create` |
| | Editar | `contracts.update` |
| | Excluir | `contracts.delete` |
| `ContractFilesModal.tsx` | Enviar arquivo | `contract_files.create` |
| | Excluir arquivo | `contract_files.delete` |
| `FinancialPage.tsx` | Nova cobrança | `payments.create` |
| | Exportar CSV | `payments.export` |
| `PaymentDetailsModal.tsx` | Dar baixa | `payments.settle` |
| | Cancelar | `payments.cancel` |
| | Editar campos | `payments.update` |
| | Anexar nota fiscal | `invoices.create` |
| | Excluir nota fiscal | `invoices.delete` |

**3. Dashboard**

- `client/src/types/dashboard.ts`: tornar opcionais os campos que podem não vir (blocos financeiros, `activeClients`, `serviceDistribution`, campos bancários de `settings`).
- `DashboardPage.tsx`: renderizar cada bloco condicionalmente à presença do dado, sem quebrar nem exibir zero inventado quando o campo estiver ausente.

## Notas de implementação

- **No Kanban, desabilitar o arraste sem `clients.stage.update`** — `@hello-pangea/dnd` aceita `isDragDisabled` no `Draggable`. Um arraste que sempre volta é pior que um quadro estático.
- **`ClientDetailsModal` não deve chamar `GET /api/contracts` sem `contracts.view`** (`ClientDetailsModal.tsx:129`): a chamada resultaria em `403` e num erro visível na aba. Não montar a aba.
- Ausência de dado do dashboard é diferente de zero: sem `dashboard.financial.view` o bloco **não existe**; renderizar "R$ 0,00" seria informação falsa.
- Ocultar, não desabilitar: botão desabilitado sem explicação sugere um problema temporário. O PRD pede que o frontend não exiba o que o usuário não pode fazer.
- Isto é usabilidade, não segurança — quem forçar a chamada recebe `403` do backend de qualquer forma.
- Confirmar que nenhuma tela dispara em `useEffect`/`useQuery` uma chamada que resultará em `403`: cada `queryFn` deve ter `enabled` conforme a permissão.

## Critério de aceite

- [ ] `ClientsPage` e `KanbanPage` consomem `/api/users/basic`, e o filtro "Responsável" funciona para o Operacional.
- [ ] `FinancialPage` consome `/api/settings/billing`, sem `.catch()` silencioso.
- [ ] Todos os controles da tabela ficam ocultos sem a permissão correspondente.
- [ ] O arraste do Kanban fica desabilitado sem `clients.stage.update`.
- [ ] `ClientDetailsModal` não monta a aba de contratos nem chama `GET /api/contracts` sem `contracts.view`.
- [ ] O Dashboard renderiza corretamente com payload parcial, sem exibir zero no lugar de dado ausente.
- [ ] Nenhuma tela dispara chamada que resulte em `403` para o usuário logado.
- [ ] Build e testes relevantes passam sem erros.
