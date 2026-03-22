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
