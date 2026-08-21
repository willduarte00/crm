# TASK-7 — Permissões nas rotas de clientes e contratos

**Arquivo alvo:** `server/src/routes/clients.ts`, `server/src/routes/contracts.ts` (existentes)
**Referência SPEC:** Seção 8.5 (mapa rota → permissão)
**Depende de:** TASK-4
**Bloqueada por:** nenhuma

---

## Contexto

Nenhuma rota de clientes ou contratos tem hoje qualquer guarda além de `requireAuth`: qualquer autenticado cria, edita, exclui e reatribui carteira em lote. Esta task aplica a permissão de cada rota.

## O que fazer

**`server/src/routes/clients.ts`**

| Rota | Permissão |
|---|---|
| `GET /` | `clients.view` |
| `GET /:id` | `clients.view` |
| `POST /` | `clients.create` |
| `PATCH /:id` | `clients.update` |
| `DELETE /:id` | `clients.delete` |
| `PATCH /:id/stage` | `clients.stage.update` |
| `PATCH /:id/owner` | `clients.owner.update` |
| `POST /batch-reassign` | `clients.batch_reassign` |
| `GET /:id/logs` | `logs.view` |
| `POST /:id/logs` | `logs.create` |

**`server/src/routes/contracts.ts`**

| Rota | Permissão |
|---|---|
| `GET /` | `contracts.view` |
| `GET /:id` | `contracts.view` |
| `GET /:id/payments` | `contracts.view` |
| `POST /` | `contracts.create` |
| `PATCH /:id` | `contracts.update` |
| `DELETE /:id` | `contracts.delete` |

Aplicar `requirePermission(...)` como segundo argumento de cada declaração de rota, antes do handler.

## Notas de implementação

- **Ordem de declaração:** `POST /batch-reassign` está declarado em `clients.ts:262`, antes de `GET /:id` — manter essa ordem, senão `batch-reassign` seria capturado como `:id`.
- `GET /:id/payments` em contratos devolve cobranças, mas a permissão correta é `contracts.view`: é a visão do contrato, não a tela Financeiro. Quem tem `contracts.view` e não tem `payments.view` continua vendo as cobranças **daquele** contrato — comportamento pretendido para o Financeiro, que tem as duas de qualquer forma.
- Nenhuma alteração de regra de negócio: validação de CPF/CNPJ, normalização de telefone, `deletedAt` e listas fechadas ficam como estão.
- `PATCH /:id/stage` e `PATCH /:id/owner` são permissões separadas de `clients.update` de propósito: o Operacional tem as três, o Financeiro nenhuma, e um grupo futuro pode ter só a de etapa.

## Critério de aceite

- [ ] As 16 rotas listadas declaram sua permissão.
- [ ] `POST /batch-reassign` continua declarado antes de `GET /:id`.
- [ ] Usuário do grupo Operacional recebe `200` em `PATCH /:id/stage`, `PATCH /:id/owner`, `POST /`, `PATCH /:id` e `POST /:id/logs`.
- [ ] Usuário do grupo Operacional recebe `403` em `DELETE /:id`, `POST /batch-reassign` e em todas as rotas de contratos.
- [ ] Usuário do grupo Financeiro recebe `403` em `PATCH /:id/stage` e `POST /api/clients`.
- [ ] Usuário do grupo Financeiro recebe `200` em `GET /api/contracts`, `POST /api/contracts` e `PATCH /api/contracts/:id`, e `403` em `DELETE /api/contracts/:id`.
- [ ] Build e testes relevantes passam sem erros.
