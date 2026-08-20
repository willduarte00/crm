# Mockups — status de cada tela

Telas geradas no Stitch a partir do [plano](../../PLANO.md), tema **Kinetic Enterprise**
([DESIGN.md](../DESIGN.md)).

**Os mockups ilustram, o plano decide.** Onde os dois divergirem, vale o `PLANO.md`.
Cada pasta tem `screen.png` (referência visual) e `code.html` (HTML+Tailwind gerado, útil
como ponto de partida, não como código final).

## Correções que valem para TODAS as telas

Antes de implementar qualquer uma, aplique:

1. **Moeda em `R$ 1.234,56`.** Dashboard e baixa de pagamento estão em dólar.
2. **Datas em `dd/mm/aaaa`.** A baixa de pagamento usa `mm/dd/yyyy`; a tela de contrato
   mistura `2024-01-10` e `10/01/2024`.
3. **Tudo em pt-BR.** Hoje há inglês e português na mesma tela.
4. **Remover do cabeçalho:** botão "Create Task", abas globais "Overview / Timeline /
   Financial", sino de notificações, ícone de chat e busca global. Nada disso está no
   escopo (seção 2.2 do plano).

## Status por tela

| Tela | Status | Observações |
|---|---|---|
| `login_kinetic_enterprise` | ⚠ Corrigir | Remover "Forgot password?" — não há SMTP (RF-09c). Substituir por "fale com um administrador" |
| `dashboard_kinetic_enterprise` | ⚠ Corrigir | Tiles e gráficos OK. Comparativos "vs last month" só aparecem com snapshot (RF-48). Moeda em dólar |
| `clients_leads_kinetic_enterprise` | ⚠ Corrigir | Etapas rotuladas "RF-01 Lead", "RF-02 Qualified" — erro de geração, são IDs de requisito. Usar as 6 etapas do RF-04; "Lost" não existe. Origens divergem do RF-03. Remover checkbox de seleção múltipla. Falta coluna de responsável (RF-06a) |
| `pipeline_kanban_kinetic_enterprise` | ⚠ Corrigir | Só 3 colunas; o RF-04 define 6. Avatar do responsável e barra de prioridade estão certos (RF-06a, RF-06b) |
| `sales_pipeline_kanban_kinetic_enterprise` | ⚠ Corrigir | Variante da anterior; escolher uma |
| `contracts_techcorp_industries_kinetic_enterprise` | ✅ Referência | — |
| `contract_details_social_media_content_kinetic_enterprise` | ✅ Referência | Periodicidade, múltiplos anexos e contrato sem data de fim corretos. A "Timeline & Notes" no contrato não existe no modelo (o `INTERACTION_LOG` pendura no cliente) — decidir antes de implementar. Botão "Export" não está no escopo |
| `financial_overview_kinetic_enterprise` | ✅ Referência | A melhor em localização. Renomear "New Invoice" para "Nova cobrança" — o sistema não emite NF. Numeração agora existe (RF-32), formato `COB-AAAA-NNNN` |
| `payment_record_may_2024_techcorp_industries` | ✅ Referência | Implementa o RF-29 fielmente. Corrigir moeda e formato de data. Falta ação de cancelar cobrança |
| `whatsapp_message_center_adprecision` | ✅ Referência | Preview e variáveis corretos; já traz o aviso do RF-53 sobre anexo manual |
| `agency_settings_adprecision` | ⚠ Corrigir | Remover seletor de fuso (fixo em `America/Sao_Paulo`) e upload de logo (fora do escopo). Trocar "Routing Number / ISPB" por banco/agência/conta. Telefone em formato BR |
| `deployment_prep_system_status_adprecision` | ❌ **Rejeitada** | **Não implementar.** Expõe `JWT_SECRET` e `DATABASE_URL` na interface, com botões de editar config e disparar deploy. Ver risco em 13.2 do plano. Inventa Redis e bucket S3, que não existem no escopo |
| `user_documentation_adprecision` | ⚠ Avaliar | Documentação embutida não está no escopo; o `user_guide_adprecision.md` já cumpre o papel |

## Telas que faltam

O módulo admin foi especificado (RF-07 a RF-09d) mas não tem desenho:

- **Gestão de usuários** — listagem, criação com papel e senha inicial, desativação,
  com as travas do último admin (RF-09) e do próprio papel (RF-09a).
- **Troca de senha obrigatória no primeiro acesso** (RF-09c).
- **Troca de senha voluntária**, exigindo a senha atual (RF-09d).

Note que a sidebar dos mockups já reserva o item **"Users"** — falta só a tela.

## Documentos que vieram junto

- `deployment_guide_fatia_7.md` — correto como **documentação**. É exatamente onde o
  conteúdo da tela rejeitada deve viver. Ajustar: o plano não usa Redis nem S3.
- `user_guide_adprecision.md` — bom rascunho de manual do usuário para a fatia 7.
