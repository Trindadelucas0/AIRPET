# Inventario de Rotas AIRPET

Gerado automaticamente em: `2026-04-06T02:15:53.766Z`

Legenda de risco: **Alta** (auth/admin/dados sensiveis), **Media** (fluxos de negocio), **Baixa** (conteudo publico).

| Metodo | Caminho | Autenticacao | Tipo | Risco | Origem |
|---|---|---|---|---|---|
| `GET` | `/` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/` | Publica | HTML/SSR | Baixa | `src/routes/index.js` |
| `GET` | `/agenda` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/agendaRoutes.js` |
| `POST` | `/agenda` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/agendaRoutes.js` |
| `POST` | `/agenda/:id/cancelar` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/agendaRoutes.js` |
| `POST` | `/agenda/:id/confirmar` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/agendaRoutes.js` |
| `GET` | `/alerta/:alertaId` | Publica | HTML/SSR | Baixa | `src/routes/index.js` |
| `GET` | `/analytics` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/aparencia` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/aparencia` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/api/internal/cloudflare-queue` | Publica | JSON/API | Media | `src/routes/internalWebhooks.js` |
| `POST` | `/api/localizacao` | Sessao obrigatoria | JSON/API | Media | `src/routes/localizacaoRoutes.js` |
| `GET` | `/api/localizacao/:pet_id` | Sessao obrigatoria | JSON/API | Media | `src/routes/localizacaoRoutes.js` |
| `GET` | `/api/monitoramento` | Admin | JSON/API | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/api/pets/:id/alerta-ativo` | Sessao obrigatoria | JSON/API | Media | `src/routes/index.js` |
| `GET` | `/api/petshops/mapa` | Publica | JSON/API | Media | `src/routes/index.js` |
| `GET` | `/api/racas` | Publica | JSON/API | Media | `src/routes/index.js` |
| `POST` | `/api/v1/auth/mobile-login` | API token/sessao | JSON/API | Alta | `src/routes/syncApiRoutes.js` |
| `POST` | `/api/v1/auth/mobile-logout` | API token/sessao | JSON/API | Alta | `src/routes/syncApiRoutes.js` |
| `POST` | `/api/v1/auth/refresh` | API token/sessao | JSON/API | Alta | `src/routes/syncApiRoutes.js` |
| `GET` | `/api/v1/me` | API token/sessao | JSON/API | Alta | `src/routes/syncApiRoutes.js` |
| `PATCH` | `/api/v1/me` | API token/sessao | JSON/API | Alta | `src/routes/syncApiRoutes.js` |
| `GET` | `/api/v1/me/following` | API token/sessao | JSON/API | Alta | `src/routes/syncApiRoutes.js` |
| `GET` | `/api/v1/me/preferences` | API token/sessao | JSON/API | Alta | `src/routes/syncApiRoutes.js` |
| `GET` | `/auth/esqueci-senha` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `POST` | `/auth/esqueci-senha` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `GET` | `/auth/login` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `POST` | `/auth/login` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `GET` | `/auth/logout` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `GET` | `/auth/redefinir-senha/:token` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `POST` | `/auth/redefinir-senha/:token` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `GET` | `/auth/registro` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `POST` | `/auth/registro` | Publica | HTML/SSR | Alta | `src/routes/authRoutes.js` |
| `GET` | `/boosts` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/boosts` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/boosts/:id/cancelar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/boosts/buscar-pets` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/boosts/buscar-usuarios` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/chat` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/chatRoutes.js` |
| `GET` | `/chat/:conversaId` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/chatRoutes.js` |
| `POST` | `/chat/:conversaId/enviar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/chatRoutes.js` |
| `POST` | `/chat/iniciar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/chatRoutes.js` |
| `GET` | `/chat/novo/:pet_id` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/chatRoutes.js` |
| `POST` | `/chat/publico/enviar` | Publica | HTML/SSR | Alta | `src/routes/chatRoutes.js` |
| `POST` | `/chat/publico/iniciar-ou-enviar` | Publica | HTML/SSR | Alta | `src/routes/chatRoutes.js` |
| `GET` | `/configuracoes` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/configuracoes` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/explorar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/api/interactions/view` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/api/pets` | Sessao obrigatoria | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/api/usuarios` | Sessao obrigatoria | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/api/v2/feed` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/api/v2/me/tagged-posts` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/api/v2/me/tagged-posts/pending` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/api/v2/posts` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/api/v2/posts/:id/comments` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/api/v2/posts/:id/tags/respond` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/api/v2/users/search` | API token/sessao | JSON/API | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/busca` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/comentario/:id` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/perfil/:id` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/perfil/:id/seguidores` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/perfil/:id/seguindo` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/pet/:id` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/pet/:id/capa` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/pet/:id/petshops/:petshopId` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/pet/:id/seguidor/:usuarioId` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/pet/:id/seguidores` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/pet/:id/seguindo` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/pet/:id/seguir` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/pet/:id/seguir` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/petshops-post/:id/comentar` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/petshops-post/:id/comentarios` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/petshops-post/:id/curtir` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/petshops-post/:id/curtir` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/post` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/post/:id` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/post/:id/comentar` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/post/:id/comentarios` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/post/:id/curtir` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/post/:id/curtir` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/post/:id/fixar` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/post/:id/fixar` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/explorar/post/:id/pets-proximos` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/post/:id/repost` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `DELETE` | `/explorar/seguir/:id` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `POST` | `/explorar/seguir/:id` | API token/sessao | HTML/SSR | Alta | `src/routes/explorarRoutes.js` |
| `GET` | `/feed` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/index.js` |
| `GET` | `/gerenciar-mapa` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/health/db` | Publica | HTML/SSR | Media | `src/routes/app.js` |
| `GET` | `/login` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/login` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/logout` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/manifest.json` | Publica | HTML/SSR | Baixa | `src/routes/app.js` |
| `GET` | `/mapa` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/mapa` | Publica | HTML/SSR | Baixa | `src/routes/mapaRoutes.js` |
| `GET` | `/mapa/api/pins` | Publica | JSON/API | Media | `src/routes/mapaRoutes.js` |
| `GET` | `/moderacao` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/moderacao/:id/aprovar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/moderacao/:id/rejeitar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/monitoramento` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/notificacoes` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/notificacaoRoutes.js` |
| `POST` | `/notificacoes/:id/lida` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/notificacaoRoutes.js` |
| `GET` | `/notificacoes/api/count` | Sessao obrigatoria | JSON/API | Media | `src/routes/notificacaoRoutes.js` |
| `GET` | `/notificacoes/enviar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/notificacoes/enviar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/notificacoes/enviar/preview` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/notificacoes/marcar-todas-lidas` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/notificacaoRoutes.js` |
| `POST` | `/notificacoes/push/subscribe` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/notificacaoRoutes.js` |
| `POST` | `/notificacoes/push/unsubscribe` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/notificacaoRoutes.js` |
| `GET` | `/parceiros/cadastro` | Publica | HTML/SSR | Baixa | `src/routes/partnerRoutes.js` |
| `POST` | `/parceiros/cadastro` | Publica | HTML/SSR | Baixa | `src/routes/partnerRoutes.js` |
| `GET` | `/parceiros/status/:id` | Publica | HTML/SSR | Baixa | `src/routes/partnerRoutes.js` |
| `POST` | `/perdidos/:id/resolver` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/petPerdidoRoutes.js` |
| `GET` | `/perdidos/:pet_id/confirmacao` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/petPerdidoRoutes.js` |
| `GET` | `/perdidos/:pet_id/encontrado` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/petPerdidoRoutes.js` |
| `POST` | `/perdidos/:pet_id/encontrado` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/petPerdidoRoutes.js` |
| `GET` | `/perdidos/:pet_id/formulario` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/petPerdidoRoutes.js` |
| `POST` | `/perdidos/:pet_id/reportar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/petPerdidoRoutes.js` |
| `GET` | `/perfil` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/index.js` |
| `PUT` | `/perfil` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/index.js` |
| `GET` | `/perfil/aparencia` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/index.js` |
| `GET` | `/perfil/conta` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/index.js` |
| `GET` | `/perfil/localizacao` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/index.js` |
| `GET` | `/perfil/seguranca` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/index.js` |
| `GET` | `/pets` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/pets` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `GET` | `/pets-perdidos` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/pets-perdidos/:id/aprovar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/pets-perdidos/:id/escalar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/pets-perdidos/:id/rejeitar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/pets/:id` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `PUT` | `/pets/:id` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `GET` | `/pets/:id/editar` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `POST` | `/pets/:id/editar` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `GET` | `/pets/:id/saude` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `GET` | `/pets/:id/vincular-tag` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `POST` | `/pets/:id/vincular-tag` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `GET` | `/pets/cadastro` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `POST` | `/pets/cadastro` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/petRoutes.js` |
| `POST` | `/petshop-panel/agenda` | Publica | HTML/SSR | Media | `src/routes/petshopPanelRoutes.js` |
| `POST` | `/petshop-panel/agenda/:id/status` | Publica | HTML/SSR | Media | `src/routes/petshopPanelRoutes.js` |
| `GET` | `/petshop-panel/auth/login` | Publica | HTML/SSR | Alta | `src/routes/petshopPanelRoutes.js` |
| `POST` | `/petshop-panel/auth/login` | Publica | HTML/SSR | Alta | `src/routes/petshopPanelRoutes.js` |
| `GET` | `/petshop-panel/auth/logout` | Publica | HTML/SSR | Alta | `src/routes/petshopPanelRoutes.js` |
| `GET` | `/petshop-panel/dashboard` | Publica | HTML/SSR | Baixa | `src/routes/petshopPanelRoutes.js` |
| `POST` | `/petshop-panel/perfil` | Publica | HTML/SSR | Alta | `src/routes/petshopPanelRoutes.js` |
| `POST` | `/petshop-panel/posts` | Publica | HTML/SSR | Baixa | `src/routes/petshopPanelRoutes.js` |
| `POST` | `/petshop-panel/servicos` | Publica | HTML/SSR | Baixa | `src/routes/petshopPanelRoutes.js` |
| `GET` | `/petshop-panel/vinculos/solicitacoes` | Publica | HTML/SSR | Baixa | `src/routes/petshopPanelRoutes.js` |
| `POST` | `/petshop-panel/vinculos/solicitacoes/:id/aprovar` | Publica | HTML/SSR | Baixa | `src/routes/petshopPanelRoutes.js` |
| `POST` | `/petshop-panel/vinculos/solicitacoes/:id/recusar` | Publica | HTML/SSR | Baixa | `src/routes/petshopPanelRoutes.js` |
| `GET` | `/petshops` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/petshops` | Publica | HTML/SSR | Media | `src/routes/petshopRoutes.js` |
| `GET` | `/petshops/:id` | Publica | HTML/SSR | Media | `src/routes/petshopRoutes.js` |
| `POST` | `/petshops/:id/aprovar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/petshops/:id/avaliar` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/petshopRoutes.js` |
| `POST` | `/petshops/:id/em-analise` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/petshops/:id/excluir` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/petshops/:id/rejeitar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/petshops/:id/seguir` | Sessao obrigatoria | HTML/SSR | Media | `src/routes/petshopRoutes.js` |
| `POST` | `/petshops/:id/seguir-json` | API token/sessao | HTML/SSR | Media | `src/routes/petshopRoutes.js` |
| `POST` | `/petshops/:id/solicitar-vinculo` | API token/sessao | HTML/SSR | Media | `src/routes/petshopRoutes.js` |
| `POST` | `/petshops/:id/suporte` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/petshops/api/mapa` | Publica | JSON/API | Media | `src/routes/petshopRoutes.js` |
| `GET` | `/petshops/mapa` | Publica | HTML/SSR | Media | `src/routes/petshopRoutes.js` |
| `POST` | `/petshops/promocoes/:id/aprovar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/petshops/promocoes/:id/rejeitar` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/petshops/solicitacoes` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/pontos-mapa` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `DELETE` | `/pontos-mapa/:id` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `PUT` | `/pontos-mapa/:id` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/pontos-mapa/:id/toggle` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `GET` | `/privacidade` | Publica | HTML/SSR | Baixa | `src/routes/index.js` |
| `POST` | `/saude/:pet_id/registros` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/saudeRoutes.js` |
| `POST` | `/saude/:pet_id/vacinas` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/saudeRoutes.js` |
| `DELETE` | `/saude/registros/:id` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/saudeRoutes.js` |
| `DELETE` | `/saude/vacinas/:id` | Sessao obrigatoria | HTML/SSR | Baixa | `src/routes/saudeRoutes.js` |
| `GET` | `/t/:tag_code` | Publica | HTML/SSR | Baixa | `src/routes/nfcRoutes.js` |
| `GET` | `/t/:tag_code/encontrei` | Publica | HTML/SSR | Baixa | `src/routes/nfcRoutes.js` |
| `POST` | `/t/:tag_code/encontrei` | Publica | HTML/SSR | Baixa | `src/routes/nfcRoutes.js` |
| `GET` | `/t/:tag_code/enviar-foto` | Publica | HTML/SSR | Baixa | `src/routes/nfcRoutes.js` |
| `POST` | `/t/:tag_code/enviar-foto` | Publica | HTML/SSR | Baixa | `src/routes/nfcRoutes.js` |
| `POST` | `/t/:tag_code/localizacao` | Publica | HTML/SSR | Baixa | `src/routes/nfcRoutes.js` |
| `GET` | `/tags/:tag_code/ativar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/:tag_code/ativar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/:tag_code/chegou` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `GET` | `/tags/:tag_code/escolher-pet` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/:tag_code/vincular-pet` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/admin/:id/bloquear` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/admin/:id/desbloquear` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/admin/:id/enviar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/admin/:id/reservar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `POST` | `/tags/admin/gerar` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `GET` | `/tags/admin/lista` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `GET` | `/tags/admin/lote/:id` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `GET` | `/tags/admin/lotes` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `GET` | `/tags/minhas` | Sessao obrigatoria | HTML/SSR | Alta | `src/routes/tagRoutes.js` |
| `GET` | `/termos` | Publica | HTML/SSR | Baixa | `src/routes/index.js` |
| `GET` | `/usuarios` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/usuarios/:id/bloquear` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/usuarios/:id/excluir` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |
| `POST` | `/usuarios/:id/role` | Admin | HTML/SSR | Alta | `src/routes/adminRoutes.js` |

## Observacoes

- O inventario e baseado em analise estatica de `router.METODO(...)`.
- Para confirmar comportamento real (redirect/flash/json), execute os roteiros em `docs/qa/` e `testes/`.
