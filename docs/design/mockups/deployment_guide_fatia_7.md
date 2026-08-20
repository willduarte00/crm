# Guia de Empacotamento e Deploy (Fatia 7) — CRM Agência de Marketing

Este documento consolida a especificação técnica de empacotamento, deploy e infraestrutura para o CRM, registrando o motivo de decisões arquiteturais e operacionais.

---

## 1. Decisão de Segurança: Rejeição da Tela de Status de Infraestrutura no App

> [!CAUTION]
> O mockup `deployment_prep_system_status_adprecision` foi **rejeitado** (conforme registrado na seção 13.2 do `PLANO.md`).
> 
> **Motivo:** Expor variáveis como `JWT_SECRET` e `DATABASE_URL` em uma tela da interface web com botões de "Edit Config" e "Initiate Deployment" transforma o CRM em uma superfície de ataque de infraestrutura. Caso uma conta de administrador seja comprometida, o invasor teria acesso imediato às credenciais do banco de dados e controle da infraestrutura do servidor.
>
> Além disso, o mockup original mencionava Redis e buckets S3 — **nenhum dos dois faz parte da arquitetura** (o plano não utiliza Redis e rejeita dependência de serviços pagos de terceiros como S3).
>
> **Diretriz:** Toda configuração de infraestrutura, segredos e rotinas de deploy vive exclusivamente no servidor (via arquivos `.env`, Docker Compose e CLI), e sua documentação pertence a este guia e ao `README.md`.

---

## 2. Dockerfile Multi-Stage

A aplicação é compilada e empacotada em uma única imagem Docker através de três estágios:

1. **Estágio 1 (`client-builder`):** Compila a interface React 18 + Vite + Tailwind CSS (`/app/client/dist`).
2. **Estágio 2 (`server-builder`):** Compila o código TypeScript do backend Express e gera o cliente do Prisma ORM (`/app/server/dist`).
3. **Estágio 3 (`runner`):** Imagem final enxuta baseada em `node:20-alpine`, contendo apenas o runtime Node.js, dependências de produção, migrations do Prisma e o build estático do cliente servido na mesma origem pelo Express (`/app/public-client`).

---

## 3. Docker Compose e Topologia de Serviços

### 3.1. Ambiente de Desenvolvimento (`docker-compose.yml`)
- `db`: PostgreSQL 16 Alpine com healthcheck (`pg_isready`), volume nomeado `postgres_data` e porta 5432 exposta para inspeção local.
- `app`: Servidor Express escutando na porta 3000, com `depends_on: db: condition: service_healthy` e volume nomeado `uploads_data`.

### 3.2. Ambiente de Produção (`docker-compose.prod.yml`)
- **Sobreposição:**
  - `db`: Portas removidas do host (não publica 5432). O banco só é acessível pela rede interna do Docker.
  - `app`: Portas removidas do host (não publica 3000). A aplicação só recebe tráfego vindo do proxy Caddy.
  - `proxy`: Caddy 2 Alpine escutando nas portas 80 (HTTP) e 443 (HTTPS), com volumes nomeados para certificados Let's Encrypt (`caddy_data`) e configurações (`caddy_config`).
  - `APP_ENV=production`: Garante a ativação da flag `Secure` nos cookies de autenticação.

---

## 4. Reverse Proxy e HTTPS Automático (Caddy)

O Caddy gerencia automaticamente a obtenção e renovação de certificados SSL/TLS via Let's Encrypt para o domínio configurado na variável `DOMAIN`.

### `Caddyfile`:
```caddy
{$DOMAIN:localhost} {
    encode gzip zstd
    reverse_proxy app:3000
}
```

---

## 5. Firewall e Isolamento da VPS

Configuração recomendada via UFW:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (Caddy -> redirecionamento HTTPS)
sudo ufw allow 443/tcp  # HTTPS (Caddy)
sudo ufw enable
```

---

## 6. Rotina de Backup Atômico e Restauração

O backup é capturado **simultaneamente** para garantir integridade referencial absoluta entre o banco de dados e os arquivos físicos em disco:

```bash
# Execução do backup
./scripts/backup.sh

# Restauração a partir do arquivo compactado
./scripts/restore.sh ./backups/backup_crm_YYYYMMDD_HHMMSS.tar.gz --yes
```

- Pacote gerado: `backup_crm_YYYYMMDD_HHMMSS.tar.gz` contendo `database.sql`, `uploads.tar.gz` e `manifest.json` com hashes SHA256.
- Envio offsite automatizado via `rclone` ou `scp` através da variável `OFFSITE_DESTINATION`.