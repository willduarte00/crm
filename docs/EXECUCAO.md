# Execução

Como rodar o CRM em desenvolvimento e em produção.

> **Status:** o sistema ainda não foi implementado. Este documento descreve a execução
> conforme definida no [PLANO.md](PLANO.md) e serve de base para o `README.md` da raiz,
> entregue na fatia 7.

---

## 1. Pré-requisitos

- **Docker Desktop** com backend WSL2 (ambiente de desenvolvimento é Windows 11).
- **Node 20+**, apenas para o modo de desenvolvimento com hot reload.

Em produção, só Docker.

---

## 2. Primeira execução

### 2.1. Arquivo de ambiente

```bash
cp .env.example .env
```

Gere um segredo real para a assinatura das sessões:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Preencha no `.env`:

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Assinatura do token de sessão. **O servidor não sobe sem ele**, nem com o valor de exemplo do `.env.example` |
| `POSTGRES_PASSWORD` | Senha do banco |
| `DATABASE_URL` | Conexão do app com o banco (`db:5432` em Docker, `localhost:5432` em dev local) |
| `ADMIN_EMAIL` | E-mail do primeiro admin, criado pelo seed |
| `ADMIN_PASSWORD` | Senha inicial desse admin |
| `APP_ENV` | `development` ou `production`. Controla o flag `Secure` do cookie |

O `.env` **nunca** é versionado. Só o `.env.example`, com as chaves e nenhum valor real.

### 2.2. Subir

```bash
docker compose up -d
```

O que acontece nessa ordem: o Postgres sobe, o `healthcheck` segura o `app` até o banco
aceitar conexão, as migrations são aplicadas e o seed cria o primeiro admin.

A aplicação responde em **http://localhost:3000**. O Express serve o build do React na
mesma origem — uma porta só, sem CORS.

### 2.3. Primeiro acesso

Entre com o `ADMIN_EMAIL` e o `ADMIN_PASSWORD` do `.env`. O sistema exige troca de senha
no primeiro login (RF-09c). Não existe cadastro público nem recuperação por e-mail: novos
usuários são criados pelo admin, em Configurações → Usuários.

---

## 3. Desenvolvimento

Dois modos, para propósitos diferentes.

### 3.1. Docker completo

É o comando da seção 2.2. Fiel à produção, mas **sem hot reload** — cada alteração exige
rebuild da imagem. Use para validar o empacotamento e reproduzir problemas de produção.

```bash
docker compose up -d --build
```

### 3.2. Hot reload

Só o banco no Docker, aplicação na máquina. É o modo do dia a dia.

```bash
docker compose up -d db
```

Em terminais separados:

```bash
npm --prefix server run dev
```

```bash
npm --prefix client run dev
```

Neste modo o `DATABASE_URL` aponta para `localhost:5432` em vez de `db:5432`. É por isso
que a porta 5432 fica exposta em desenvolvimento — e **fechada em produção**, onde o app
alcança o banco pela rede interna do Compose.

---

## 4. Comandos úteis

Acompanhar os logs da aplicação:

```bash
docker compose logs -f app
```

Rodar os testes:

```bash
npm --prefix server test
```

Aplicar migrations manualmente (normalmente acontece no boot):

```bash
docker compose exec app npx prisma migrate deploy
```

Criar uma migration nova durante o desenvolvimento:

```bash
npm --prefix server exec prisma migrate dev -- --name descricao_da_mudanca
```

Abrir o Prisma Studio para inspecionar o banco:

```bash
npm --prefix server exec prisma studio
```

Parar tudo preservando os dados (os volumes nomeados sobrevivem):

```bash
docker compose down
```

---

## 5. Deploy em VPS

### 5.1. Antes do primeiro deploy

1. **Domínio apontando para o IP da VPS.** O Caddy emite e renova o certificado
   Let's Encrypt sozinho a partir dele — sem domínio resolvendo, não há HTTPS.
2. **`.env` no servidor** com `APP_ENV=production`. É essa variável que liga o flag
   `Secure` do cookie de sessão. Sem ela o login funciona em local e falha em produção;
   com ela ligada em local sem HTTPS, o navegador descarta o cookie e o login falha lá.
3. **Firewall liberando apenas 80 e 443.** A porta da aplicação e a do banco nunca ficam
   acessíveis de fora.

### 5.2. Subir

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

O arquivo de produção sobrepõe o de desenvolvimento: adiciona o Caddy como reverse proxy,
remove a exposição da porta 5432 e ajusta as variáveis de ambiente.

### 5.3. Atualizar uma versão já em produção

```bash
git pull
```

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

As migrations são aplicadas no boot do container. **Faça backup antes de atualizar** —
migration que altera coluna não tem desfazer.

---

## 6. Backup e restauração

Banco e uploads formam um par: restaurar um sem o outro produz cobrança apontando para
nota fiscal inexistente. **Capture os dois no mesmo instante.**

### 6.1. Backup

```bash
docker compose exec -T db pg_dump -U crm crm > backup-$(date +%F).sql
```

```bash
docker run --rm -v crm_uploads:/data -v $(pwd):/out alpine tar czf /out/uploads-$(date +%F).tar.gz -C /data .
```

Em produção isso roda diariamente por cron, com envio para fora da VPS. Backup que mora
no mesmo servidor não protege contra a perda do servidor.

### 6.2. Restauração

> **Destrutivo.** Sobrescreve o banco atual por completo. Confirme que está no servidor
> certo antes de executar.

Pare a aplicação, mantendo o banco de pé:

```bash
docker compose stop app
```

Restaure o banco:

```bash
docker compose exec -T db psql -U crm -d crm < backup-2026-08-19.sql
```

Restaure os uploads:

```bash
docker run --rm -v crm_uploads:/data -v $(pwd):/in alpine tar xzf /in/uploads-2026-08-19.tar.gz -C /data
```

Suba de volta:

```bash
docker compose start app
```

### 6.3. Verificação

O plano exige que a restauração seja executada **uma vez de verdade** antes de a fatia 7
ser considerada pronta, e repetida mensalmente. Backup nunca verificado não é backup — é
uma suposição.

Depois de restaurar, confira: o login funciona, uma cobrança antiga abre, e o download da
NF anexada a ela devolve o arquivo.

---

## 7. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Container `app` morre logo após subir | `JWT_SECRET` ausente ou igual ao do `.env.example` — é proposital (seção 6.3 do plano) |
| `app` não conecta no banco no primeiro boot | `healthcheck` do `db` ou `depends_on: condition: service_healthy` faltando no compose |
| Login "funciona" mas volta para a tela de login | Cookie descartado: `APP_ENV=production` em ambiente sem HTTPS, ligando `Secure` indevidamente |
| Login falha só em produção | O inverso: `APP_ENV` não está como `production`, e o cookie sai sem `Secure` |
| HTTPS não sobe na VPS | Domínio não resolve para o IP, ou porta 80 fechada — o Let's Encrypt precisa dela para validar |
| Alteração no código não aparece | Está no modo Docker completo, que não tem hot reload. Use o modo da seção 3.2 |
