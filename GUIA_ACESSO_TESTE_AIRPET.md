# Guia de Acesso e Teste do AIRPET

Este guia foi feito para apresentar o AIRPET para socios e equipe sem instalar app.

Ambiente publicado:
- Base URL: `https://airpet.seuregistroonline.com.br`
- Admin path: `/_painel_a1r`

---

## 1) Links diretos para acessar agora

### Publico (sem login)
- Home: `https://airpet.seuregistroonline.com.br/`
- Entrar: `https://airpet.seuregistroonline.com.br/auth/login`
- Criar conta: `https://airpet.seuregistroonline.com.br/auth/registro`
- Esqueci senha: `https://airpet.seuregistroonline.com.br/auth/esqueci-senha`
- Termos de uso: `https://airpet.seuregistroonline.com.br/termos`
- Politica de privacidade: `https://airpet.seuregistroonline.com.br/privacidade`
- Mapa (visual): `https://airpet.seuregistroonline.com.br/mapa`
- Parceiros (cadastro): `https://airpet.seuregistroonline.com.br/parceiros/cadastro`
- Petshops (listagem): `https://airpet.seuregistroonline.com.br/petshops`

### Usuario logado (tutor)
- Feed: `https://airpet.seuregistroonline.com.br/feed`
- Explorar: `https://airpet.seuregistroonline.com.br/explorar`
- Busca (explorar): `https://airpet.seuregistroonline.com.br/explorar/busca`
- Meus pets: `https://airpet.seuregistroonline.com.br/pets`
- Cadastrar pet: `https://airpet.seuregistroonline.com.br/pets/cadastro`
- Perfil: `https://airpet.seuregistroonline.com.br/perfil`
- Notificacoes: `https://airpet.seuregistroonline.com.br/notificacoes`
- Chat: `https://airpet.seuregistroonline.com.br/chat`
- Agenda: `https://airpet.seuregistroonline.com.br/agenda`

### Tag/NFC (quando alguem encontra o pet)
- Entrada por tag: `https://airpet.seuregistroonline.com.br/tag/{tag_code}`
- Alias curto da tag: `https://airpet.seuregistroonline.com.br/t/{tag_code}`
- Tela de "encontrei": `https://airpet.seuregistroonline.com.br/tag/{tag_code}/encontrei`
- Tela de enviar foto: `https://airpet.seuregistroonline.com.br/tag/{tag_code}/enviar-foto`

### Parceiro/Petshop
- Login do painel parceiro: `https://airpet.seuregistroonline.com.br/petshop-panel/auth/login`
- Dashboard parceiro: `https://airpet.seuregistroonline.com.br/petshop-panel/dashboard`

### Admin
- Login admin: `https://airpet.seuregistroonline.com.br/_painel_a1r/login`
- Dashboard admin: `https://airpet.seuregistroonline.com.br/_painel_a1r`

---

## 2) Rotas e funcoes por area

## A) Autenticacao e conta
- `GET /auth/login`: abre tela de login.
- `POST /auth/login`: autentica usuario comum.
- `GET /auth/registro`: abre tela de cadastro.
- `POST /auth/registro`: cria conta de tutor.
- `GET /auth/esqueci-senha`: abre recuperacao de senha.
- `POST /auth/esqueci-senha`: envia fluxo de recuperacao.
- `GET /auth/redefinir-senha/:token`: abre redefinicao com token.
- `POST /auth/redefinir-senha/:token`: confirma nova senha.
- `GET /auth/logout`: encerra sessao do usuario.

## B) Social e comunidade (tutor)
- `GET /feed`: feed dos perfis seguidos.
- `GET /explorar`: descoberta de perfis/pets/posts.
- `POST /explorar/post`: cria publicacao.
- `POST /explorar/post/:id/curtir`: curtir post.
- `DELETE /explorar/post/:id/curtir`: remover curtida.
- `GET /explorar/post/:id/comentarios`: listar comentarios do post.
- `POST /explorar/post/:id/comentar`: comentar post.
- `POST /explorar/seguir/:id`: seguir usuario.
- `DELETE /explorar/seguir/:id`: deixar de seguir usuario.
- `POST /explorar/pet/:id/seguir`: seguir pet.
- `DELETE /explorar/pet/:id/seguir`: deixar de seguir pet.
- `GET /chat`: lista conversas.
- `POST /chat/iniciar`: inicia conversa.
- `GET /chat/:conversaId`: abre conversa.

## C) Pets, saude, diario e alertas
- `GET /pets`: lista pets do tutor.
- `GET /pets/cadastro`: abre formulario de cadastro de pet.
- `POST /pets/cadastro`: cria pet (com foto).
- `GET /pets/:id`: abre perfil do pet.
- `GET /pets/:id/editar`: abre edicao do pet.
- `POST /pets/:id/editar` ou `PUT /pets/:id`: salva edicao do pet.
- `GET /pets/:id/vincular-tag`: abre tela de vincular tag.
- `POST /pets/:id/vincular-tag`: conclui vinculo da tag no pet.
- `GET /pets/:id/saude`: exibe pagina de saude.
- `POST /saude/:pet_id/vacinas`: adiciona vacina.
- `DELETE /saude/vacinas/:id`: remove vacina.
- `POST /saude/:pet_id/registros`: adiciona registro de saude.
- `DELETE /saude/registros/:id`: remove registro de saude.
- `GET /diario/:pet_id`: mostra diario do pet.
- `POST /diario/:pet_id`: cria entrada no diario.
- `DELETE /diario/:id`: remove entrada do diario.
- `GET /perdidos/:pet_id/formulario`: abre alerta de pet perdido.
- `POST /perdidos/:pet_id/reportar`: reporta pet perdido.
- `POST /perdidos/:pet_id/encontrado`: marca pet como encontrado.

## D) Tag/NFC (fluxo de reencontro)
- `GET /tag/:tag_code` (ou `/t/:tag_code`): pagina publica de ajuda ao pet.
- `POST /tag/:tag_code/localizacao`: envia localizacao para o tutor.
- `GET /tag/:tag_code/encontrei`: abre formulario de "encontrei este pet".
- `POST /tag/:tag_code/encontrei`: registra encontro (com opcao de foto).
- `GET /tag/:tag_code/enviar-foto`: abre pagina de envio de foto.
- `POST /tag/:tag_code/enviar-foto`: envia foto adicional ao tutor.

## E) Parceiros/Petshops
- `GET /parceiros/cadastro`: abre formulario de parceiro.
- `POST /parceiros/cadastro`: envia solicitacao de parceria.
- `GET /parceiros/status/:id`: consulta status da solicitacao.
- `GET /petshops`: lista petshops ativos.
- `GET /petshops/:id`: detalhes do petshop.
- `POST /petshops/:id/seguir`: seguir petshop.
- `POST /petshops/:id/avaliar`: avaliar petshop.
- `GET /petshop-panel/auth/login`: login do painel parceiro.
- `POST /petshop-panel/auth/login`: autentica parceiro.
- `GET /petshop-panel/dashboard`: painel de operacao do parceiro.
- `POST /petshop-panel/perfil`: atualiza perfil do petshop.
- `POST /petshop-panel/servicos`: cadastra servicos.
- `POST /petshop-panel/agenda`: cria agendamento.
- `POST /petshop-panel/agenda/:id/status`: atualiza status de agendamento.
- `POST /petshop-panel/posts`: publica post/promo do parceiro.

## F) Admin (rota secreta)

Base admin configurada: `/_painel_a1r`

- `GET /_painel_a1r/login`: tela de login admin.
- `POST /_painel_a1r/login`: autentica admin.
- `GET /_painel_a1r`: dashboard principal.
- `GET /_painel_a1r/analytics`: indicadores avancados.
- `GET /_painel_a1r/usuarios`: gestao de usuarios.
- `GET /_painel_a1r/pets`: gestao de pets.
- `GET /_painel_a1r/petshops`: gestao de parceiros.
- `GET /_painel_a1r/petshops/solicitacoes`: fila de solicitacoes.
- `GET /_painel_a1r/pets-perdidos`: gestao de alertas de perdidos.
- `GET /_painel_a1r/moderacao`: moderacao de conteudo/chat.
- `GET /_painel_a1r/configuracoes`: ajustes gerais do sistema.
- `GET /_painel_a1r/aparencia`: identidade visual/PWA.
- `GET /_painel_a1r/gerenciar-mapa`: gestao de pontos do mapa.
- `GET /_painel_a1r/notificacoes/enviar`: envio de notificacoes por regiao.

---

## 3) Roteiro de demonstracao em 10 minutos

## Minuto 1 a 2: Abertura
1. Abrir `https://airpet.seuregistroonline.com.br/`.
2. Mostrar proposta: tag NFC + rede social + mapa + alertas.

## Minuto 2 a 4: Entrada do usuario
1. Mostrar `auth/registro` e `auth/login`.
2. Explicar que o uso completo acontece apos login.

## Minuto 4 a 6: Fluxo tutor
1. Ir em `/pets` e mostrar cadastro (`/pets/cadastro`).
2. Ir em `/feed` e `/explorar` para mostrar social.
3. Ir em `/notificacoes` para mostrar alertas.

## Minuto 6 a 7: Fluxo de pet perdido/tag
1. Explicar pagina publica da tag: `/tag/{tag_code}`.
2. Mostrar acoes: ligar/enviar localizacao/encontrei/enviar foto.

## Minuto 7 a 8: Fluxo parceiro
1. Mostrar `/parceiros/cadastro`.
2. Mostrar login do painel em `/petshop-panel/auth/login`.

## Minuto 8 a 10: Fluxo admin
1. Mostrar login admin em `/_painel_a1r/login`.
2. Mostrar dashboard e menus de operacao.
3. Encerrar com ganho operacional: seguranca, moderacao e controle.

---

## 4) Checklist rapido de validacao (navegador)

- Home carrega sem erro em `https://airpet.seuregistroonline.com.br/`.
- Login/cadastro de usuario comum abre corretamente.
- Apos login, `feed`, `explorar`, `pets`, `notificacoes` e `perfil` funcionam.
- Cadastro de parceiro abre e envia sem erro.
- Login do painel parceiro responde.
- Login do admin em `/_painel_a1r/login` responde.
- Dashboard admin abre apos autenticar.
- Rota de tag (`/tag/{tag_code}`) abre ao menos para uma tag valida.

---

## 5) Observacoes de seguranca para compartilhar

- Nao enviar usuario/senha admin em documentos abertos.
- Compartilhar apenas o link admin e mandar credenciais em canal privado.
- Para demos com terceiros, prefira conta de teste sem dados reais.
