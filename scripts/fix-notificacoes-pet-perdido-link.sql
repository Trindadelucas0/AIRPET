-- Corrige links antigos de notificações de pet perdido.
-- Antes: /pet-perdido/<pets_perdidos.id> (rota inexistente, causava 404)
-- Depois: /pets/<pet_id> (página do pet que existe)
--
-- Uso (exemplo com psql):
--   psql -U usuario -d airpet -f scripts/fix-notificacoes-pet-perdido-link.sql
--
-- Ou execute apenas o UPDATE abaixo no seu cliente SQL.

BEGIN;

UPDATE notificacoes n
SET link = '/pets/' || pp.pet_id
FROM pets_perdidos pp
WHERE n.link ~ '^/pet-perdido/[0-9]+$'
  AND pp.id = (regexp_replace(n.link, '^/pet-perdido/', ''))::integer;

-- Opcional: notificações cujo alerta foi removido (pet_perdido não existe mais)
-- podem ficar com link quebrado. Se quiser redirecionar para a lista de notificações:
-- UPDATE notificacoes
-- SET link = '/notificacoes'
-- WHERE link ~ '^/pet-perdido/[0-9]+$';

COMMIT;
