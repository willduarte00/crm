# TASK-8 — Permissão por intenção em cobranças e por tipo em arquivos

**Arquivo alvo:** `server/src/routes/payments.ts`, `server/src/routes/files.ts` (existentes)
**Referência SPEC:** Seções 8.7 e 8.8
**Depende de:** TASK-4
**Bloqueada por:** nenhuma

---

## Contexto

Dois handlers concentram ações que a matriz do PRD separa. `PATCH /api/payments/:id` (`payments.ts:304`) faz baixa, cancelamento e edição de campos; `DELETE /api/files/:id` (`files.ts:188`) apaga anexo de contrato **e** nota fiscal. Como o Financeiro pode dar baixa mas não cancelar (DP-10), e anexar nota mas não excluí-la (DP-11), a guarda de rota não basta: a permissão precisa ser resolvida por intenção e por tipo.

## O que fazer

**1. `server/src/routes/payments.ts`**

Rotas simples:

| Rota | Permissão |
|---|---|
| `GET /` | `payments.view` |
| `GET /:id` | `payments.view` |
| `POST /` | `payments.create` |

`PATCH /:id` — sem guarda de rota. Dentro do handler, depois do `safeParse` e **antes** de montar `updatePayload`, classificar a intenção reaproveitando a lógica que o handler já tem:

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

**2. `server/src/routes/files.ts`**

- **`POST /`** — após o Multer resolver `contractId`/`paymentRecordId`: `contractId` exige `contract_files.create`; `paymentRecordId` exige `invoices.create`. A checagem vem **antes** das consultas ao banco e, ao falhar, remove o arquivo já gravado em disco — o handler já faz esse `unlink` nos caminhos de erro; reusar o mesmo tratamento.
- **`GET /:id`** — resolver o registro primeiro; `ContractFile` exige `contract_files.view`; `InvoiceFile` exige `invoices.view`; nenhum dos dois → `404`.
- **`DELETE /:id`** — mesma resolução; `contract_files.delete` ou `invoices.delete`.

## Notas de implementação

- **`status: 'Pendente'` reverte uma baixa** e por isso cai em `payments.settle`, não em `payments.update`: quem pode dar baixa pode desfazê-la. Decisão registrada na SPEC 8.7.
- Uma requisição que combina baixa e alteração de valor exige **as duas** permissões. Não usar `else if` na classificação.
- Em `files.ts`, `404` vem **antes** de `403` quando o arquivo não existe — devolver `403` para id inexistente e `404` para id válido revela quais identificadores existem.
- A permissão em `POST /api/files` precisa ser verificada depois do Multer (o `contractId` chega no corpo multipart, indisponível antes) mas antes de qualquer consulta ao banco. O arquivo temporário já foi gravado nesse ponto: limpar em disco antes de responder `403`.
- `assertPermission` lança `ForbiddenError`, tratada pelo `errorHandler` (TASK-4). Em `POST /api/files` o `unlink` precisa acontecer antes do lançamento, ou dentro de um `try/catch` local.
- Não alterar regra de negócio: `validatePaymentSettlement`, numeração via `PaymentSequence` e a regra de que cancelamento não libera número (RF-32) ficam intactas.

## Critério de aceite

- [ ] `GET /api/payments`, `GET /api/payments/:id` e `POST /api/payments` declaram suas permissões.
- [ ] `PATCH /api/payments/:id` exige `payments.settle` na baixa e na reversão para pendente.
- [ ] `PATCH /api/payments/:id` exige `payments.cancel` no cancelamento.
- [ ] `PATCH /api/payments/:id` exige `payments.update` na alteração de valor, vencimento, mês de referência ou observação.
- [ ] Requisição que combina baixa e edição exige as duas permissões.
- [ ] Usuário do grupo Financeiro dá baixa com `200` e recebe `403` ao cancelar.
- [ ] `POST /api/files` exige `contract_files.create` com `contractId` e `invoices.create` com `paymentRecordId`.
- [ ] `GET` e `DELETE /api/files/:id` exigem a permissão do tipo correto.
- [ ] Arquivo inexistente devolve `404`, nunca `403`.
- [ ] `403` em `POST /api/files` não deixa arquivo órfão no diretório de upload.
- [ ] Build e testes relevantes passam sem erros.
