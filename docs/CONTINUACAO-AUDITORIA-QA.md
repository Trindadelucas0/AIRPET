# Continuação da auditoria QA/UX — o que já foi feito e o que falta

Documento para retomar o trabalho depois. Baseado no plano de auditoria e no estado do repositório após a última sessão.

---

## 1. Já concluído (Sprint 1 — correções rápidas)

| Item | Descrição | Arquivos principais |
|------|-----------|---------------------|
| Reset de senha | Removido `<input hidden name="token">` que quebrava a whitelist do validator | `src/views/auth/redefinir-senha.ejs` |
| Lembrar de mim | Whitelist + cookie JWT + `maxAge` da sessão alinhados; JWT `7d` / `30d` conforme checkbox | `src/middlewares/validator.js`, `src/controllers/authController.js`, `src/services/authService.js` |
| Preferências notif (form) | Removido `_method=PUT` que virava `Cannot PUT` | `src/views/notificacoes/configurar.ejs` |
| Toggles 48h/2h | Regex do `toggleSwitch` corrigida para IDs `valNotif48h` / `valNotif2h` | `src/views/notificacoes/configurar.ejs` |
| Wizard pet perdido | `</motion>` trocado por `</div>` | `src/views/pets-perdidos/formulario.ejs` |
| Referral `?ref=` | CTAs da landing propagam `ref` para `/lista-espera?ref=` | `src/views/validacao/proteger-meu-pet.ejs`, `proteger-meu-pet-legacy.ejs`, `src/controllers/validacaoController.js` |
| Perfil público `/p/:slug` | JS de seguir + modal de seguidores + atualização do contador | `src/views/perfil-pet/index.ejs` |
| Home stats | Label “Parceiros” → “Locais no mapa” (alinhado a `PontoMapa`) | `src/views/home.ejs` |
| Validator debug | Removido `fetch` para localhost em falhas de validação | `src/middlewares/validator.js` |
| Rate limit reset | `limiterAuth` no `POST /auth/redefinir-senha/:token` | `src/routes/authRoutes.js` |

**Migrations:** `referral_code` já estava aplicada no ambiente local; as migrations `1776400000000`, `1776500000000`, `1776600000000` foram adicionadas e aplicadas (ver secção 2).

---

## 2. Sprint 2 — parcialmente feito (confiabilidade)

### 2.1 Implementado nesta fase

| Área | O quê |
|------|--------|
| Reset de senha persistente | Tabela `password_reset_tokens`, model `PasswordResetToken`, `authController` usa BD em vez de `Map` em RAM |
| Verificação de e-mail | Tabela `email_verifications`, coluna `usuarios.email_verificado_em`, model `EmailVerification`, `emitirEmailVerificacao`, `GET /auth/verificar-email/:token`, `POST /auth/reenviar-verificacao`, cadastro dispara e-mail em `setImmediate` |
| Preferências de notificação | Tabela `notif_preferencias`, model `NotifPreferencia`, `notificacaoController` lê/grava BD, view `configurar.ejs` inicializada com `prefs` |

**Arquivos-chave:**  
`migrations/1776400000000_password_reset_tokens.mjs`, `1776500000000_notif_preferencias.mjs`, `1776600000000_email_verifications.mjs`  
`src/models/PasswordResetToken.js`, `EmailVerification.js`, `NotifPreferencia.js`  
`src/controllers/authController.js`, `notificacaoController.js`, `src/models/Usuario.js` (`marcarEmailVerificado`)

### 2.2 Pendências técnicas imediatas (revisar antes de considerar Sprint 2 “fechado”)

1. **`POST /auth/reenviar-verificacao`**
   - Não usa `camposPermitidos` / `express-validator` para `email` opcional.
   - **Sugestão:** whitelist `['email']` + validação de e-mail quando anônimo; manter resposta neutra.

2. **UI de verificação de e-mail**
   - Falta link/botão “Não recebi o e-mail” nas telas `login.ejs` / `registro.ejs` / flash pós-cadastro apontando para `POST /auth/reenviar-verificacao` (com CSRF se o projeto usar token em forms — verificar padrão do projeto).

3. **`receber_alertas_pet_perdido` em `notif_preferencias`**
   - Coluna existe na migration e no `INSERT` do model, mas **a tela `configurar.ejs` não expõe** esse toggle (continua só no perfil/localização no plano original).
   - **Sugestão:** ou adicionar linha na UI de notificações, ou documentar que o valor vem só do perfil e remover da tabela para evitar duplicidade.

4. **Consumidores das preferências**
   - `schedulerService` / jobs de ração, peso, agenda, resumo semanal e “horário quieto” **provavelmente ainda não leem** `notif_preferencias`.
   - **Sugestão:** grep por `notifPrefs`, `session.notifPrefs` e substituir por `NotifPreferencia.buscarParaUsuario` (global + override por `pet_id`).

5. **Produção / deploy**
   - Garantir `npm run db:migrate` em **todos** os ambientes com as três migrations novas.
   - `RESEND_API_KEY` obrigatório para e-mails reais; sem key o fluxo continua “silencioso” (só log).

6. **`verificarEmail` + `invalidarPendentesDoUsuario`**
   - Após `marcarComoUsado(token)`, chamar `invalidarPendentesDoUsuario` marca **todos** os pendentes (redundante com o token atual já usado). Não é bug grave; pode simplificar.

---

## 3. Sprint 2 — itens ainda não implementados (lista detalhada)

### 3.1 Perfil / segurança / conta

| ID | Tarefa | Detalhe |
|----|--------|---------|
| S2-4 | Trocar senha **logado** | Hoje `seguranca.ejs` só manda para “Esqueci minha senha”. Implementar fluxo autenticado: senha atual + nova + confirmar, rota `PUT/POST` protegida, `bcrypt`, invalidar sessões opcional. |
| S2-5 | Toggle **receber alertas pet perdido** na UI | Backend já aceita em `perfilController` / `validator` (`receber_alertas_pet_perdido`). Falta checkbox em `src/views/perfil/localizacao.ejs` (ou hub) com texto LGPD claro. |
| S2-6 | Exclusão de conta | `hub.ejs` diz “indisponível”. Definir: fluxo manual (mailto + assunto) ou página com confirmação + soft-delete/anônimo. |

### 3.2 NFC / notificações / produto

| ID | Tarefa | Detalhe |
|----|--------|---------|
| S2-7 | Scan NFC sem “multicanal” | Em `nfcService.js`, scan básico pode só criar notificação in-app; push/e-mail em plano específico. **Opções:** (A) push mínimo para todos; (B) copy honesta na `intermediaria.ejs` para o achador (“o tutor pode demorar a ver”). |

### 3.3 Chat

| ID | Tarefa | Detalhe |
|----|--------|---------|
| S2-8 | Histórico vs moderação | `MensagemChat` filtra só `aprovada`; socket mostra na hora. Incluir mensagens **próprias** com estado “em moderação” no `SELECT`, ou fila visual consistente. |
| S2-9 | Bloquear / denunciar | Não existe na UI do chat. Botões + endpoint + modelo ou integração com moderação existente. |

### 3.4 Funil / leads

| ID | Tarefa | Detalhe |
|----|--------|---------|
| S2-10 | Dois endpoints de lead | `/api/proteger-meu-pet` (`ValidacaoInteresse`) vs `/api/lista-espera` (`ListaEspera`). Decidir deprecar um (410/redirect) ou unificar persistência + analytics. |

---

## 4. Sprint 3 — coerência de produto (exige decisão de PM)

**Decisão crítica:** o feed (`/feed`) usa grafo **pet/petshop** (`feedSeguindoPets`), mas a UI incentiva “seguir **pessoas**” na sidebar (`/explorar/seguir/:id`). É preciso **unificar semântica** ou **mudar copy/UI** antes de refatorar queries.

| Tarefa | Referência técnica |
|--------|-------------------|
| Alinhar feed web vs `GET /explorar/api/v2/feed` | `src/models/Publicacao.js` — `feedSeguindoPets` vs `feedPorCursor` |
| Links dentro do card do feed não navegam | `feed.ejs` / `explorar.ejs` — `preventDefault` em `a[href]` dentro do `article` |
| “Novo post” `?compose=1&pet_id=` | `perfil-pet/index.ejs` → `feed.ejs` + `explorarController.feedSeguidos` — implementar leitura da query e abrir composer |
| Wizard cadastro pet | `pets/cadastro.ejs` — integrar `AirpetWizard` ou remover falsa promessa de wizard |
| Tipo “outro” + `tipo_custom` | `petController.js` + view cadastro |
| Autocomplete raça | `GET /api/racas` já existe — ligar no cadastro |
| `/pets/:id` painel dono | Grid de posts + link “Ver perfil público” `/p/:slug` |
| Explorar só mídia | Posts só texto sumidos — tile ou secção “Discussões” |
| Like otimista no feed | `feed.ejs` |
| Alerta público pet perdido | `alerta-publico.ejs` — WhatsApp / share API |
| Mapa | Filtros + CTA “reportar avistamento” (se produto quiser) |
| Hashtag “Ver no feed” | `hashtag.ejs` aponta `/explorar#post-` vs hábito `/feed` |
| Notificações | Menos modal-only em `lista.ejs` |

---

## 5. Sprint 4 — polimento

- Skip-link acessível no `header.ejs`
- `pwa.js` — substituir `confirm()` nativo por banner custom
- Badge de notificações no bottom-nav mobile (`nav.ejs`)
- Telefone do tutor mascarado no scan NFC (`intermediaria.ejs`) — fluxo mediado
- Copy “marcar perdido” vs comportamento real (`petController.js`)
- Revisão pt-BR / microcópia
- Alinhar limite upload edição (10 MB / HEIC) vs `petRoutes.js` multer (5 MB, formatos)
- Stats home — prefixo `+` na animação (`home.ejs`)
- `limite-usuarios.ejs` — copy “região” vs `MAX_USUARIOS` global

---

## 6. Testes e qualidade

- Rodar `npm test` após cada bloco (já passou na última alteração conhecida).
- Adicionar testes específicos (opcional): criação/uso de `password_reset_tokens`, `email_verifications`, upsert `notif_preferencias`.
- `npm run lint` nos controllers/services alterados.

---

## 7. Ordem sugerida para a próxima sessão

1. Validar migrations em staging/prod + `RESEND_API_KEY`.
2. UI “reenviar verificação” + validação do `POST /auth/reenviar-verificacao`.
3. Wire **jobs/notificações** → `NotifPreferencia` (senão a tela “salva” mas o sistema ignora).
4. `S2-4` → `S2-5` → `S2-6` (perfil/conta).
5. `S2-7` (copy ou push).
6. Chat `S2-8` + `S2-9`.
7. `S2-10` (deprecar lead duplicado).
8. Pausar para **decisão de produto** e então Sprint 3.

---

## 8. Arquivos tocados recentemente (grep rápido)

```
src/controllers/authController.js
src/controllers/notificacaoController.js
src/controllers/validacaoController.js
src/middlewares/validator.js
src/models/PasswordResetToken.js
src/models/EmailVerification.js
src/models/NotifPreferencia.js
src/models/Usuario.js
src/routes/authRoutes.js
src/services/authService.js
src/views/auth/redefinir-senha.ejs
src/views/home.ejs
src/views/notificacoes/configurar.ejs
src/views/perfil-pet/index.ejs
src/views/pets-perdidos/formulario.ejs
src/views/validacao/proteger-meu-pet.ejs
src/views/validacao/proteger-meu-pet-legacy.ejs
migrations/1776400000000_password_reset_tokens.mjs
migrations/1776500000000_notif_preferencias.mjs
migrations/1776600000000_email_verifications.mjs
```

---

*Última atualização: gerado para continuidade da auditoria QA/UX do AIRPET.*
