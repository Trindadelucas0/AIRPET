# Migrações do banco (node-pg-migrate)

O schema PostgreSQL não é mais aplicado no boot do servidor. Use os scripts npm abaixo.

## Comandos

- `npm run db:migrate` — aplica migrações pendentes (`up`).
- `npm run db:migrate:down` — desfaz a última migração (`down`). A baseline `1742587200000_baseline` **não** suporta `down` (lança erro de propósito).
- `npm run db:migrate:create nome_descritivo` — cria um novo arquivo em `migrations/` para alterações futuras.

Conexão: defina `DATABASE_URL` no `.env` ou use `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` e `DB_DATABASE` (o script `scripts/run-pgm.cjs` monta a URL automaticamente).

## Deploy

Rode **`npm run db:migrate` antes** de iniciar a API em um ambiente novo ou após puxar código que adiciona migrações.

## Banco que já existia (migrate.js antigo)

Se o schema já foi criado pelo `migrate.js` que rodava no `server.js`, na **primeira** adoção do node-pg-migrate você pode marcar só a baseline como aplicada sem reexecutar o SQL:

```bash
node scripts/run-pgm.cjs up --fake 1742587200000
```

Isso insere o nome da migração na tabela `pgmigrations` sem rodar o `up`. Em seguida, migrações novas passam a ser aplicadas normalmente com `npm run db:migrate`.

**Atenção:** use `--fake` apenas se tiver certeza de que o schema atual corresponde ao conteúdo da baseline (`src/config/migrationBaselineStatements.js`).

## Arquivos

- Migrações versionadas: [migrations/](migrations/)
- SQL idempotente da baseline: [src/config/migrationBaselineStatements.js](src/config/migrationBaselineStatements.js)
- Runner com `.env`: [scripts/run-pgm.cjs](scripts/run-pgm.cjs)

## Playbook de performance (dev/staging)

Para diagnosticar e validar otimizações de query em ambiente de teste:

1. Aplique as migrações:
   - `npm run db:migrate`
2. Capture baseline e pós-migração com:
   - `EXPLAIN (ANALYZE, BUFFERS)` para as queries críticas.
3. Rode os fluxos reais (scheduler/autenticação) e observe os logs de slow query.

### EXPLAIN sugerido (queries críticas)

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT v.*, p.nome AS pet_nome, p.usuario_id
FROM vacinas v
JOIN pets p ON p.id = v.pet_id
WHERE v.data_proxima BETWEEN NOW() AND NOW() + (7 * INTERVAL '1 day')
ORDER BY v.data_proxima ASC;

EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO cron_execucoes (job, status) VALUES ('escalar_alertas', 'em_andamento') RETURNING *;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM usuarios WHERE id = 1;
```

### Rollback rápido (índices de performance)

```sql
DROP INDEX IF EXISTS idx_pets_usuario_id;
DROP INDEX IF EXISTS idx_vacinas_pet_id;
DROP INDEX IF EXISTS idx_vacinas_data_proxima;
```

Se a reescrita da query de vacinas não trouxer ganho, mantenha os índices e reverta apenas o SQL da aplicação para a forma anterior.
