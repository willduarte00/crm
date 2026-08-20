# Manual do Usuário — CRM para Agência de Marketing

Bem-vindo ao manual operacional do **CRM para Agência de Marketing**. Este guia foi elaborado para capacitar a equipe a utilizar todas as funcionalidades da plataforma no dia a dia, desde a prospecção de leads até o acompanhamento do faturamento e métricas financeiras.

---

## 1. Visão Geral e Navegação

O CRM foi projetado com foco em produtividade desktop (resolução mínima recomendada: 1280px), operando com o tema **Kinetic Enterprise** e interface 100% localizada em português brasileiro (**pt-BR**).

### Estrutura do Menu Lateral:
- **📊 Dashboard:** Visão consolidada de métricas (MRR, faturamento, recebimentos, inadimplência) e alertas de vencimento.
- **👥 Clientes & Leads:** Listagem em tabela com filtros avançados e ficha detalhada do cliente.
- **📌 Pipeline (Kanban):** Quadro visual para movimentação dos leads entre as 6 etapas do funil comercial.
- **📑 Contratos:** Gestão de contratos vigentes, recorrentes e pontuais, com repositório de documentos assinados.
- **💰 Financeiro (Cobranças):** Listagem de cobranças mensais, baixa manual de pagamento e anexo de notas fiscais.
- **💬 WhatsApp:** Central de disparo rápido de mensagens com modelos pré-configurados e variáveis dinâmicas.
- **⚙️ Usuários & Agência (Acesso Admin):** Módulo restrito para criação de usuários, dados bancários e chave PIX da agência.

---

## 2. Acesso ao Sistema e Segurança

### 2.1. Primeiro Acesso e Troca Obrigatória de Senha
- Ao receber o cadastro inicial criado por um administrador, o usuário fará o login com sua senha temporária.
- O sistema exigirá automaticamente a **definição de uma nova senha pessoal** (mínimo de 8 caracteres) antes de liberar o acesso aos módulos do sistema.

### 2.2. Troca Voluntária de Senha
- A qualquer momento, o usuário pode clicar em seu perfil no canto inferior da barra lateral e selecionar **"Alterar Senha"**.
- É obrigatório informar a senha atual para confirmar a operação. Ao concluir, as outras sessões abertas do mesmo usuário serão automaticamente encerradas por segurança.

---

## 3. Gestão de Usuários e Permissões (Admin)

O sistema possui dois níveis de acesso fixos:

| Papel | Permissões |
|---|---|
| **Administrador (`admin`)** | Acesso irrestrito a todos os módulos, incluindo **Gestão de Usuários** e **Configurações da Agência**. |
| **Membro (`membro`)** | Acesso completo a Clientes, Funil Kanban, Contratos, Cobranças, Dashboard, WhatsApp e Exportações CSV. Não visualiza o módulo administrativo. |

### Regras Importantes de Segurança:
- **Proteção do Último Administrador:** O sistema impede o rebaixamento ou desativação do único administrador ativo da agência.
- **Auto-alteração de Papel:** Nenhum usuário pode alterar o seu próprio papel.
- **Desativação Segura:** Usuários nunca são excluídos em definitivo; ao desativar uma conta, seus históricos e anotações na timeline são preservados, e suas sessões ativas caem imediatamente.

---

## 4. Configurações da Agência

Na tela **Configurações da Agência** (restrita a administradores), configure:
- **Nome da Agência e E-mail de Contato.**
- **Telefone Principal** (usado nas comunicações).
- **Chave PIX e Tipo de Chave** (CPF/CNPJ, E-mail, Telefone ou Chave Aleatória).
- **Dados Bancários Brasileiros:** Nome do Banco, Agência e Conta Corrente.

> 💡 *Dica:* A chave PIX configurada aqui será preenchida automaticamente nos modelos de cobrança do WhatsApp.

---

## 5. Gestão de Leads e Clientes

### 5.1. Cadastro de Clientes (PF ou PJ)
- **Documento:** Selecione **CPF** ou **CNPJ**. O sistema aplica máscara automática e valida o dígito verificador.
- **Telefone:** Normalizado no formato internacional E.164 (`+55 (DDD) XXXXX-XXXX`).
- **Origem do Lead:** Escolha entre as opções canônicas: *Instagram, Indicação, Google Ads, Prospecção Ativa, LinkedIn* ou *Outro*.
- **Prioridade:** Defina como **Alta** (destaque vermelho), **Média** (âmbar) ou **Baixa** (cinza).
- **Responsável (`ownerId`):** Atribua o lead a qualquer usuário ativo da agência ou deixe "Sem responsável".

### 5.2. Ficha do Cliente e Linha do Tempo (Timeline)
- Visualize dados cadastrais, contratos vigentes, histórico de cobranças e anotações internas.
- Registre reuniões, ligações e alinhamentos na **Timeline de Interações**, com registro automático de autor e data.

---

## 6. Pipeline Comercial (Kanban)

O quadro Kanban organiza os clientes nas **6 etapas do funil de vendas**:
1. **Novo Lead:** Contato recém-chegado na agência.
2. **Contato / Qualificação:** Primeiro alinhamento e levantamento de necessidades.
3. **Proposta Enviada:** Proposta comercial e escopo em avaliação pelo cliente.
4. **Em Negociação:** Ajustes de escopo, preço e cláusulas contratuais.
5. **Contrato Ativo:** Negócio fechado com contrato assinado e serviço em execução.
6. **Pausado / Churn:** Cliente com serviços suspensos ou contrato encerrado.

### Recursos do Quadro:
- **Arrastar e Soltar:** Mova cards entre colunas com atualização instantânea no banco de dados.
- **Indicadores Visuais:** Avatar com as iniciais do responsável e barra colorida indicando a prioridade do lead.
- **Filtros Rápidos:** Filtre o quadro por responsável, origem do lead ou serviço de interesse.

---

## 7. Gestão de Contratos e Anexos

### 7.1. Tipos de Serviço
- *Tráfego Pago, Social Media & Conteúdo, Sites / Landing Pages, Branding, SEO, Pacote Completo.*

### 7.2. Modelos de Cobrança
- **Recorrente (Mensalidade):** Defina o valor (`R$`), o dia de vencimento (1 a 31) e a periodicidade em meses (1 = Mensal, 3 = Trimestral, 6 = Semestral, 12 = Anual).
- **Pontual (Projeto Fechado):** Defina o valor total e o número de parcelas (ex: 3x). As parcelas são criadas automaticamente na criação do contrato.

### 7.3. Repositório de Documentos Assinados
- Anexe múltiplos arquivos (PDF ou DOCX até 10 MB) por contrato (documento principal, aditivos contratuais, propostas assinadas).
- O download dos arquivos preserva o nome original enviado.

---

## 8. Faturamento e Cobranças

### 8.1. Geração Preguiçosa e Idempotente de Cobranças
- O sistema gera as cobranças automaticamente conforme a necessidade, cobrindo todos os períodos passados e **exatamente um período futuro** à frente.
- **Meses Curtos:** Vencimentos definidos para dia 31 vencem automaticamente no último dia do mês (ex: 28 ou 29 de fevereiro).
- **Numeração Sequencial Única:** Cada cobrança recebe um código oficial rastreável no formato `COB-AAAA-NNNN` (ex: `COB-2026-0001`), que nunca se repete.

### 8.2. Baixa Manual de Pagamento
Ao receber um pagamento:
1. Abra a cobrança e clique em **"Dar Baixa"**.
2. Confirme a **Data do Pagamento** e a **Forma de Pagamento** (PIX, Boleto, Cartão de Crédito ou Transferência).
3. O valor pago pode ser ajustado manualmente (para aplicar descontos combinados ou pagamentos parciais).
4. Anexe a **Nota Fiscal (NF)** correspondente (arquivo PDF ou XML).

### 8.3. Status das Cobranças
- **Pendente:** Aguardando pagamento.
- **Atrasado:** Cobrança pendente cuja data de vencimento é anterior a hoje (status derivado dinamicamente).
- **Pago:** Pagamento confirmado com data e forma registradas.
- **Cancelado:** Cobrança desconsiderada no faturamento.

---

## 9. Central de Mensagens WhatsApp

O módulo de WhatsApp agiliza o contato financeiro e comercial gerando links diretos (`wa.me`) com mensagens formatadas:

### Modelos Disponíveis:
1. **Boas-vindas / Onboarding:** Apresentação da equipe e início dos trabalhos.
2. **Lembrete de Vencimento:** Lembrete amigável com número da cobrança (`COB-AAAA-NNNN`), valor em reais, data de vencimento e chave PIX da agência.
3. **Envio de Nota Fiscal:** Mensagem formal informando a emissão da NF.
4. **Mensagem Personalizada:** Texto livre mantendo o cabeçalho e telefone do cliente.

> [!NOTE]
> **Aviso sobre o WhatsApp:** A API `wa.me` abre a conversa no WhatsApp Web ou App com a mensagem pronta para envio. Por limitações técnicas do protocolo web do WhatsApp, **arquivos (como PDFs de nota fiscal) não são anexados automaticamente** pelo link e devem ser anexados manualmente na janela do WhatsApp antes do envio.

---

## 10. Dashboard Financeiro e Métricas

O dashboard oferece uma visão em tempo real da saúde da agência:

- **MRR (Monthly Recurring Revenue):** Soma das mensalidades de todos os contratos recorrentes com status `Ativo`.
- **Recebido no Mês:** Total de pagamentos confirmados com data de baixa dentro do mês corrente (regime de caixa).
- **Faturado no Mês:** Total de cobranças geradas para o mês de referência corrente (regime de competência).
- **Inadimplência:** Valor total e quantidade de cobranças vencidas e não pagas.
- **Taxa de Inadimplência:** Percentual de valores em atraso em relação ao total faturado no mês.
- **Alertas de Vencimento:** Lista de cobranças vencidas e cobranças que vencerão nos próximos 7 dias.
- **Gráficos:** Evolução do faturamento dos últimos 6 meses e distribuição da carteira de clientes por tipo de serviço.

---

## 11. Exportação de Relatórios em CSV

Para análises em planilhas (Excel ou Google Sheets):
- Na listagem de **Clientes**, clique em **"Exportar CSV"** para obter a base completa de contatos, responsáveis, origens e etapas do funil.
- Na listagem de **Cobranças**, clique em **"Exportar CSV"** para extrair o relatório financeiro com números de cobrança, clientes, valores, datas de vencimento/pagamento e status.