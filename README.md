# CRM para Agência de Marketing — Guia Completo e Operacional

CRM interno de alta produtividade para agências de marketing gerenciarem clientes, leads, pipeline de vendas em Kanban, contratos recorrentes e pontuais, cobranças com baixa manual e métricas financeiras (MRR, inadimplência e faturamento).

---

## 🏛️ 1. Arquitetura e Stack Técnica

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Radix UI + Lucide Icons + @hello-pangea/dnd + Recharts + TanStack Query + Sonner.
- **Backend:** Node.js + Express (TypeScript) + Prisma ORM + PostgreSQL 16 + Multer + bcryptjs + jsonwebtoken + Zod.
- **Infraestrutura:** Docker multi-stage, Docker Compose, Caddy 2 (Reverse Proxy com HTTPS automático via Let's Encrypt), volumes nomeados para persistência.
- **Localização:** 100% em pt-BR (moeda `R$ 1.234,56`, datas `dd/mm/aaaa`, telefones `+55 (11) 98765-4321`, fuso horário `America/Sao_Paulo`).

---

## 🚀 2. Execução Local

### Opção A: Via Docker Compose (Recomendado)

1. **Configurar variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```
   Edite o `.env` e configure:
   - `JWT_SECRET`: Chave secreta de pelo menos 32 caracteres (diferente dos exemplos).
   - `ADMIN_EMAIL`: E-mail obrigatório do primeiro usuário administrador.
   - `ADMIN_PASSWORD`: Senha do primeiro usuário administrador (mínimo 12 caracteres, sem valor padrão).

2. **Subir os serviços:**
   ```bash
   docker compose up --build
   ```
3. **Acessar a aplicação:**
   Abra seu navegador em [http://localhost:3000](http://localhost:3000).

O container executa automaticamente no boot:
- As migrations do PostgreSQL via Prisma (`prisma migrate deploy`).
- O seed idempotente do primeiro administrador e configurações da agência (`prisma/seed.ts`).
- O servidor Express servindo a API e a aplicação React na mesma origem.

---

### Opção B: Desenvolvimento Local (Sem Docker)

#### 1. Banco de Dados PostgreSQL
Certifique-se de ter uma instância do PostgreSQL 16 rodando localmente com a URL configurada no `DATABASE_URL` (ex: `postgresql://crm_user:crm_password@localhost:5432/crm_db?schema=public`).

#### 2. Backend (`server/`)
```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

#### 3. Frontend (`client/`)
```bash
cd client
npm install
npm run dev
```
Acesse `http://localhost:5173`. O Vite proxy redireciona requisições `/api` para `http://localhost:3000`.

---

## 🌐 3. Deploy em Produção (VPS)

### 3.1. Requisitos do Servidor
- VPS com Ubuntu 22.04 LTS ou 24.04 LTS (1 vCPU, 1 GB+ RAM, 20 GB+ SSD).
- Domínio ou subdomínio apontando (registro DNS do tipo `A`) para o IP público da VPS (ex: `crm.minhaagencia.com.br`).
- Docker Engine e Docker Compose Plugin instalados.

### 3.2. Configuração de Firewall (UFW)
Apenas as portas 80 (HTTP), 443 (HTTPS) e 22 (SSH) devem ser expostas publicamente. As portas do PostgreSQL (5432) e do Node.js (3000) **não** são publicadas para o host em produção:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3.3. Configuração de Variáveis de Produção
No diretório do projeto na VPS (`/opt/crm`), crie o arquivo `.env`:

```env
# Ambiente de Produção
PORT=3000
NODE_ENV=production
APP_ENV=production
DOMAIN=crm.minhaagencia.com.br

# Banco de Dados Interno (acessível apenas pela rede Docker)
POSTGRES_USER=crm_prod_user
POSTGRES_PASSWORD=gere_uma_senha_forte_aqui
POSTGRES_DB=crm_prod_db
DATABASE_URL=postgresql://crm_prod_user:gere_uma_senha_forte_aqui@db:5432/crm_prod_db?schema=public

# Autenticação (JWT_SECRET com alta entropia)
JWT_SECRET=gere_uma_chave_longa_e_aleatoria_com_mais_de_32_caracteres

# Administrador Inicial
ADMIN_EMAIL=admin@minhaagencia.com.br
ADMIN_PASSWORD=SenhaForteInicial123!

# Uploads
UPLOAD_DIR=/app/uploads
```

### 3.4. Inicialização dos Containers de Produção
Execute a inicialização sobrepondo o `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

O Caddy obterá automaticamente o certificado SSL/TLS gratuito da Let's Encrypt para o seu domínio e gerenciará as renovações sem intervenção manual.

---

## 🔒 4. Segurança e Sessão

- **Cookies `httpOnly` e `Secure`:** O token JWT de sessão é transmitido em cookie `httpOnly`, com `SameSite=Lax`. Em produção (`APP_ENV=production`), a flag `Secure` é ativada automaticamente, impedindo tráfego em texto claro.
- **Revogação Instantânea de Sessão (`tokenVersion`):** Alterações de papel, desativação de usuário ou troca de senha incrementam o `tokenVersion`, invalidando imediatamente todas as sessões ativas do usuário.
- **Proteção do Último Administrador (RF-09 e RF-09a):** O backend impede com HTTP 422 qualquer tentativa de desativar ou rebaixar o único admin ativo ou de alterar o próprio papel.
- **Proteção contra Brute Force:** Rate limit de 5 tentativas por IP a cada 15 minutos na rota `/api/auth/login`.

---

## 💾 5. Rotina de Backup Atômico e Restauração

> [!IMPORTANT]
> O backup é **atômico**: o dump do banco de dados (`pg_dump`) e o arquivamento da pasta de uploads (`tar`) são capturados **no mesmo instante**. Restaurar um sem o outro geraria inconsistência grave (cobranças apontando para notas fiscais inexistentes em disco).

### 5.1. Execução Manual do Backup
Para gerar um backup consolidado:

```bash
# No Linux / VPS:
./scripts/backup.sh

# No Windows (PowerShell):
.\scripts\backup.ps1
```

O script gera um arquivo em `backups/backup_crm_YYYYMMDD_HHMMSS.tar.gz` contendo:
- `database.sql`: Dump limpo do PostgreSQL.
- `uploads.tar.gz`: Cópia compactada de todos os contratos e NFs anexadas.
- `manifest.json`: Metadados com timestamp e checksums SHA256 para validação de integridade.

### 5.2. Agendamento Diário (Cron na VPS)
Para executar o backup diariamente às 03:00 da manhã e manter retenção de 7 dias:

```bash
crontab -e
```
Adicione a linha:
```cron
0 3 * * * cd /opt/crm && ./scripts/backup.sh >> /var/log/crm_backup.log 2>&1
```

### 5.3. Envio para Armazenamento Offsite (Fora da VPS)
Defina a variável `OFFSITE_DESTINATION` no `.env` do servidor (ex: `rclone:meu-bucket:crm-backups` ou `usuario@servidor-remoto:/backups/crm`). O script `scripts/backup.sh` detecta e sincroniza automaticamente via `rclone` ou `scp`.

### 5.4. Procedimento de Restauração
Para restaurar a aplicação a partir de um backup:

```bash
# No Linux / VPS:
./scripts/restore.sh ./backups/backup_crm_20260819_210000.tar.gz --yes

# No Windows (PowerShell):
.\scripts\restore.ps1 -BackupFile .\backups\backup_crm_20260819_210000.tar.gz -Yes
```

O procedimento:
1. Valida os arquivos e os hashes SHA256 do manifesto.
2. Limpa e restaura o volume de uploads.
3. Aplica o dump SQL no PostgreSQL.
4. Confirma a integridade da sincronização.

---

## 🧪 6. Testes Automatizados

Para rodar toda a suíte de testes unitários e de integração (116+ testes cobrindo regras de negócio puras, faturamento, permissões, segurança e integridade de backup):

```bash
cd server
npm test
```

---

## 📋 7. Tabela de Variáveis de Ambiente

| Variável | Obrigatória? | Padrão | Descrição |
|---|---|---|---|
| `PORT` | Não | `3000` | Porta interna em que o Express escuta. |
| `NODE_ENV` | Não | `development` | Ambiente Node (`development`, `production`, `test`). |
| `APP_ENV` | Não | `local` | Define o comportamento do cookie `Secure` (`local`, `staging`, `production`). |
| `DOMAIN` | Sim (em Prod) | `localhost` | Domínio FQDN para emissão de certificado SSL Let's Encrypt pelo Caddy. |
| `DATABASE_URL` | Sim | — | String de conexão com o PostgreSQL. |
| `POSTGRES_USER` | Sim | `crm_user` | Usuário do container Postgres. |
| `POSTGRES_PASSWORD` | Sim | `crm_password` | Senha do container Postgres. |
| `POSTGRES_DB` | Sim | `crm_db` | Nome da base de dados. |
| `JWT_SECRET` | Sim | — | Chave secreta de assinatura JWT (mínimo 32 caracteres). |
| `ADMIN_EMAIL` | Sim | — | E-mail do usuário admin criado na inicialização. |
| `ADMIN_PASSWORD` | Sim | — | Senha do usuário admin criado na inicialização (mínimo 12 caracteres). |
| `UPLOAD_DIR` | Não | `./uploads` | Diretório de armazenamento de anexos (`/app/uploads` no container). |
| `OFFSITE_DESTINATION` | Não | — | Destino remoto para sincronização de backups via rclone/scp. |
