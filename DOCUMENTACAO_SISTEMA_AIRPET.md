# AIRPET - Documentacao Completa do Sistema

## 1) O que e o AIRPET

O AIRPET e uma plataforma digital para identificacao e recuperacao de pets via tag NFC, com experiencia PWA (instalavel no celular), mapa geolocalizado, feed social pet, chat moderado e painel administrativo.

Em termos praticos:
- O tutor cadastra o pet e vincula uma tag NFC.
- Se o pet for encontrado, qualquer pessoa escaneia a tag e acessa uma pagina publica com informacoes do pet e formas de contato.
- O sistema registra localizacao, gera alertas e ajuda a acelerar o reencontro entre tutor e pet.

### Problema que o sistema resolve
- Dificuldade de devolver rapidamente pets perdidos ao tutor.
- Falta de um historico central de saude e rotina do pet.
- Baixa coordenacao entre comunidade local, tutor e pontos de apoio (petshops, clinicas, ONGs).

### Publico-alvo
- Tutores de pets (uso diario e seguranca).
- Pessoas que encontram pets na rua (uso sem cadastro).
- Operacao interna/admin (moderacao, suporte, analytics e governanca).

---

## 2) O que o sistema faz (usuario final)

## Funcionalidades principais para tutores

- Cadastro e autenticacao de conta.
- Cadastro e gestao de pets (foto, dados, historico).
- Vinculacao de tag NFC ao pet.
- Carteira de saude (vacinas, registros e acompanhamento).
- Diario do pet (rotina e eventos com fotos).
- Fluxo de pet perdido com alerta e acompanhamento.
- Mapa interativo com pontos de interesse e avistamentos.
- Rede social pet (feed, explorar, curtidas, comentarios, repost, seguidores).
- Chat para contato com quem encontrou o pet (com moderacao).
- Agendamentos em petshops parceiros.
- Notificacoes in-app, push e eventos em tempo real.

## Fluxo NFC (quem encontrou o pet, sem cadastro)

1. A pessoa aproxima o celular da tag NFC.
2. O sistema abre uma rota publica da tag.
3. Exibe dados do pet e opcoes para contatar o tutor.
4. Permite enviar localizacao e/ou foto do pet encontrado.
5. O tutor recebe notificacao e pode seguir com chat e coordenacao do reencontro.

## Como os modulos se conectam

Fluxo mais comum em incidente real:
- Tutor ativa alerta de pet perdido.
- Admin pode aprovar/escalar o alerta.
- Mapa passa a destacar o caso.
- Usuarios proximos recebem notificacoes por regiao/proximidade.
- Novos scans NFC e avistamentos atualizam o contexto.
- Chat ajuda na comunicacao ate a resolucao.

---

## 3) O que o admin faz

O painel administrativo concentra operacao, seguranca, curadoria e crescimento da plataforma.

## Acesso administrativo
- Login admin separado do usuario comum.
- URL base de admin configuravel por variavel de ambiente (`ADMIN_PATH`).
- Sessao propria para o papel administrativo.

## Principais responsabilidades no painel

- Dashboard operacional:
  - Visao geral de usuarios, pets, alertas e itens pendentes.

- Analytics:
  - Indicadores de engajamento, crescimento, destaque de usuarios/posts e tendencias.

- Gestao de usuarios:
  - Alteracao de role.
  - Bloqueio/desbloqueio.
  - Exclusao em cenarios de suporte/moderacao.

- Gestao de pets e petshops:
  - Visibilidade global de cadastro e qualidade de base.

- Pets perdidos:
  - Aprovar/rejeitar alertas.
  - Escalar alcance do alerta por niveis de raio.

- Moderacao de chat:
  - Aprovar/rejeitar mensagens pendentes para maior seguranca.

- Mapa administrativo:
  - Gerenciar pontos (clinicas, ONGs, abrigos, parques, parceiros).
  - Acompanhar localizacoes e concentracoes por cidade/regiao.

- Notificacoes em massa:
  - Campanhas e alertas por filtros de perfil/regiao.

- Boosts manuais:
  - Dar destaque temporario para usuario/post por objetivo de crescimento.

- Configuracoes e aparencia:
  - Parametros de negocio (raios, comportamento de alertas).
  - Ajustes de identidade visual e icones PWA.

## Impacto de negocio do admin
- Aumenta taxa de reencontro (operacao de alertas).
- Reduz risco de abuso (moderacao e governanca).
- Melhora retencao (curadoria, campanhas e ajustes rapidos).
- Sustenta escala com acompanhamento de metricas.

---

## 4) Tecnologias usadas

## Backend e arquitetura
- Node.js + Express.
- Arquitetura MVC com camada de servicos.
- Renderizacao server-side com EJS.
- Sessao com `express-session` e `connect-pg-simple`.
- Upload de arquivos com `multer`.
- Seguranca com `helmet`, rate limit e validacoes.
- Jobs internos de scheduler para automacoes.

## Banco de dados
- PostgreSQL como banco principal.
- PostGIS para funcionalidades geograficas (proximidade e mapa).
- Migrations executadas na inicializacao da aplicacao.

## Tempo real e notificacoes
- Socket.IO para chat e eventos em tempo real.
- Web Push para notificacoes em dispositivos.

## Frontend e PWA
- EJS + JavaScript no cliente.
- Tailwind CSS para estilo.
- Leaflet + OpenStreetMap para mapa.
- Service Worker e `manifest.json` dinamico para experiencia PWA.

## Bibliotecas relevantes (exemplos)
- `bcrypt`, `jsonwebtoken`, `express-validator`, `cookie-parser`, `method-override`, `morgan`, `pg`.

---

## 5) Como usar o sistema

## Guia rapido para tutor

1. Criar conta e entrar no sistema.
2. Cadastrar pet com foto e dados principais.
3. Vincular uma tag NFC ao pet.
4. Completar carteira de saude e, se quiser, diario.
5. Instalar o PWA no celular para acesso rapido.
6. Em caso de perda:
   - Abrir alerta de pet perdido.
   - Acompanhar mapa, notificacoes e mensagens.
   - Coordenar reencontro por chat.

## Guia rapido para quem encontrou um pet

1. Escanear a tag NFC.
2. Abrir a pagina publica do pet.
3. Enviar localizacao/foto e contato.
4. Conversar com o tutor pelo fluxo disponibilizado.

## Guia rapido para admin

1. Acessar rota admin e autenticar.
2. Abrir dashboard e validar pendencias.
3. Moderar mensagens e tratar alertas de pets perdidos.
4. Ajustar configuracoes de operacao (raios/regras).
5. Rodar campanhas por regiao quando necessario.
6. Usar analytics para priorizar acoes de crescimento e qualidade.

---

## 6) Escalabilidade: crescimento em blocos de 10k usuarios

Esta secao descreve uma trilha pratica para escalar sem ruptura.

## 0-10k usuarios (base solida)
- Garantir indices corretos no Postgres (incluindo geoespaciais).
- Revisar consultas pesadas e paginação em listagens.
- Fortalecer limites por rota (login, NFC, formulários publicos).
- Definir metricas minimas: latencia, erro, uso de CPU/memoria, filas de notificacao.

## 10k-50k usuarios (primeira escala horizontal)
- Separar processos: web/app, websocket e workers de jobs.
- Tirar jobs criticos do processo web e mover para worker dedicado.
- Introduzir Redis para cache e suporte a sessao distribuida.
- Configurar adapter Redis no Socket.IO para multiplas instancias.
- Mover uploads locais para objeto externo (S3/Blob) e servir via CDN.

## 50k-100k usuarios (escala orientada a throughput)
- Enfileirar notificacoes e tarefas pesadas (batch + retry + dead letter).
- Cachear analytics e consolidar relatorios em materialized views quando fizer sentido.
- Particionar tabelas de alto volume (ex.: localizacoes/scans) por janela de tempo.
- Implementar observabilidade completa (logs centralizados, metricas e alertas).
- Criar runbooks operacionais para incidentes e picos.

## 100k+ usuarios (maturidade operacional)
- Avaliar separar dominios em servicos (ex.: notificacoes, chat, analytics).
- Introduzir replicas de leitura no banco e estrategia de failover.
- Adotar testes de carga recorrentes e planejamento de capacidade trimestral.
- Formalizar SLO/SLA por jornada critica (login, scan NFC, envio de alerta, chat).

## Prioridades tecnicas imediatas (alto impacto)
- Worker de jobs + fila para notificacoes.
- Redis para sessao/cache/realtime.
- Storage externo para arquivos e CDN.
- Indices e tuning de consultas geograficas.
- Observabilidade com alertas proativos.

---

## 7) Resumo executivo (negocio)

O AIRPET e uma plataforma de protecao e reencontro de pets baseada em NFC, com valor direto para tutores e para a comunidade local. O produto combina seguranca (identificacao rapida), operacao (mapa, alerta, chat moderado) e engajamento (social, diario, saude), formando um ecossistema completo para o ciclo de vida do pet.

Do ponto de vista de crescimento, o sistema ja tem base funcional robusta e pode evoluir de forma incremental para volumes maiores. O caminho recomendado e: separar componentes criticos, adotar infraestrutura de cache/fila, fortalecer dados geograficos e elevar observabilidade. Com essa trilha, o AIRPET pode crescer em blocos de 10k usuarios mantendo desempenho, confiabilidade e qualidade da experiencia.

---

## Referencia rapida de modulos

- Publico: landing, NFC, mapa, petshops.
- Autenticado: pets, saude, diario, feed/explorar, agenda, perdidos, notificacoes, perfil.
- Admin: dashboard, analytics, moderacao, campanhas, configuracao, mapa administrativo.

Este documento e uma visao executiva e tecnica de operacao do produto para alinhamento de negocio, equipe e evolucao de arquitetura.
