# Remocao do Guia de Passo a Passo

## Escopo aplicado

- Remocao do tour de onboarding em `explorar`.
- Remocao do bloco de guia operacional em `admin/tags`.
- Conversao de fluxos guiados para entrada direta em `agenda/lista` e `pets/cadastro`.
- Ajustes de copy em telas com texto de "guiado/passo a passo".
- Mantido onboarding de negocio de parceiros (rotas, services e moderacao).

## Banco de dados: inventario e exclusao controlada

- Resultado do inventario de schema: nenhuma tabela/coluna dedicada ao progresso de tour do usuario final.
- Resultado do inventario de codigo: o tour removido em `explorar` usava `localStorage` (`airpet_onboarding_done`), sem persistencia em banco.
- Nao houve `DELETE` em banco nesta etapa por inexistencia de dados persistidos exclusivos do guia.

### Comandos de VPS (backup e validacao)

```bash
# 1) Backup completo antes de qualquer alteracao em producao
mysqldump -u <user> -p --single-transaction --routines --triggers <db_name> > backup_full_pre_remocao_guia.sql

# 2) (Opcional) backup seletivo, se algum inventario futuro identificar tabela relacionada
mysqldump -u <user> -p <db_name> <tabela_relacionada_ao_guia> > backup_guia_<tabela>.sql

# 3) Snapshot de contagem antes de exclusao (apenas se existir tabela alvo)
mysql -u <user> -p -D <db_name> -e "SELECT COUNT(*) AS total FROM <tabela_relacionada_ao_guia>;"

# 4) Exclusao controlada (somente apos inventario aprovado)
mysql -u <user> -p -D <db_name> -e "DELETE FROM <tabela_relacionada_ao_guia> WHERE <condicao_guia>;"

# 5) Contagem apos exclusao
mysql -u <user> -p -D <db_name> -e "SELECT COUNT(*) AS total FROM <tabela_relacionada_ao_guia>;"
```

## Rollback

- Codigo: `git revert` do commit de remocao.
- Dados: restaurar dump seletivo; se necessario, restaurar dump completo em janela controlada.
- Gatilhos de rollback:
  - quebra funcional em fluxos criticos (`/explorar`, `/agenda`, `/pets/cadastro`, `/tags/admin/lista`);
  - aumento de erro HTTP 4xx/5xx nos endpoints impactados;
  - bloqueio de navegacao em tarefas essenciais.

## Registro obrigatorio de mudancas

### Registro 1

- Data: 2026-05-02
- Alteracao realizada: Remocao do tour `driver.js` e da flag de onboarding no front.
- Local: `src/views/explorar.ejs`
- Motivo: Eliminar funcionalidade de guia passo a passo.
- Impacto: Usuario nao recebe mais tour automatico ao abrir explorar.
- Rollback: Reverter arquivo e restaurar inclusao do `driver.js`.

### Registro 2

- Data: 2026-05-02
- Alteracao realizada: Remocao do bloco visual "Fluxo Completo — Tag NFC (Passo a Passo)".
- Local: `src/views/admin/tags.ejs`
- Motivo: Eliminar guia operacional embutido na tela.
- Impacto: Tela fica mais objetiva, sem painel tutorial expansivel.
- Rollback: Reverter arquivo e restaurar bloco removido.

### Registro 3

- Data: 2026-05-02
- Alteracao realizada: Conversao de agenda de fluxo guiado para formulario direto.
- Local: `src/views/agenda/lista.ejs`
- Motivo: Remover comportamento passo a passo.
- Impacto: Selecao de filtros em uma unica interacao.
- Rollback: Reverter arquivo para estrutura de wizard.

### Registro 4

- Data: 2026-05-02
- Alteracao realizada: Conversao de cadastro pet de telas guiadas para preenchimento direto.
- Local: `src/views/pets/cadastro.ejs`
- Motivo: Remover comportamento passo a passo mantendo campos e envio.
- Impacto: Campos continuam disponiveis sem navegacao por etapas.
- Rollback: Reverter arquivo para fluxo de passos.

### Registro 5

- Data: 2026-05-02
- Alteracao realizada: Ajuste de textos com termos de guia/passo a passo.
- Local: `src/views/parceiros/cadastro.ejs`, `src/views/nfc/minhas-tags.ejs`, `src/views/admin/boosts.ejs`
- Motivo: Coerencia de UX apos remocao do guia.
- Impacto: Mensagens mais diretas, sem referencia a fluxo guiado.
- Rollback: Reverter textos nas views.
