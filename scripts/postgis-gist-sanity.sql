-- Verificacoes manuais: PostGIS e indices GIST no banco AIRPET
-- Rode com: psql -f scripts/postgis-gist-sanity.sql

SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('postgis');

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE indexdef ILIKE '%USING gist%'
ORDER BY tablename, indexname;
