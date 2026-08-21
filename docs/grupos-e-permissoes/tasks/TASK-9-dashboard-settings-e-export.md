# TASK-9 — Dashboard por permissão, leitura bancária reduzida e guarda nas exportações

**Arquivo alvo:** `server/src/routes/dashboard.ts`, `server/src/routes/settings.ts`, `server/src/routes/export.ts` (existentes)
**Referência SPEC:** Seções 8.5 e 8.9
**Depende de:** TASK-4
**Bloqueada por:** nenhuma

---

## Contexto

Três lacunas de exposição de dado, todas ativas hoje:

1. `GET /api/dashboard` (`dashboard.ts:24`) devolve MRR, faturado, recebido, inadimplência e alertas a qualquer autenticado — e **também** `pixKey`, `pixKeyType`, `bankName`, `bankBranch` e `bankAccount` no bloco `settings`. É um segundo caminho, desprotegido, para os dados que `/api/settings` guarda com `requireAdmin`.
2. `GET /api/export/clients` e `GET /api/export/payments` (`export.ts:40,99`) entregam a base completa de clientes — com CPF/CNPJ, telefone e e-mail — e de cobranças a qualquer autenticado.
3. O Financeiro precisa dos dados bancários para a cobrança (DP-12), mas `/api/settings` é acesso administrativo completo.

## O que fazer

**1. `server/src/routes/dashboard.ts`**

- Guarda de rota: `requireAnyPermission('dashboard.financial.view', 'dashboard.operational.view')`.
- Montar a resposta condicionalmente:
  - **`dashboard.financial.view`** governa `current.mrrCents`, `receivedCents`, `invoicedCents`, `overdueCents`, `overdueCount`, `delinquencyRate`, e os blocos `previous`, `comparison`, `alerts` e `charts.billingHistory`.
  - **`dashboard.operational.view`** governa `current.activeClients` e `charts.serviceDistribution`.
  - **`settings`** mantém `agencyName`, `contactEmail` e `phone`; `pixKey`, `pixKeyType`, `bankName`, `bankBranch` e `bankAccount` **só** com `settings.bank.view`.
- `current.referenceMonth` e `current.today` sempre presentes.
- O `upsert` de `MetricSnapshot` continua ocorrendo em toda chamada, independentemente dos blocos devolvidos — é o congelamento mensal e não depende de quem consulta.

**2. `server/src/routes/settings.ts`**

| Rota | Permissão |
|---|---|
| `GET /` | `settings.view` |
| `PUT /` | `settings.update` |
| `GET /billing` (nova) | `settings.bank.view` |

`GET /billing` devolve **apenas** `{ agencyName, pixKey, pixKeyType, bankName, bankBranch, bankAccount }`. Declarar antes de qualquer rota com parâmetro.

**3. `server/src/routes/export.ts`**

| Rota | Permissão |
|---|---|
| `GET /clients` | `clients.export` |
| `GET /payments` | `payments.export` |

## Notas de implementação

- **A remoção dos campos bancários do dashboard corrige um vazamento existente**, não só habilita os perfis novos. Se a feature for fatiada, este é o recorte que sai primeiro.
- Filtrar o **payload**, não só a renderização: omitir o campo da resposta JSON. Enviar e esconder na tela não é controle de acesso.
- `client/src/types/dashboard.ts` precisa marcar como opcionais os campos que podem não vir — TASK-14 ajusta o consumo.
- Não recalcular métricas condicionalmente para "economizar": o `upsert` do snapshot depende de todas elas. Calcular tudo, devolver o permitido.
- `GET /api/settings/billing` inclui `agencyName` porque a tela financeira o exibe junto dos dados de pagamento; os demais campos administrativos ficam de fora.

## Critério de aceite

- [ ] `GET /api/dashboard` exige ao menos uma das duas permissões de dashboard.
- [ ] Sem `dashboard.financial.view`, a resposta não contém MRR, faturado, recebido, inadimplência, alertas nem `billingHistory`.
- [ ] Sem `dashboard.operational.view`, a resposta não contém `activeClients` nem `serviceDistribution`.
- [ ] Sem `settings.bank.view`, a resposta do dashboard não contém `pixKey`, `pixKeyType`, `bankName`, `bankBranch` nem `bankAccount`.
- [ ] O `upsert` de `MetricSnapshot` continua ocorrendo em toda chamada autorizada.
- [ ] `GET /api/settings/billing` devolve só o subconjunto bancário e exige `settings.bank.view`.
- [ ] `GET /api/settings` exige `settings.view`; `PUT /api/settings` exige `settings.update`.
- [ ] `GET /api/export/clients` e `GET /api/export/payments` devolvem `403` sem as respectivas permissões.
- [ ] Build e testes relevantes passam sem erros.
