# Plano Fase 1 e Fase 2 (AIRPET)

Este documento e um guia unico para preparar o sistema para escalar com VPS + Docker agora, deixando pronto para Fase 2 e para migracao futura de midia para Cloudflare R2 sem retrabalho.

## Objetivo

- Fase 1: aguentar crescimento inicial com estabilidade.
- Fase 2: escalar horizontalmente com previsibilidade.
- Preparacao R2: trocar storage local por bucket sem quebrar o app.

## Arquitetura alvo (Fase 1 pronta para Fase 2)

- Cloudflare (DNS/WAF/CDN)
- Load Balancer (Nginx/HAProxy ou cloud LB)
- 2 VPS de aplicacao (Docker)
  - `api` (HTTP)
  - `worker` (jobs assíncronos)
- Postgres gerenciado (primario + 1 replica leitura)
- Redis (cache, sessao/rate-limit distribuido)
- Fila (RabbitMQ ou SQS)
- Storage de midia local por enquanto (com interface para R2 depois)

## Ordem de execucao

1. Base do servidor (Ubuntu + Docker + seguranca)
2. Compose de producao (`api` + `worker`)
3. Redis instalado e conectado no app
4. Refatoracao de upload para camada de storage
5. Fila + worker com retry
6. Load balancer + 2a VPS
7. Observabilidade + runbook
8. Criterios de virada para Fase 2

---

## Etapa 1 - Base do servidor

### O que fazer

- Atualizar Ubuntu.
- Instalar Docker Engine e docker compose plugin.
- Criar usuario `deploy` sem root.
- Ativar `ufw` (22, 80, 443).
- Preparar diretorios de deploy:
  - `/opt/airpet`
  - `/opt/airpet/releases`
  - `/opt/airpet/shared`

### Prompt para Cursor

```text
Me passe comandos bash para Ubuntu 22.04 para:
1) instalar Docker Engine + docker compose plugin,
2) criar usuario deploy no grupo docker,
3) habilitar UFW (22/80/443),
4) criar diretorios /opt/airpet, /opt/airpet/releases, /opt/airpet/shared,
5) validar instalacao com docker ps.
```

---

## Etapa 2 - Containerizacao de producao

### O que fazer

- Garantir `Dockerfile` de producao enxuto.
- Criar `docker-compose.prod.yml` com:
  - servico `api`
  - servico `worker`
- Adicionar:
  - `restart: always`
  - `healthcheck` para API
  - limites de CPU/RAM
  - `env_file: .env.production`

### Prompt para Cursor

```text
Crie um docker-compose.prod.yml com servicos api e worker.
Requisitos:
- restart always
- healthcheck HTTP da API
- env_file .env.production
- limites de CPU e memoria
- rede interna dedicada
- volumes necessarios para logs/uploads temporarios
```

---

## Etapa 3 - Redis (instalar e conectar)

### 3.1 Instalar Redis na VPS (se nao for gerenciado)

1. `sudo apt update && sudo apt install -y redis-server`
2. `sudo systemctl enable redis-server`
3. Editar `/etc/redis/redis.conf`:
   - `bind 127.0.0.1 ::1`
   - `protected-mode yes`
   - `requirepass SUA_SENHA_FORTE`
   - `maxmemory 512mb` (ajuste conforme VPS)
   - `maxmemory-policy allkeys-lru`
4. `sudo systemctl restart redis-server`
5. Teste: `redis-cli -a SUA_SENHA_FORTE ping` (esperado `PONG`)

### 3.2 Conectar no AIRPET

- Adicionar envs:
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASSWORD`
  - `REDIS_DB`
- Criar `src/config/redis.js` com cliente reutilizavel.
- Migrar rate-limit para store Redis (funcionar igual em 2+ instancias).

### Prompt para Cursor

```text
No projeto AIRPET, crie a estrutura de src/config/redis.js e adapte o middleware
de rate limit para usar Redis em ambiente com multiplas instancias.
Tambem atualize .env.example com REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB.
```

---

## Etapa 4 - Banco para escala

### O que fazer

- Postgres gerenciado com:
  - 1 primario (write)
  - 1 replica (read)
- Separar conexao de leitura/escrita no app.
- Ajustar pool para producao.
- Manter monitoramento de slow query.

### Prompt para Cursor

```text
No AIRPET, proponha separacao de conexao de banco:
- write no primario
- read em replica para consultas pesadas
Sem quebrar os models atuais.
Inclua checklist de tuning do pool para 2 VPS API.
```

---

## Etapa 5 - Upload e storage pronto para R2

### Problema atual

Existem pontos com `multer.diskStorage` espalhados em rotas diferentes, dificultando migracao de storage.

### O que fazer

- Centralizar upload em uma camada unica.
- Criar `StorageService` com interface:
  - `save(file, folder)`
  - `remove(fileKey)`
  - `getPublicUrl(fileKey)`
- Drivers:
  - `local` (agora)
  - `r2` (depois)
- Banco salva so metadados: `file_key`, `url`, `mime`, `size`, `checksum`.

### Prompt para Cursor

```text
Mapeie todos os uploads do AIRPET e refatore para uma camada StorageService.
Quero driver local agora e contrato pronto para driver R2 depois.
Mostre ordem segura de migracao por arquivo para evitar quebrar rotas.
```

---

## Etapa 6 - Fila e worker

### O que fazer

- Introduzir fila (RabbitMQ ou SQS).
- Separar tarefas assíncronas no `worker`:
  - notificacoes
  - processamento de imagem
  - jobs de feed
- Adicionar retry com backoff e dead-letter queue.

### Prompt para Cursor

```text
Implemente arquitetura minima de fila no AIRPET com worker separado da API.
Inclua:
- retries com backoff
- DLQ
- jobs iniciais (notificacao, imagem, feed)
- metricas basicas de fila
```

---

## Etapa 7 - Load balancer e 2 VPS

### O que fazer

- Subir duas VPS com app identico.
- Colocar LB distribuindo trafego.
- Configurar headers corretos de proxy para Express.
- Definir timeout/upload no proxy (ex: 5MB para imagem).

### Prompt para Cursor

```text
Me gere configuracao Nginx de reverse proxy para duas instancias AIRPET:
- upstream com 2 backends
- timeout seguro
- client_max_body_size 5m
- headers corretos para Express atras de proxy
- healthcheck endpoint
```

---

## Etapa 8 - Observabilidade minima obrigatoria

### O que medir

- RPS
- p95 de latencia
- erros 5xx
- fila (tamanho, atraso, falhas)
- DB (conexoes, slow query)

### Alertas minimos

- API indisponivel
- 5xx acima de limiar
- fila acumulando continuamente
- DB saturando

### Prompt para Cursor

```text
Crie runbook operacional do AIRPET para:
1) API fora,
2) DB lento,
3) fila acumulada,
4) erro de upload.
Inclua diagnostico, mitigacao e rollback.
```

---

## Fase 2 - Como entrar sem retrabalho

### Escala alvo

- API: 4 a 8 instancias
- Workers por tipo de job
- Mais replicas de leitura no DB
- Cache de feed agressivo no Redis
- Deploy com zero downtime

### Gatilhos para entrar na Fase 2

- p95 > 300ms em horario de pico por dias seguidos
- CPU API > 70% recorrente
- fila acumulando de forma continua
- slow query frequente mesmo com indice/tuning

### Prompt para Cursor

```text
Monte plano de capacidade para AIRPET em 3 cenarios (baixo, medio, pico):
- numero de instancias API/worker
- sizing de Redis e DB
- gatilhos de escala e rollback
```

---

## Migracao para Cloudflare R2 (depois)

### Estrategia

1. Implementar driver `r2` mantendo o mesmo contrato do `StorageService`.
2. Migrar arquivos existentes com script (local -> bucket).
3. Habilitar fallback temporario para arquivos antigos locais.
4. Trocar `STORAGE_DRIVER=local` para `STORAGE_DRIVER=r2`.
5. Desligar escrita local apos validacao.

### Prompt para Cursor

```text
Crie plano de migracao de midia Local -> Cloudflare R2 sem downtime:
- script de migracao
- validacao por amostragem
- fallback temporario
- estrategia de rollback
```

---

## Checklist final (Fase 1 concluida e pronta para Fase 2)

- [ ] `api` e `worker` em compose de producao
- [ ] Redis conectado e rate-limit distribuido
- [ ] Upload centralizado em `StorageService`
- [ ] Contrato pronto para driver R2
- [ ] Fila com retry/backoff e DLQ
- [ ] 2 VPS atras de LB
- [ ] Monitoramento e alertas ativos
- [ ] Runbook de incidente pronto

