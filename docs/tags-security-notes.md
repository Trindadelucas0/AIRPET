## Segurança da área de tags (`/tag/admin/*`)

- As rotas administrativas de tags estão definidas em `src/routes/tagRoutes.js` e usam, em todas as entradas, a combinação:
  - `estaAutenticado` (middleware de autenticação de usuário) **e**
  - `apenasAdmin` (middleware que exige sessão de admin válida, baseada em `req.session.admin`, configurada via login em `src/routes/adminRoutes.js`).

- Exemplo de rota:

```12:17:src/routes/tagRoutes.js
router.get('/admin/lista', estaAutenticado, apenasAdmin, tagController.listarTags);
router.get('/admin/lotes', estaAutenticado, apenasAdmin, tagController.listarLotes);
router.get('/admin/lote/:id', estaAutenticado, apenasAdmin, tagController.mostrarLote);
router.post('/admin/gerar', estaAutenticado, apenasAdmin, tagController.gerarLote);
router.post('/admin/:id/reservar', estaAutenticado, apenasAdmin, tagController.reservar);
router.post('/admin/:id/enviar', estaAutenticado, apenasAdmin, tagController.enviar);
router.post('/admin/:id/bloquear', estaAutenticado, apenasAdmin, tagController.bloquear);
```

- Com isso, a gestão de lotes e tags físicas só é acessível a:
  - Admin autenticado via `/admin/login` (e-mail/senha do admin),
  - dentro de uma sessão de usuário autenticado (`estaAutenticado`), garantindo que a área de tags é a parte mais protegida do sistema no momento.

## Ideia futura de autenticação extra (2º fator) só para tags

- **Motivação**: a área de tags controla o ativo mais sensível do sistema (lotes, reserva, envio, bloqueio de tags NFC).
- **Proposta de fluxo, sem implementação por enquanto**:
  1. Ao acessar qualquer rota `/tag/admin/*`, após o login admin normal, o sistema verifica se a sessão já passou pela \"verificação extra de tags\".
  2. Se não passou, redireciona para uma tela dedicada, por exemplo `/admin/tags-auth`, onde o admin informa:
     - Uma **senha extra** (segredo guardado fora do banco principal) **ou**
     - Um **código TOTP** (Google Authenticator / Authy) associado à conta admin.
  3. Após sucesso, a sessão recebe um flag (ex.: `req.session.tagsMFA = { ok: true, at: Date.now() }`) com validade limitada (por exemplo 30 minutos).
  4. Enquanto esse flag estiver válido, as rotas `/tag/admin/*` funcionam normalmente; ao expirar, o admin precisa refazer a verificação rápida.

- **Benefícios**:
  - Mesmo que a senha de admin vaze, a área de tags continua protegida por um segundo segredo.
  - O impacto de UX é pequeno, pois a verificação acontece apenas quando alguém entra especificamente na parte de tags e não no painel todo.


