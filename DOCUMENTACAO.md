# AIRPET — Documentacao Completa do Sistema

## Indice Geral

### Parte 1 — Visao Geral
1. [O que e o AIRPET](#1-o-que-e-o-airpet)
2. [Principais funcionalidades](#2-principais-funcionalidades)
3. [Tecnologias utilizadas](#3-tecnologias-utilizadas)

### Parte 2 — Guia do Usuario
4. [Criar conta e fazer login](#4-criar-conta-e-fazer-login)
5. [Cadastrar um pet](#5-cadastrar-um-pet)
6. [Perfil do pet](#6-perfil-do-pet)
7. [Carteira de saude](#7-carteira-de-saude)
8. [Diario do pet](#8-diario-do-pet)
9. [Tags NFC](#9-tags-nfc)
10. [Reportar pet perdido](#10-reportar-pet-perdido)
11. [Feed social — Explorar](#11-feed-social--explorar)
12. [Mapa interativo](#12-mapa-interativo)
13. [Chat](#13-chat)
14. [Agendamentos](#14-agendamentos)
15. [Notificacoes](#15-notificacoes)
16. [Perfil do usuario](#16-perfil-do-usuario)
17. [Instalar como aplicativo — PWA](#17-instalar-como-aplicativo--pwa)

### Parte 3 — Guia do Administrador
18. [Acessar o painel admin](#18-acessar-o-painel-admin)
19. [Dashboard](#19-dashboard)
20. [Gerenciar usuarios](#20-gerenciar-usuarios)
21. [Gerenciar pets](#21-gerenciar-pets)
22. [Gerenciar petshops](#22-gerenciar-petshops)
23. [Aprovar e rejeitar pets perdidos](#23-aprovar-e-rejeitar-pets-perdidos)
24. [Moderar mensagens do chat](#24-moderar-mensagens-do-chat)
25. [Gerenciar tags NFC](#25-gerenciar-tags-nfc)
26. [Gerenciar pontos no mapa](#26-gerenciar-pontos-no-mapa)
27. [Configuracoes do sistema](#27-configuracoes-do-sistema)

### Parte 4 — Documentacao Tecnica (Programadores)
28. [Arquitetura do sistema](#28-arquitetura-do-sistema)
29. [Estrutura de pastas](#29-estrutura-de-pastas)
30. [Como instalar e rodar](#30-como-instalar-e-rodar)
31. [Banco de dados](#31-banco-de-dados)
32. [Rotas e endpoints](#32-rotas-e-endpoints)
33. [Controllers](#33-controllers)
34. [Models](#34-models)
35. [Services](#35-services)
36. [Middlewares](#36-middlewares)
37. [WebSockets — tempo real](#37-websockets--tempo-real)
38. [Upload de arquivos](#38-upload-de-arquivos)
39. [Scheduler — jobs automaticos](#39-scheduler--jobs-automaticos)
40. [Seguranca](#40-seguranca)
41. [PWA e Service Worker](#41-pwa-e-service-worker)

### Parte 5 — Referencia Rapida
42. [Tabela de referencia rapida](#42-tabela-de-referencia-rapida)

---

# PARTE 1 — VISAO GERAL

---

## 1. O que e o AIRPET

O AIRPET e um sistema de **identificacao e recuperacao de pets** usando tags NFC. Funciona como uma plataforma web completa (PWA) que conecta tutores, comunidade e servicos de apoio animal.

**O conceito central:**
- Cada pet recebe uma **tag NFC** na coleira
- Se o pet se perder, qualquer pessoa pode encostar o celular na tag
- Uma pagina abre automaticamente com a **foto do pet**, **nome do dono** e **botoes para contato**
- O sistema registra a **localizacao GPS** de cada scan, criando um rastro de avistamentos
- Usuarios proximos ao ultimo avistamento recebem **alertas automaticos** via push notification

O sistema vai alem da tag NFC e oferece uma experiencia completa para tutores de pets:

- **Rede social de pets** — feed com publicacoes, curtidas, comentarios, reposts e seguidores
- **Carteira de saude digital** — vacinas, consultas e exames com lembretes automaticos
- **Diario do pet** — registro diario com fotos (alimentacao, passeio, humor, peso)
- **Mapa interativo** — petshops, clinicas, abrigos, pets perdidos e avistamentos
- **Chat moderado** — comunicacao segura entre quem encontrou o pet e o dono
- **Agendamentos** — agendar servicos em petshops parceiros
- **Escalamento automatico** — alertas de pets perdidos ampliam o raio de busca com o tempo
- **Dashboard administrativo** — gestao completa do sistema

---

## 2. Principais funcionalidades

### Para o tutor (usuario comum)

| Funcionalidade | Descricao |
|---|---|
| Cadastro de pets | Wizard de 8 passos com tipo, raca, aparencia, foto e descricao emocional |
| Perfil do pet | Idade calculada (humana), peso ideal por raca, calendario de cuidados |
| Carteira de saude | Vacinas com lembretes automaticos (7 dias antes), consultas, exames |
| Diario do pet | Registro diario com fotos (alimentacao, passeio, remedio, humor) |
| Tags NFC | Ativar tag, vincular ao pet, receber notificacao quando alguem escaneia |
| Pet perdido | Reportar desaparecimento com mapa, escalamento automatico por proximidade |
| Feed social | Publicar fotos, curtir, comentar, repostar, seguir outros usuarios |
| Perfil publico | Pagina publica com posts, pets e contagem de seguidores |
| Mapa interativo | Petshops, clinicas, abrigos, pets perdidos e avistamentos em tempo real |
| Chat moderado | Conversar com quem encontrou o pet (mensagens passam por moderacao) |
| Agendamentos | Agendar banho, tosa, consulta em petshops parceiros |
| Notificacoes | Alertas in-app, push no celular e em tempo real via WebSocket |
| PWA | Instalar no celular como aplicativo nativo |

### Para quem encontrou um pet (sem cadastro)

| Funcionalidade | Descricao |
|---|---|
| Scan NFC | Escanear a tag na coleira para ver os dados do pet e do dono |
| Contatar o dono | Ligar diretamente ou enviar mensagem pelo formulario |
| Enviar localizacao | GPS e enviado automaticamente ao dono |
| Enviar foto | Tirar foto do pet encontrado e enviar ao dono |
| Chat | Conversar com o dono via chat moderado |

### Para o administrador

| Funcionalidade | Descricao |
|---|---|
| Dashboard | Metricas em tempo real (usuarios, pets, alertas, tags, petshops) |
| Gerenciar usuarios | Listar, promover a admin ou rebaixar |
| Gerenciar pets | Visualizar todos os pets cadastrados |
| Gerenciar petshops | CRUD completo de petshops parceiros |
| Pets perdidos | Aprovar, rejeitar e escalar alertas manualmente |
| Moderacao do chat | Aprovar ou rejeitar mensagens antes de chegarem ao destinatario |
| Tags NFC | Gerar lotes, reservar para usuarios, enviar, bloquear |
| Pontos no mapa | Adicionar/editar clinicas, abrigos, ONGs, parques |
| Configuracoes | Raios de alerta, horas para escalamento automatico |

---

## 3. Tecnologias utilizadas

| Categoria | Tecnologia |
|---|---|
| Backend | Node.js + Express 5 |
| Banco de dados | PostgreSQL + PostGIS (queries geograficas) |
| Template engine | EJS (server-side rendering) |
| CSS | TailwindCSS 3 |
| Tempo real | Socket.IO (chat, notificacoes, admin) |
| Autenticacao | express-session + JWT (cookie httpOnly) |
| Hash de senhas | bcrypt (12 rounds) |
| Upload | multer (fotos de pets, diario, chat, posts) |
| Push | Web Push API (VAPID) |
| Mapas | Leaflet + MarkerCluster + OpenStreetMap |
| PWA | Service Worker + manifest.json + cache offline |
| Seguranca | helmet, express-rate-limit, express-validator |
| Icones | Font Awesome 6 |

---

# PARTE 2 — GUIA DO USUARIO

---

## 4. Criar conta e fazer login

### Criar uma conta

1. Acesse a pagina inicial do AIRPET
2. Clique em **"Registrar"** no menu superior (ou acesse `/auth/registro`)
3. Preencha os campos:
   - **Nome** (minimo 2 caracteres)
   - **Email** (sera usado para login)
   - **Telefone** (minimo 10 digitos, com DDD)
   - **Senha** (minimo 6 caracteres — um indicador de forca aparece enquanto voce digita)
4. Clique em **"Criar Conta"**
5. Voce sera redirecionado automaticamente para o feed social (Explorar)

### Fazer login

1. Acesse `/auth/login`
2. Informe seu **email** e **senha**
3. Clique em **"Entrar"**
4. Voce sera redirecionado para o feed social (Explorar)

### Esqueci minha senha

1. Na tela de login, clique em **"Esqueci minha senha"**
2. Informe o **email** da sua conta
3. Um link de recuperacao sera gerado (valido por 1 hora)
4. Acesse o link e defina uma **nova senha**
5. Faca login normalmente com a nova senha

### Sair da conta

Clique no botao de **logout** no menu. Sua sessao sera encerrada e os cookies removidos.

---

## 5. Cadastrar um pet

### Como cadastrar

1. Faca login na sua conta
2. Acesse **"Meus Pets"** no menu ou va para `/pets`
3. Clique em **"Cadastrar Pet"**
4. Siga o wizard de 8 passos:

| Passo | O que preencher |
|---|---|
| 1. Tipo | Cachorro, Gato, Passaro ou Outro (com campo personalizado) |
| 2. Raca | Selecione da lista com autocomplete (200+ racas cadastradas) ou digite manualmente |
| 3. Nome | Nome do seu pet |
| 4. Aparencia | Cor, porte (mini, pequeno, medio, grande, gigante) e sexo |
| 5. Nascimento | Data de nascimento (aproximada, se nao souber a exata) |
| 6. Peso | Peso atual em kg |
| 7. Foto | Envie uma foto do pet (formatos: jpg, png, gif, webp — maximo 5MB) |
| 8. Descricao | Descricao emocional do pet e telefone de contato alternativo |

5. Clique em **"Cadastrar"**
6. Voce vera uma tela de confirmacao com links para os proximos passos

### Editar um pet

1. Acesse **"Meus Pets"** → clique no pet desejado
2. Clique em **"Editar"**
3. Altere os campos desejados (incluindo a foto)
4. Clique em **"Salvar"**

### Tela "Meus Pets"

A tela exibe todos os seus pets em formato de cards, mostrando:
- Foto do pet
- Nome e tipo
- Status atual: **seguro** (verde) ou **perdido** (vermelho)
- Botoes rapidos: editar, saude, reportar perdido

Se voce ainda nao tem pets cadastrados, uma animacao aparece convidando voce a cadastrar o primeiro.

---

## 6. Perfil do pet

O perfil do pet (`/pets/:id`) e a pagina central com todas as informacoes sobre ele.

### O que voce encontra no perfil

**Informacoes basicas:**
- Foto, nome, tipo, raca, cor, porte, sexo
- Descricao emocional
- Status (seguro ou perdido)

**Contador de idade:**
- Exibe a idade em **anos, meses e dias**
- Calcula a **idade humana equivalente**:
  - Para caes: primeiro ano = 15 anos humanos, segundo = 9, depois 5 por ano
  - Para gatos: primeiro ano = 15, segundo = 9, depois 4 por ano

**Peso ideal:**
- Mostra o peso atual e o **peso ideal de referencia** para a raca/porte
- Classifica como: **abaixo do peso**, **peso ideal** ou **acima do peso**
- Referencia por porte: mini (1-4kg), pequeno (5-10kg), medio (11-25kg), grande (26-45kg), gigante (45-90kg)

**Calendario de cuidados:**
- Exibe os **proximos 5 eventos** agendados (vacinas e consultas futuras)
- Ordenado por data mais proxima

**Tags NFC vinculadas:**
- Lista de tags NFC ativas vinculadas ao pet
- Ultimas localizacoes registradas por scans NFC (com data, hora e local)

**Botoes de acao:**
- Editar pet
- Carteira de saude
- Diario do pet
- Reportar como perdido
- Compartilhar via WhatsApp (quando perdido)

---

## 7. Carteira de saude

A carteira de saude digital (`/pets/:id/saude`) centraliza todo o historico medico do pet.

### Vacinas

Para adicionar uma vacina:
1. Acesse o perfil do pet → clique em **"Saude"**
2. Na aba **"Vacinas"**, clique em **"Adicionar Vacina"**
3. Preencha:
   - **Nome da vacina** (ex: V10, Antirrabica, Gripe)
   - **Data da aplicacao**
   - **Data da proxima dose** (para reforcos)
   - **Veterinario** (opcional)
   - **Observacoes** (opcional)
4. Clique em **"Salvar"**

**Lembretes automaticos:** o sistema verifica automaticamente a cada 6 horas se alguma vacina esta vencendo nos proximos 7 dias. Se estiver, voce recebe uma notificacao push e in-app.

### Registros de saude

Para adicionar um registro:
1. Na aba **"Registros"**, clique em **"Adicionar Registro"**
2. Selecione o tipo:
   - Consulta
   - Exame
   - Cirurgia
   - Vermifugo
   - Antipulgas
   - Outro
3. Preencha descricao, data, veterinario e observacoes
4. Clique em **"Salvar"**

### Excluir registros

Clique no botao de lixeira ao lado do registro. Apenas o dono do pet pode excluir registros.

---

## 8. Diario do pet

O diario (`/diario/:pet_id`) permite registrar o dia a dia do pet com fotos e anotacoes.

### Como usar

1. Acesse o perfil do pet → clique em **"Diario"**
2. Clique em **"Adicionar Entrada"**
3. Preencha:
   - **Tipo**: alimentacao, passeio, remedio, necessidades, humor, peso, banho, brincar, veterinario, outro
   - **Descricao** (opcional)
   - **Valor numerico** (opcional — ex: peso em kg, quantidade de racao em gramas)
   - **Foto** (opcional — maximo 5MB)
4. Clique em **"Salvar"**

### Visualizacao

- O diario exibe as entradas de **hoje** em destaque
- Abaixo, mostra o **historico dos ultimos 30 dias**
- Cada entrada tem icone colorido de acordo com o tipo
- Fotos aparecem em miniatura ao lado da entrada

---

## 9. Tags NFC

As tags NFC sao o coracao do sistema AIRPET. Cada tag e um adesivo ou pingente com um chip NFC que pode ser lido por qualquer celular com NFC.

### Como funciona o ciclo de vida de uma tag

```
Fabricada (stock) → Reservada → Enviada → Ativada (active) → [Bloqueada]
```

1. **Stock**: a tag foi fabricada e esta no estoque
2. **Reservada**: foi separada para um usuario especifico
3. **Enviada**: foi despachada pelo correio ao usuario
4. **Ativa**: o usuario ativou e vinculou a um pet
5. **Bloqueada**: desativada por um administrador (ex: perda, roubo)

### Como ativar uma tag NFC

1. Voce recebera a tag com um **codigo de ativacao** impresso na embalagem (ex: `ABCD-EFGH`)
2. Escaneie a tag com o celular (encoste o celular no adesivo/pingente)
3. A pagina do AIRPET abrira automaticamente
4. Se voce **ja esta logado**, o formulario de ativacao aparecera
5. Se **nao esta logado**, faca login primeiro (sera redirecionado de volta)
6. Digite o **codigo de ativacao** da embalagem
7. Clique em **"Ativar"**
8. Escolha qual **pet vincular** a esta tag (da sua lista de pets)
9. Pronto! A tag esta ativa e vinculada ao seu pet

**Seguranca da ativacao (3 fatores):**
- Fator 1: posse fisica da tag (URL unica)
- Fator 2: estar logado na sua conta
- Fator 3: codigo de ativacao impresso (nao esta na tag)

### O que acontece quando alguem escaneia a tag

Quando qualquer pessoa escaneia a tag NFC de um pet:

1. O celular abre a **pagina intermediaria** do pet
2. A pagina exibe:
   - Foto do pet
   - Nome e tipo
   - Nome do dono
   - Telefone de contato
3. Se o pet **esta seguro**, a pessoa pode:
   - Ligar para o dono
   - Enviar uma mensagem pelo formulario "Encontrei este pet"
   - Enviar foto do pet
4. Se o pet **esta perdido**, a pagina mostra:
   - Banner vermelho "ESTE PET ESTA PERDIDO!"
   - Recompensa (se configurada)
   - Botao para iniciar conversa via chat
   - Botao para enviar localizacao GPS
   - Formulario completo para relatar o avistamento

**Auditoria:** todo scan e registrado com latitude, longitude, IP, navegador e horario.

O dono recebe uma **notificacao instantanea** sempre que a tag do pet e escaneada.

---

## 10. Reportar pet perdido

### Como reportar

1. Acesse o perfil do pet → clique em **"Reportar como Perdido"**
2. Preencha o formulario:
   - **Localizacao**: clique no mapa para marcar onde o pet foi visto pela ultima vez (ou use o campo de busca por endereco)
   - **Data e hora do desaparecimento**
   - **Cidade**
   - **Descricao** (detalhes como direcao que correu, se estava com coleira, etc.)
   - **Recompensa** (opcional)
3. Clique em **"Reportar"**
4. O alerta fica com status **"pendente"** ate ser aprovado por um administrador

### Como funciona o escalamento automatico

Apos a aprovacao pelo admin, o alerta passa por 3 niveis automaticos:

| Nivel | Quando | Raio de notificacao | O que acontece |
|---|---|---|---|
| Nivel 1 | Ao aprovar | ~1 km (configuravel) | Usuarios proximos sao notificados |
| Nivel 2 | Apos 6 horas | ~3 km (configuravel) | Raio de busca e ampliado, mais usuarios notificados |
| Nivel 3 | Apos 24 horas | ~15 km (configuravel) | Alerta maximo, raio amplo |

O escalamento acontece automaticamente a cada 30 minutos. O admin tambem pode escalar manualmente a qualquer momento.

### Marcar pet como encontrado

1. Acesse o perfil do pet → clique em **"Meu Pet Foi Encontrado"**
2. Confirme que o pet foi encontrado
3. O sistema:
   - Muda o status do pet para **"seguro"**
   - Resolve o alerta de pet perdido
   - Encerra todas as conversas abertas relacionadas
   - Limpa dados senssiveis das conversas (LGPD)
4. Uma tela de celebracao aparece confirmando que o pet esta de volta

---

## 11. Feed social — Explorar

O feed social (`/explorar`) e uma rede social de pets, similar ao Instagram/Twitter, onde tutores compartilham fotos e momentos dos seus pets.

### Navegacao do feed

O feed tem duas abas:
- **"Para Voce"**: mostra publicacoes de todos os usuarios, ordenadas por posts fixados e depois por data
- **"Seguindo"**: mostra apenas publicacoes de usuarios que voce segue

O feed carrega 20 publicacoes por vez, com scroll infinito para carregar mais.

### Criar uma publicacao

1. No topo do feed, clique na area de criacao de post
2. Escolha uma **foto** (obrigatoria, maximo 10MB, formatos: jpg, png, gif, webp)
3. Escreva uma **legenda** (opcional)
4. Vincule um **pet** da sua lista (opcional — aparece o nome do pet na publicacao)
5. Clique em **"Publicar"**

**Limite:** cada usuario pode ter no maximo **10 publicacoes ativas** ao mesmo tempo. Ao atingir o limite, a publicacao mais antiga nao fixada e removida automaticamente.

### Curtir

Clique no icone de coracao em qualquer publicacao. Clique novamente para descurtir. Uma animacao de coracao aparece ao curtir.

### Comentar

1. Clique no icone de comentario na publicacao
2. A secao de comentarios abre abaixo do post
3. Digite seu comentario
4. Clique em **"Enviar"**

Voce pode **mencionar outros usuarios** usando `@nome` no comentario.

Para deletar um comentario seu, clique no botao de lixeira ao lado dele.

### Repostar

Clique no icone de repost para compartilhar a publicacao de outro usuario no seu perfil. O post original e referenciado com credito ao autor.

### Fixar publicacao

Voce pode fixar ate **2 publicacoes** no topo do seu perfil:
1. Na sua publicacao, clique nas opcoes → **"Fixar"**
2. Para desafixar, clique em **"Desafixar"**

Publicacoes fixadas aparecem sempre no topo do feed "Para Voce" e do seu perfil.

### Seguir e deixar de seguir

- No perfil de outro usuario, clique em **"Seguir"** para acompanhar suas publicacoes
- Clique em **"Deixar de seguir"** para parar de acompanhar
- Seus seguidores e quem voce segue aparecem no seu perfil publico

### Perfil publico

Acesse o perfil de qualquer usuario clicando no nome dele em uma publicacao ou em `/explorar/perfil/:id`.

O perfil publico exibe:
- Avatar, nome, bio
- Contagem de seguidores e seguindo
- Abas: posts do usuario, reposts e curtidas
- Lista de pets do usuario

### Deletar publicacao

Na sua publicacao, clique nas opcoes → **"Deletar"**. A foto associada tambem e removida do servidor.

---

## 12. Mapa interativo

O mapa (`/mapa`) mostra em tempo real todos os pontos de interesse, pets perdidos e avistamentos.

### Como usar

1. Acesse **"Mapa"** no menu
2. O mapa carrega centralizado na sua localizacao (se permitir acesso ao GPS)
3. Navegue pelo mapa arrastando e dando zoom

### Camadas e filtros

O mapa exibe diferentes tipos de marcadores:

| Marcador | Cor/Icone | O que mostra |
|---|---|---|
| Petshops | Azul | Petshops parceiros com endereco e servicos |
| Pontos de interesse | Variado por categoria | Clinicas, abrigos, ONGs, parques pet-friendly |
| Pets perdidos | Vermelho | Alertas ativos de pets perdidos com foto e descricao |
| Avistamentos | Amarelo | Localizacoes registradas via scan NFC |

### Funcionalidades do mapa

- **Lazy loading**: os pontos sao carregados conforme voce navega (apenas o que esta visivel)
- **Clustering**: quando muitos pontos estao proximos, eles se agrupam em clusters com contagem
- **Clique em marcador**: abre um popup com detalhes (nome, endereco, telefone, servicos)
- **Detalhes**: clique em "Ver mais" no popup para acessar a pagina completa do local

---

## 13. Chat

O chat (`/chat`) permite comunicacao entre o tutor e quem encontrou o pet perdido.

### Como funciona

1. Quando alguem encontra o pet e preenche o formulario "Encontrei este pet", uma **conversa e criada automaticamente**
2. As mensagens enviadas ficam com status **"pendente"** ate serem aprovadas por um administrador
3. Apos aprovacao, a mensagem aparece para o destinatario em **tempo real** (via WebSocket)
4. Mensagens rejeitadas nao sao entregues

### Usando o chat

1. Acesse **"Chat"** no menu ou `/chat`
2. Voce vera a lista de todas as suas conversas com:
   - Foto do pet
   - Nome do pet e de quem encontrou
   - Ultima mensagem e horario
3. Clique em uma conversa para abrir
4. Digite sua mensagem e clique em enviar
5. Aguarde a aprovacao do admin para a mensagem ser entregue

### Por que o chat e moderado?

A moderacao garante que:
- Nao sejam trocados dados pessoais indevidamente
- Mensagens ofensivas ou spam sejam bloqueadas
- A comunicacao seja segura para ambas as partes

Quando o pet e encontrado e o alerta e resolvido, as conversas sao **encerradas e os dados senssiveis removidos** (conforme LGPD).

---

## 14. Agendamentos

O sistema permite agendar servicos em petshops parceiros.

### Como agendar

1. Acesse a pagina de um **petshop** (via lista de petshops ou pelo mapa)
2. Clique em **"Agendar"**
3. Preencha:
   - **Pet**: selecione qual pet vai ao servico
   - **Servico**: banho, tosa, consulta, etc.
   - **Data e horario**
4. Clique em **"Confirmar Agendamento"**

### Gerenciar agendamentos

Acesse **"Agenda"** no menu (`/agenda`) para ver todos os seus agendamentos:
- **Agendado**: aguardando confirmacao do petshop
- **Confirmado**: confirmado pelo admin/petshop
- **Cancelado**: cancelado por voce ou pelo sistema

Para cancelar, clique em **"Cancelar"** no agendamento desejado (apenas agendamentos que ainda nao foram realizados).

---

## 15. Notificacoes

O AIRPET envia notificacoes para manter voce informado sobre tudo que acontece com seus pets.

### Tipos de notificacao

| Tipo | Quando voce recebe |
|---|---|
| Scan NFC | Alguem escaneou a tag do seu pet |
| Alerta | Um pet perdido foi reportado perto de voce |
| Chat | Uma nova mensagem foi aprovada na conversa |
| Sistema | Vacina vencendo, alerta rejeitado, pet encontrado |
| Encontrado | Alguem reportou ter encontrado seu pet |

### Onde aparecem

1. **Badge no menu**: um numero vermelho aparece ao lado do icone de sino com a quantidade de notificacoes nao lidas
2. **Pagina de notificacoes** (`/notificacoes`): lista completa agrupada por data (hoje, ontem, esta semana, anteriores)
3. **Push no celular**: notificacoes nativas do navegador/celular, mesmo com a pagina fechada
4. **Tempo real**: novas notificacoes aparecem instantaneamente via WebSocket

### Ativar push notifications

1. Ao acessar o AIRPET pela primeira vez, um modal de permissao aparece
2. Clique em **"Permitir"** para receber notificacoes push
3. As notificacoes aparecerao mesmo quando o AIRPET nao estiver aberto

Para desativar, acesse as configuracoes de notificacao do seu navegador.

---

## 16. Perfil do usuario

Acesse seu perfil em `/perfil` (menu → "Perfil").

### O que voce pode editar

| Campo | Descricao |
|---|---|
| Nome | Seu nome exibido no sistema |
| Telefone | Numero de contato |
| Bio | Descricao curta (ate 160 caracteres) exibida no perfil publico |
| Cor do perfil | Cor tema do seu perfil (hex, ex: #ec5a1c) |
| Foto de perfil | Sua foto exibida no feed e nos comentarios |

### Perfil publico vs privado

- Seu **perfil publico** (`/explorar/perfil/:id`) e visivel para qualquer usuario logado
- Ele exibe: avatar, bio, posts, pets, seguidores e seguindo
- Dados como email e telefone **nao aparecem** no perfil publico

---

## 17. Instalar como aplicativo — PWA

O AIRPET funciona como PWA (Progressive Web App), ou seja, pode ser instalado no celular como um aplicativo nativo.

### Como instalar no Android

1. Acesse o AIRPET pelo Chrome
2. Um banner **"Adicionar a tela inicial"** aparecera automaticamente
3. Clique em **"Instalar"**
4. O AIRPET aparecera como um icone na sua tela inicial

### Como instalar no iPhone

1. Acesse o AIRPET pelo Safari
2. Toque no botao de **compartilhar** (icone de quadrado com seta)
3. Selecione **"Adicionar a Tela de Inicio"**
4. Clique em **"Adicionar"**

### Funcionalidades offline

Com o PWA instalado:
- Paginas ja visitadas ficam em **cache** e podem ser acessadas offline
- Se nao houver conexao, uma **pagina offline** amigavel e exibida
- Push notifications funcionam normalmente em segundo plano
- O app abre em **tela cheia**, sem a barra de endereco do navegador

---

# PARTE 3 — GUIA DO ADMINISTRADOR

---

## 18. Acessar o painel admin

O painel administrativo possui **login separado** do login de usuarios.

### Como acessar

1. Acesse `/admin/login` (ou o path customizado definido em `ADMIN_PATH` no `.env`)
2. Informe o **email** e **senha** de administrador (configurados no `.env`)
3. Clique em **"Entrar"**

**Seguranca:**
- O login admin usa credenciais definidas nas variaveis de ambiente (`ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH`)
- A senha e comparada usando **bcrypt** (nao texto puro)
- Rate limiting de 20 tentativas por 15 minutos
- O path de acesso pode ser customizado via `ADMIN_PATH` no `.env` (seguranca por obscuridade)

### Sessao admin

A sessao do admin e **independente** da sessao de usuario. Voce pode estar logado como usuario e como admin ao mesmo tempo.

Para sair, clique em **"Sair"** no painel admin ou acesse `/admin/logout`.

---

## 19. Dashboard

O dashboard (`/admin`) e a pagina inicial do painel administrativo.

### Metricas exibidas

| Card | O que mostra |
|---|---|
| Total de usuarios | Quantidade de contas criadas no sistema |
| Total de pets | Quantidade de pets cadastrados |
| Pets perdidos ativos | Alertas com status "aprovado" (em andamento) |
| Total de petshops | Petshops parceiros cadastrados |
| Mensagens pendentes | Mensagens do chat aguardando moderacao |
| Alertas pendentes | Alertas de pet perdido aguardando aprovacao |

Todas as metricas sao carregadas em paralelo para rapidez.

### Navegacao

O dashboard tem links rapidos para todas as secoes de gestao: usuarios, pets, petshops, pets perdidos, moderacao, tags NFC, mapa e configuracoes.

---

## 20. Gerenciar usuarios

Acesse em **Admin → Usuarios** (`/admin/usuarios`).

### O que voce pode fazer

- **Listar todos os usuarios**: tabela com id, nome, email, telefone, role e data de criacao
- **Alterar role**: clique no botao ao lado do usuario para alternar entre `usuario` e `admin`
  - Promover a admin: o usuario passa a ter acesso ao painel administrativo
  - Rebaixar a usuario: remove o acesso ao painel

### Cuidados

- Nao e possivel rebaixar a si mesmo (sempre havera pelo menos 1 admin)
- A alteracao de role e imediata — o usuario tera (ou perdera) acesso ao painel na proxima requisicao

---

## 21. Gerenciar pets

Acesse em **Admin → Pets** (`/admin/pets`).

### O que voce ve

Tabela com **todos os pets** do sistema, incluindo:
- Nome, tipo, raca
- Nome do dono
- Status (seguro/perdido)
- Data de cadastro

Esta pagina e apenas para **visualizacao** — a edicao de pets e feita pelo dono na area de usuario.

---

## 22. Gerenciar petshops

Acesse em **Admin → Petshops** (`/admin/petshops`).

### O que voce pode fazer

- **Listar todos os petshops** com status (ativo/inativo)
- **Criar novo petshop**: nome, endereco, localizacao (lat/lng), telefone, WhatsApp, descricao, servicos oferecidos, horario de funcionamento, galeria de fotos, se e ponto de apoio
- **Editar petshop**: alterar qualquer informacao
- **Ativar/desativar**: petshops inativos nao aparecem no mapa nem na lista publica
- **Deletar**: remocao permanente

### Ponto de apoio

Um petshop pode ser marcado como **ponto de apoio**, indicando que aceita pets encontrados temporariamente ate o dono buscar.

---

## 23. Aprovar e rejeitar pets perdidos

Acesse em **Admin → Pets Perdidos** (`/admin/pets-perdidos`).

### Fluxo de aprovacao

Quando um tutor reporta um pet perdido, o alerta fica com status **"pendente"**. O admin deve:

1. **Revisar** as informacoes: foto do pet, localizacao, descricao, data/hora
2. Decidir:
   - **Aprovar e Notificar**: o alerta e publicado e usuarios proximos sao notificados automaticamente via push + Socket.IO
   - **Rejeitar**: o alerta e descartado e o tutor e notificado com o motivo

### Escalamento manual

Para alertas ja aprovados, o admin pode **escalar manualmente** o nivel do alerta:
- Clique em **"Escalar"** para aumentar o nivel (1 → 2 → 3)
- Cada nivel amplia o raio de notificacao, atingindo mais usuarios

### Status dos alertas

| Status | Significado |
|---|---|
| Pendente | Aguardando aprovacao do admin |
| Aprovado | Ativo, buscando o pet |
| Resolvido | Pet foi encontrado |
| Rejeitado | Alerta descartado pelo admin |

---

## 24. Moderar mensagens do chat

Acesse em **Admin → Moderacao** (`/admin/moderacao`).

### Como funciona

Toda mensagem enviada no chat entre tutor e encontrador fica com status **"pendente"** ate o admin agir.

A pagina de moderacao exibe:
- Remetente da mensagem
- Conteudo
- Conversa relacionada (qual pet, quem encontrou)
- Horario de envio

### Acoes

- **Aprovar**: a mensagem e entregue ao destinatario em tempo real (via Socket.IO)
- **Rejeitar**: a mensagem e descartada e nao e entregue

### Dica

Verifique a moderacao regularmente — mensagens pendentes significam que tutores e encontradores estao aguardando resposta. O badge de "mensagens pendentes" no dashboard indica quantas mensagens estao na fila.

---

## 25. Gerenciar tags NFC

As tags NFC sao gerenciadas em **Admin → Tags** (`/tags/admin/lista`).

### Gerar lotes de tags

1. Acesse **"Gerar Lote"** (`/tags/admin/gerar`)
2. Informe:
   - **Quantidade** (1 a 1000 tags por lote)
   - **Fabricante** (opcional)
   - **Observacoes** (opcional)
3. Clique em **"Gerar"**
4. O sistema cria automaticamente:
   - Um **lote** com codigo unico
   - N tags com codigos unicos no formato `PET-XXXXXX`
   - Cada tag recebe um **codigo de ativacao** aleatorio (formato `XXXX-XXXX`)

### Ciclo de vida das tags

```
stock → reserved → sent → active → [blocked]
```

| Acao | De → Para | Descricao |
|---|---|---|
| Reservar | stock → reserved | Separa a tag para um usuario especifico |
| Enviar | reserved → sent | Marca que a tag foi despachada pelo correio |
| Ativar | sent → active | O usuario ativa a tag (feito pelo proprio usuario) |
| Bloquear | qualquer → blocked | Desativa a tag (perda, roubo, mau uso) |

### Listagem e filtros

A pagina de tags exibe todas as tags com:
- Codigo da tag (`PET-XXXXXX`)
- Status atual
- Lote de origem
- Usuario vinculado (se houver)
- Pet vinculado (se houver)
- Data de criacao/ativacao

Filtros por status permitem localizar rapidamente tags em cada fase do ciclo.

### Lotes

Acesse **"Lotes"** (`/tags/admin/lotes`) para ver todos os lotes criados, com codigo, quantidade, fabricante e data.

---

## 26. Gerenciar pontos no mapa

Acesse em **Admin → Gerenciar Mapa** (`/admin/gerenciar-mapa`).

### O que sao pontos no mapa

Sao locais de interesse para tutores de pets que aparecem no mapa interativo. Categorias disponiveis:

| Categoria | Icone | Exemplos |
|---|---|---|
| Clinica | Veterinaria | Clinicas veterinarias |
| Abrigo | Casa | Abrigos de animais |
| ONG | Coracao | ONGs de protecao animal |
| Parque | Arvore | Parques pet-friendly |
| Petshop | Loja | (gerenciados separadamente em Petshops) |

### Como adicionar um ponto

1. Na pagina de gerenciamento, clique em **"Adicionar Ponto"**
2. Preencha:
   - **Nome**
   - **Categoria**
   - **Endereco**
   - **Latitude e Longitude** (ou clique no mapa para selecionar)
   - **Telefone e WhatsApp**
   - **Descricao**
   - **Servicos oferecidos**
   - **Horario de funcionamento** (formato JSON)
3. Clique em **"Salvar"**

### Acoes

- **Editar**: alterar qualquer informacao do ponto
- **Ativar/Desativar**: pontos inativos nao aparecem no mapa publico
- **Deletar**: remocao permanente

### Mapa admin

Acesse **Admin → Mapa** (`/admin/mapa`) para ver uma visao geral de todos os pontos, petshops e alertas no mapa.

---

## 27. Configuracoes do sistema

Acesse em **Admin → Configuracoes** (`/admin/configuracoes`).

### Configuracoes disponiveis

| Chave | Padrao | Descricao |
|---|---|---|
| `raio_alerta_nivel1_km` | 1 | Raio em km para notificacao no nivel 1 |
| `raio_alerta_nivel2_km` | 3 | Raio em km para notificacao no nivel 2 |
| `raio_alerta_nivel3_km` | 0 | Raio em km para notificacao no nivel 3 (0 = todos) |
| `horas_para_nivel2` | 6 | Horas apos aprovacao para escalar para nivel 2 |
| `horas_para_nivel3` | 24 | Horas apos aprovacao para escalar para nivel 3 |

### Como alterar

1. Na pagina de configuracoes, edite os valores desejados
2. Clique em **"Salvar"**
3. As alteracoes entram em vigor imediatamente — o proximo ciclo do scheduler usara os novos valores

### Impacto das configuracoes

- **Raios maiores** = mais usuarios notificados (maior cobertura, mais notificacoes)
- **Raios menores** = notificacoes mais precisas (menos spam, menor cobertura)
- **Raio 0** no nivel 3 = todos os usuarios do sistema sao notificados
- **Horas menores** = escalamento mais rapido (mais urgente)
- **Horas maiores** = escalamento mais lento (da tempo ao tutor antes de ampliar)

---

# PARTE 4 — DOCUMENTACAO TECNICA (PROGRAMADORES)

---

## 28. Arquitetura do sistema

O AIRPET segue a arquitetura **MVC (Model-View-Controller)** estendida com uma **camada de Services** para logica de negocio.

### Fluxo de uma requisicao

```
Browser → Routes → Middlewares → Controllers → Services → Models → PostgreSQL/PostGIS
                                      ↓
                                  Views (EJS)
                                      ↓
                                   Browser
```

### Camadas

| Camada | Pasta | Responsabilidade |
|---|---|---|
| Routes | `src/routes/` | Define URLs, aplica middlewares, conecta a controllers |
| Middlewares | `src/middlewares/` | Auth, admin, rate limiting, validacao |
| Controllers | `src/controllers/` | Recebe requests, orquestra a logica, retorna responses |
| Services | `src/services/` | Logica de negocio pura (proximidade, push, moderacao) |
| Models | `src/models/` | Queries SQL parametrizadas ao PostgreSQL |
| Views | `src/views/` | Templates EJS para server-side rendering |
| Sockets | `src/sockets/` | WebSocket para comunicacao em tempo real |
| Utils | `src/utils/` | Funcoes auxiliares (helpers, logger, upload, geo) |

### Comunicacao em tempo real (WebSocket)

```
Browser ←→ Socket.IO Server
            ├── /chat          → Chat moderado
            ├── /admin         → Painel admin em tempo real
            └── /notificacoes  → Push de notificacoes
```

---

## 29. Estrutura de pastas

```
AIRPET/
├── server.js                          ← Ponto de entrada (Express + Socket.IO)
├── package.json                       ← Dependencias e scripts
├── .env                               ← Variaveis de ambiente (NAO commitado)
├── .env.example                       ← Template do .env
├── tailwind.config.js                 ← Config TailwindCSS
├── postcss.config.js                  ← PostCSS (Tailwind + Autoprefixer)
├── DOCUMENTACAO.md                    ← Este arquivo
│
├── fontes/                            ← PDFs de referencia e planejamento
│
└── src/
    ├── config/
    │   ├── database.js                ← Pool PostgreSQL (pg) — 20 conexoes max
    │   ├── session.js                 ← express-session + connect-pg-simple
    │   └── migrate.js                 ← Auto-criacao de 25 tabelas no boot
    │
    ├── controllers/                   ← 16+ controllers
    │   ├── authController.js          ← Login, registro, logout, esqueci/redefinir senha
    │   ├── petController.js           ← CRUD pets + perfil com idade/peso ideal
    │   ├── nfcController.js           ← Scan NFC, encontrei pet, enviar foto
    │   ├── tagController.js           ← Ativacao e gestao de tags
    │   ├── petshopController.js       ← Listagem de petshops
    │   ├── petPerdidoController.js    ← Reportar e resolver pets perdidos
    │   ├── localizacaoController.js   ← API de localizacao
    │   ├── notificacaoController.js   ← Notificacoes e push subscriptions
    │   ├── agendaController.js        ← Agendamentos (criar, listar, cancelar)
    │   ├── adminController.js         ← Painel admin completo
    │   ├── mapaController.js          ← API de pins do mapa (GeoJSON)
    │   ├── chatController.js          ← Chat moderado + lista de conversas
    │   ├── saudeController.js         ← Carteira de saude (vacinas, registros)
    │   ├── diarioController.js        ← Diario do pet
    │   ├── perfilController.js        ← Perfil do usuario + API de racas
    │   ├── explorarController.js      ← Feed social (posts, curtidas, comentarios)
    │   ├── pontoMapaController.js     ← Gestao de pontos no mapa
    │   └── usuarioController.js       ← Operacoes de usuario
    │
    ├── models/                        ← 20+ models
    │   ├── Usuario.js                 ← Usuarios do sistema
    │   ├── Pet.js                     ← Pets cadastrados
    │   ├── NfcTag.js                  ← Tags NFC (ciclo de vida)
    │   ├── TagBatch.js                ← Lotes de fabricacao
    │   ├── TagScan.js                 ← Auditoria de scans
    │   ├── Petshop.js                 ← Petshops parceiros
    │   ├── PontoMapa.js               ← Pontos de interesse no mapa
    │   ├── PetPerdido.js              ← Alertas de pets perdidos
    │   ├── Localizacao.js             ← Registro de localizacoes (PostGIS)
    │   ├── Notificacao.js             ← Notificacoes do usuario
    │   ├── AgendaPetshop.js           ← Agendamentos
    │   ├── Conversa.js                ← Sessoes de chat
    │   ├── MensagemChat.js            ← Mensagens + moderacao
    │   ├── Vacina.js                  ← Carteira de vacinacao
    │   ├── RegistroSaude.js           ← Consultas, exames
    │   ├── DiarioPet.js               ← Diario do pet
    │   ├── ConfigSistema.js           ← Configuracoes chave/valor
    │   ├── PushSubscription.js        ← Inscricoes Web Push
    │   ├── Publicacao.js              ← Publicacoes do feed social
    │   ├── Curtida.js                 ← Curtidas em publicacoes
    │   ├── Comentario.js              ← Comentarios em publicacoes
    │   ├── Seguidor.js                ← Sistema de seguidores
    │   └── Repost.js                  ← Reposts de publicacoes
    │
    ├── routes/                        ← 15 arquivos de rotas
    │   ├── index.js                   ← Hub central (monta sub-rotas)
    │   ├── authRoutes.js
    │   ├── petRoutes.js
    │   ├── nfcRoutes.js
    │   ├── tagRoutes.js
    │   ├── petshopRoutes.js
    │   ├── mapaRoutes.js
    │   ├── chatRoutes.js
    │   ├── saudeRoutes.js
    │   ├── diarioRoutes.js
    │   ├── agendaRoutes.js
    │   ├── petPerdidoRoutes.js
    │   ├── localizacaoRoutes.js
    │   ├── notificacaoRoutes.js
    │   ├── adminRoutes.js
    │   └── explorarRoutes.js
    │
    ├── services/                      ← 12 services (logica de negocio)
    │   ├── authService.js             ← Hash de senha, JWT, login
    │   ├── nfcService.js              ← Decisao de tela ao escanear tag
    │   ├── notificacaoService.js      ← Criacao, envio, proximidade PostGIS
    │   ├── pushService.js             ← Web Push API (VAPID)
    │   ├── schedulerService.js        ← Jobs automaticos
    │   ├── localizacaoService.js      ← Registro de localizacoes
    │   ├── mapaService.js             ← Queries PostGIS por bounding box
    │   ├── chatService.js             ← Moderacao de mensagens
    │   ├── proximidadeService.js      ← Busca de usuarios proximos (raio)
    │   ├── saudeService.js            ← Lembretes de vacinas
    │   ├── petService.js              ← Regras de negocio de pets
    │   └── tagService.js              ← Geracao de codigos, ativacao 3 fatores
    │
    ├── middlewares/
    │   ├── authMiddleware.js          ← estaAutenticado, estaAutenticadoAPI
    │   ├── adminMiddleware.js         ← apenasAdmin
    │   ├── rateLimiter.js             ← Rate limiting (geral, auth, login, ativacao)
    │   └── validator.js               ← Validacao de formularios
    │
    ├── sockets/
    │   ├── index.js                   ← Inicializa 3 namespaces Socket.IO
    │   ├── chatSocket.js              ← Chat em tempo real
    │   ├── adminSocket.js             ← Painel admin em tempo real
    │   └── notificacaoSocket.js       ← Notificacoes em tempo real
    │
    ├── utils/
    │   ├── helpers.js                 ← Geracao de codigos, formatacao
    │   ├── logger.js                  ← Log padronizado (info/error/warn)
    │   ├── geolocation.js             ← Helpers PostGIS
    │   └── upload.js                  ← Factory de multer (pets/diario/chat)
    │
    ├── views/                         ← ~40 templates EJS
    │   ├── home.ejs                   ← Landing page
    │   ├── explorar.ejs               ← Feed social
    │   ├── termos.ejs                 ← Termos de uso
    │   ├── privacidade.ejs            ← Politica de privacidade
    │   ├── perfil.ejs                 ← Perfil do usuario
    │   ├── auth/                      ← login, registro, esqueci-senha, redefinir-senha
    │   ├── pets/                      ← meus-pets, cadastro, perfil, editar, saude, confirmacao
    │   ├── nfc/                       ← intermediaria, ativar, nao-ativada, escolher-pet, encontrei, enviar-foto, encontrei-sucesso
    │   ├── chat/                      ← lista, conversa
    │   ├── diario/                    ← index
    │   ├── mapa/                      ← index
    │   ├── petshops/                  ← lista, detalhes
    │   ├── pontos/                    ← detalhes
    │   ├── pets-perdidos/             ← formulario, confirmacao, encontrado
    │   ├── notificacoes/              ← lista
    │   ├── agenda/                    ← lista
    │   ├── explorar/                  ← perfil (perfil publico de usuarios)
    │   ├── admin/                     ← dashboard, login, usuarios, pets, petshops, pets-perdidos, moderacao, configuracoes, gerenciar-mapa, mapa, tags, gerar-tags, lotes
    │   ├── partials/                  ← header, nav, footer, flash, erro
    │   └── layouts/                   ← main.ejs
    │
    └── public/                        ← Arquivos estaticos
        ├── css/
        │   ├── input.css              ← Entrada Tailwind
        │   └── output.css             ← CSS compilado (gerado, no .gitignore)
        ├── js/
        │   ├── app.js                 ← Logica geral + compartilharWhatsApp()
        │   ├── mapa.js                ← Integracao Leaflet + lazy loading
        │   ├── chat.js                ← Socket.IO client para chat
        │   ├── pwa.js                 ← Registro do Service Worker + push
        │   ├── permissions.js         ← Modais de permissao (camera, GPS, notificacao)
        │   └── admin-moderacao.js     ← JS do painel de moderacao admin
        ├── images/
        │   ├── pets/                  ← Fotos de perfil dos pets
        │   ├── diario/               ← Fotos do diario
        │   ├── chat/                  ← Fotos do chat
        │   ├── posts/                 ← Fotos de publicacoes do feed
        │   └── icons/                 ← Icones PWA (icon-192.svg, icon-512.svg)
        ├── manifest.json              ← Config PWA
        ├── sw.js                      ← Service Worker (cache offline)
        └── offline.html               ← Pagina offline
```

---

## 30. Como instalar e rodar

### Pre-requisitos

1. **Node.js** (versao 18 ou superior) — [nodejs.org](https://nodejs.org)
2. **PostgreSQL** (versao 14 ou superior) com extensao **PostGIS**
3. **Git** (opcional, para clonar o repositorio)

### Passo 1: Instalar PostgreSQL com PostGIS

No Windows, baixe o instalador em [postgresql.org](https://www.postgresql.org/download/).
Durante a instalacao, use o "Stack Builder" para instalar o PostGIS.

Crie o banco de dados:
```sql
CREATE DATABASE airpet;
\c airpet
CREATE EXTENSION postgis;
```

### Passo 2: Configurar o .env

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:
```env
# Banco de dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_NAME=airpet

# Seguranca
JWT_SECRET=uma_chave_secreta_longa_e_aleatoria
SESSION_SECRET=outra_chave_secreta_longa_e_aleatoria

# Admin
ADMIN_EMAIL=admin@airpet.com
ADMIN_PASSWORD_HASH=$2b$12$...    # Hash bcrypt da senha admin
ADMIN_PATH=/admin                  # Path customizavel do painel admin

# Web Push (VAPID)
VAPID_PUBLIC_KEY=sua_chave_publica
VAPID_PRIVATE_KEY=sua_chave_privada
VAPID_EMAIL=mailto:admin@airpet.com

# Servidor
PORT=3000
NODE_ENV=development
```

Para gerar as chaves VAPID:
```bash
npx web-push generate-vapid-keys
```

Para gerar o hash da senha admin:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('sua_senha', 12).then(h => console.log(h))"
```

### Passo 3: Instalar dependencias

```bash
npm install
```

### Passo 4: Compilar o CSS (TailwindCSS)

```bash
npx tailwindcss -i src/public/css/input.css -o src/public/css/output.css
```

Para modo watch (recompila automaticamente):
```bash
npx tailwindcss -i src/public/css/input.css -o src/public/css/output.css --watch
```

### Passo 5: Iniciar o servidor

**Desenvolvimento (com auto-restart):**
```bash
npm run dev
```

**Producao:**
```bash
npm start
```

O servidor inicia em `http://localhost:3000` (ou a porta definida no `.env`).

### O que acontece no boot

1. Conecta ao PostgreSQL
2. Executa `migrate.js` — cria as 25 tabelas automaticamente (idempotente)
3. Insere seeds (configuracoes padrao, catalogo de racas)
4. Inicializa Socket.IO com 3 namespaces
5. Inicia o scheduler (escalar alertas a cada 30min, lembretes a cada 6h, limpeza a cada 1h)
6. Servidor pronto para receber requisicoes

---

## 31. Banco de dados

O sistema usa **PostgreSQL** com a extensao **PostGIS** para queries geograficas. Sao **25 tabelas** criadas automaticamente via `src/config/migrate.js`.

### Tabela: `usuarios`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | Auto-incremento |
| nome | VARCHAR(100) | NOT NULL |
| email | VARCHAR(150) | UNIQUE NOT NULL |
| senha_hash | VARCHAR(255) | NOT NULL (bcrypt 12 rounds) |
| telefone | VARCHAR(20) | |
| role | VARCHAR(20) | Default: 'usuario'. Valores: 'usuario', 'admin' |
| ultima_localizacao | GEOGRAPHY(POINT, 4326) | PostGIS — atualizada via GPS |
| ultima_lat | DECIMAL(10,7) | |
| ultima_lng | DECIMAL(10,7) | |
| cor_perfil | VARCHAR(7) | Default: '#ec5a1c' |
| bio | VARCHAR(160) | Descricao curta para perfil publico |
| foto_perfil | TEXT | URL da foto |
| data_criacao | TIMESTAMP | Default: NOW() |
| data_atualizacao | TIMESTAMP | |

### Tabela: `pets`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| usuario_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| nome | VARCHAR(100) | NOT NULL |
| tipo | VARCHAR(50) | Default: 'cachorro' |
| tipo_custom | VARCHAR(100) | Para tipos personalizados |
| raca | VARCHAR(100) | |
| cor | VARCHAR(50) | |
| porte | VARCHAR(30) | mini, pequeno, medio, grande, gigante |
| sexo | VARCHAR(20) | |
| data_nascimento | DATE | |
| peso | DECIMAL(5,2) | Em kg |
| foto | TEXT | Path da foto |
| descricao_emocional | TEXT | |
| telefone_contato | VARCHAR(20) | Telefone alternativo |
| status | VARCHAR(20) | Default: 'seguro'. Valores: 'seguro', 'perdido' |
| petshop_vinculado_id | INTEGER (FK) | → petshops(id) |
| data_criacao | TIMESTAMP | |
| data_atualizacao | TIMESTAMP | |

### Tabela: `nfc_tags`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| tag_code | VARCHAR(20) | UNIQUE NOT NULL (formato: PET-XXXXXX) |
| activation_code | VARCHAR(20) | NOT NULL (formato: XXXX-XXXX) |
| qr_code | VARCHAR(100) | UNIQUE |
| status | VARCHAR(20) | Default: 'stock'. Valores: stock, reserved, sent, active, blocked |
| batch_id | INTEGER (FK) | → tag_batches(id) |
| user_id | INTEGER (FK) | → usuarios(id) |
| pet_id | INTEGER (FK) | → pets(id) ON DELETE SET NULL |
| activated_at | TIMESTAMP | |
| sent_at | TIMESTAMP | |
| reserved_at | TIMESTAMP | |
| data_criacao | TIMESTAMP | |

### Tabela: `tag_batches`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| codigo_lote | VARCHAR(50) | UNIQUE NOT NULL |
| quantidade | INTEGER | NOT NULL |
| fabricante | VARCHAR(100) | |
| observacoes | TEXT | |
| criado_por | INTEGER (FK) | → usuarios(id) |
| data_criacao | TIMESTAMP | |

### Tabela: `tag_scans`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| tag_id | INTEGER (FK) | → nfc_tags(id) |
| tag_code | VARCHAR(20) | NOT NULL |
| latitude | DECIMAL(10,7) | |
| longitude | DECIMAL(10,7) | |
| cidade | VARCHAR(100) | |
| ip | VARCHAR(45) | |
| user_agent | TEXT | |
| data | TIMESTAMP | Default: NOW() |

### Tabela: `petshops`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| nome | VARCHAR(150) | NOT NULL |
| endereco | TEXT | |
| localizacao | GEOGRAPHY(POINT, 4326) | Indice GIST para busca espacial |
| telefone | VARCHAR(20) | |
| whatsapp | VARCHAR(20) | |
| descricao | TEXT | |
| servicos | TEXT[] | Array PostgreSQL |
| horario_funcionamento | JSONB | |
| galeria_fotos | TEXT[] | |
| ponto_de_apoio | BOOLEAN | Default: false |
| latitude | DECIMAL(10,7) | |
| longitude | DECIMAL(10,7) | |
| ativo | BOOLEAN | Default: true |
| data_criacao | TIMESTAMP | |

### Tabela: `pontos_mapa`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| nome | VARCHAR(150) | NOT NULL |
| categoria | VARCHAR(50) | NOT NULL (abrigo, ong, clinica, parque) |
| endereco | TEXT | |
| localizacao | GEOGRAPHY(POINT, 4326) | Indice GIST |
| latitude | DECIMAL(10,7) | |
| longitude | DECIMAL(10,7) | |
| telefone | VARCHAR(20) | |
| whatsapp | VARCHAR(20) | |
| descricao | TEXT | |
| servicos | TEXT[] | |
| horario_funcionamento | JSONB | |
| galeria_fotos | TEXT[] | |
| icone_mapa | VARCHAR(50) | |
| ativo | BOOLEAN | Default: true |
| criado_por | INTEGER (FK) | → usuarios(id) |
| data_criacao | TIMESTAMP | |
| data_atualizacao | TIMESTAMP | |

### Tabela: `pets_perdidos`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| pet_id | INTEGER (FK) | → pets(id) ON DELETE CASCADE |
| ultima_localizacao | GEOGRAPHY(POINT, 4326) | Indice GIST |
| ultima_lat | DECIMAL(10,7) | |
| ultima_lng | DECIMAL(10,7) | |
| descricao | TEXT | |
| recompensa | VARCHAR(50) | |
| status | VARCHAR(30) | Default: 'pendente'. Valores: pendente, aprovado, resolvido, rejeitado |
| nivel_alerta | INTEGER | Default: 0 (1 a 3 apos aprovacao) |
| data_hora_desaparecimento | TIMESTAMP | |
| cidade | VARCHAR(100) | |
| data | TIMESTAMP | Default: NOW() |

### Tabela: `localizacoes`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| pet_id | INTEGER (FK) | → pets(id) ON DELETE CASCADE |
| ponto | GEOGRAPHY(POINT, 4326) | Indice GIST |
| latitude | DECIMAL(10,7) | |
| longitude | DECIMAL(10,7) | |
| cidade | VARCHAR(100) | |
| ip | VARCHAR(45) | |
| foto_url | TEXT | |
| data | TIMESTAMP | |

### Tabela: `conversas`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| pet_perdido_id | INTEGER (FK) | → pets_perdidos(id) ON DELETE CASCADE |
| encontrador_nome | VARCHAR(100) | |
| encontrador_telefone | VARCHAR(20) | |
| dono_id | INTEGER (FK) | → usuarios(id) |
| status | VARCHAR(30) | Default: 'ativa' |
| data_criacao | TIMESTAMP | |

### Tabela: `mensagens_chat`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| conversa_id | INTEGER (FK) | → conversas(id) ON DELETE CASCADE |
| remetente | VARCHAR(30) | NOT NULL |
| tipo | VARCHAR(20) | Default: 'texto' |
| conteudo | TEXT | NOT NULL |
| foto_url | TEXT | |
| status_moderacao | VARCHAR(30) | Default: 'pendente'. Valores: pendente, aprovada, rejeitada |
| moderado_por | INTEGER (FK) | → usuarios(id) |
| moderado_em | TIMESTAMP | |
| data | TIMESTAMP | |

### Tabela: `notificacoes`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| usuario_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| tipo | VARCHAR(50) | scan, alerta, chat, sistema, encontrado |
| mensagem | TEXT | |
| link | TEXT | |
| lida | BOOLEAN | Default: false |
| data | TIMESTAMP | |

### Tabela: `vacinas`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| pet_id | INTEGER (FK) | → pets(id) ON DELETE CASCADE |
| nome | VARCHAR(100) | NOT NULL |
| data_aplicacao | DATE | |
| data_proxima | DATE | Proximo reforco |
| veterinario | VARCHAR(100) | |
| observacoes | TEXT | |
| data_criacao | TIMESTAMP | |

### Tabela: `registros_saude`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| pet_id | INTEGER (FK) | → pets(id) ON DELETE CASCADE |
| tipo | VARCHAR(50) | NOT NULL (consulta, exame, cirurgia, vermifugo, antipulgas, outro) |
| descricao | TEXT | |
| data_registro | DATE | |
| data_proxima | DATE | |
| valor_numerico | DECIMAL(10,2) | |
| veterinario | VARCHAR(100) | |
| observacoes | TEXT | |
| data_criacao | TIMESTAMP | |

### Tabela: `diario_pet`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| pet_id | INTEGER (FK) | → pets(id) ON DELETE CASCADE |
| usuario_id | INTEGER (FK) | → usuarios(id) |
| tipo | VARCHAR(30) | NOT NULL (alimentacao, passeio, remedio, necessidades, humor, peso, banho, brincar, veterinario, outro) |
| descricao | TEXT | |
| valor_numerico | DECIMAL(10,2) | |
| foto | TEXT | |
| data | DATE | Default: CURRENT_DATE |
| hora | TIME | Default: CURRENT_TIME |
| data_criacao | TIMESTAMP | |

### Tabela: `agenda_petshop`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| petshop_id | INTEGER (FK) | → petshops(id) ON DELETE CASCADE |
| pet_id | INTEGER (FK) | → pets(id) |
| usuario_id | INTEGER (FK) | → usuarios(id) |
| servico | VARCHAR(100) | |
| data | TIMESTAMP | |
| status | VARCHAR(30) | Default: 'agendado'. Valores: agendado, confirmado, cancelado, concluido |
| data_criacao | TIMESTAMP | |

### Tabela: `config_sistema`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| chave | VARCHAR(100) | UNIQUE NOT NULL |
| valor | TEXT | NOT NULL |
| descricao | TEXT | |
| atualizado_em | TIMESTAMP | |

Seeds padrao: `raio_alerta_nivel1_km` (1), `raio_alerta_nivel2_km` (3), `raio_alerta_nivel3_km` (0), `horas_para_nivel2` (6), `horas_para_nivel3` (24).

### Tabela: `push_subscriptions`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| usuario_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| endpoint | TEXT | NOT NULL, UNIQUE INDEX |
| p256dh | TEXT | NOT NULL |
| auth | TEXT | NOT NULL |
| user_agent | TEXT | |
| data_criacao | TIMESTAMP | |

### Tabela: `publicacoes`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| usuario_id | INTEGER (FK) | NOT NULL → usuarios(id) ON DELETE CASCADE |
| pet_id | INTEGER (FK) | → pets(id) ON DELETE SET NULL |
| foto | VARCHAR(500) | |
| legenda | TEXT | |
| texto | TEXT | Para posts sem foto |
| fixada | BOOLEAN | Default: false |
| tipo | VARCHAR(20) | Default: 'original'. Valores: original, repost |
| repost_id | INTEGER (FK) | → publicacoes(id) ON DELETE SET NULL |
| criado_em | TIMESTAMP | |

Limites: MAX_POSTS = 10 por usuario, MAX_FIXADAS = 3.

### Tabela: `curtidas`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| usuario_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| publicacao_id | INTEGER (FK) | → publicacoes(id) ON DELETE CASCADE |
| criado_em | TIMESTAMP | |

Constraint: UNIQUE(usuario_id, publicacao_id) — um usuario so pode curtir cada post uma vez.

### Tabela: `comentarios`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| usuario_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| publicacao_id | INTEGER (FK) | → publicacoes(id) ON DELETE CASCADE |
| texto | TEXT | NOT NULL |
| criado_em | TIMESTAMP | |

### Tabela: `reposts`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| usuario_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| publicacao_id | INTEGER (FK) | → publicacoes(id) ON DELETE CASCADE |
| criado_em | TIMESTAMP | |

Constraint: UNIQUE(usuario_id, publicacao_id) — um usuario so pode repostar cada post uma vez.

### Tabela: `seguidores`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| seguidor_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| seguido_id | INTEGER (FK) | → usuarios(id) ON DELETE CASCADE |
| criado_em | TIMESTAMP | |

Constraint: UNIQUE(seguidor_id, seguido_id) — auto-referenciamento.

### Tabela: `racas`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | SERIAL (PK) | |
| nome | VARCHAR(100) | UNIQUE(nome, tipo) |
| tipo | VARCHAR(50) | cachorro, gato, passaro, outro |
| popular | BOOLEAN | Default: false |

Seed com ~200 racas incluindo cachorros, gatos, passaros e outros animais.

### Tabela: `user_sessions`

Tabela auto-gerenciada pelo `connect-pg-simple` para armazenar sessoes Express.

### Indices espaciais (GIST)

Tabelas com indice GIST para queries geograficas rapidas:
- `pontos_mapa.localizacao`
- `petshops.localizacao`
- `pets_perdidos.ultima_localizacao`
- `localizacoes.ponto`

### Diagrama de relacionamentos

```
usuarios ──1:N──> pets ──1:N──> vacinas
                  │              registros_saude
                  │              diario_pet
                  │              localizacoes
                  │
                  ├──1:N──> nfc_tags ──1:N──> tag_scans
                  │           └── via tag_batches
                  │
                  └──1:N──> pets_perdidos ──1:N──> conversas ──1:N──> mensagens_chat

usuarios ──1:N──> notificacoes
           1:N──> push_subscriptions
           1:N──> publicacoes ──1:N──> curtidas
                                1:N──> comentarios
                                1:N──> reposts
           M:N──> seguidores (auto-referenciamento)
           1:N──> agenda_petshop ←── petshops
                                      pontos_mapa
```

---

## 32. Rotas e endpoints

Todas as rotas sao montadas em `src/routes/index.js` com sub-routers.

### Rotas publicas (sem autenticacao)

| Metodo | Path | Descricao |
|---|---|---|
| GET | `/` | Home page (redireciona para `/explorar` se logado) |
| GET | `/termos` | Termos de uso |
| GET | `/privacidade` | Politica de privacidade |
| GET | `/auth/login` | Formulario de login |
| POST | `/auth/login` | Processar login (rate limited) |
| GET | `/auth/registro` | Formulario de registro |
| POST | `/auth/registro` | Processar registro (rate limited) |
| GET | `/auth/esqueci-senha` | Formulario de recuperacao de senha |
| POST | `/auth/esqueci-senha` | Gerar token de recuperacao |
| GET | `/auth/redefinir-senha/:token` | Formulario de nova senha |
| POST | `/auth/redefinir-senha/:token` | Salvar nova senha |
| GET | `/auth/logout` | Encerrar sessao |
| GET | `/tag/:tag_code` | Processar scan NFC (tela baseada no status da tag) |
| GET | `/tag/:tag_code/encontrei` | Formulario "encontrei este pet" |
| POST | `/tag/:tag_code/encontrei` | Processar formulario com localizacao e foto |
| GET | `/tag/:tag_code/enviar-foto` | Formulario para enviar foto |
| POST | `/tag/:tag_code/enviar-foto` | Upload de foto do pet encontrado |
| GET | `/petshops` | Lista de petshops ativos |
| GET | `/petshops/:id` | Detalhes de um petshop |
| GET | `/mapa` | Pagina do mapa interativo |
| GET | `/mapa/api/pins` | API GeoJSON — pins por bounding box |
| GET | `/api/racas` | API — buscar racas por tipo/nome (autocomplete) |

### Rotas autenticadas (usuario logado)

| Metodo | Path | Descricao |
|---|---|---|
| GET | `/pets` | Listar pets do usuario |
| GET | `/pets/cadastro` | Formulario de cadastro |
| POST | `/pets/cadastro` | Criar pet (com upload de foto) |
| GET | `/pets/:id` | Perfil completo do pet |
| GET | `/pets/:id/editar` | Formulario de edicao |
| POST | `/pets/:id/editar` | Atualizar dados do pet |
| PUT | `/pets/:id` | Atualizar via method-override |
| GET | `/pets/:id/saude` | Carteira de saude |
| POST | `/saude/:pet_id/vacinas` | Adicionar vacina |
| DELETE | `/saude/vacinas/:id` | Remover vacina |
| POST | `/saude/:pet_id/registros` | Adicionar registro de saude |
| DELETE | `/saude/registros/:id` | Remover registro de saude |
| GET | `/diario/:pet_id` | Exibir diario do pet |
| POST | `/diario/:pet_id` | Adicionar entrada no diario |
| DELETE | `/diario/:id` | Remover entrada |
| GET | `/tags/:tag_code/ativar` | Formulario de ativacao NFC |
| POST | `/tags/:tag_code/ativar` | Ativar tag (3 fatores) |
| GET | `/tags/:tag_code/escolher-pet` | Escolher pet para vincular |
| POST | `/tags/:tag_code/vincular-pet` | Vincular tag ao pet |
| GET | `/perdidos/:pet_id/formulario` | Formulario de reporte |
| POST | `/perdidos/:pet_id/reportar` | Criar alerta de pet perdido |
| GET | `/perdidos/:pet_id/encontrado` | Formulario "meu pet foi encontrado" |
| POST | `/perdidos/:pet_id/encontrado` | Resolver alerta |
| GET | `/perdidos/:pet_id/confirmacao` | Tela de celebracao |
| POST | `/perdidos/:id/resolver` | Redireciona para fluxo de encontrado |
| GET | `/explorar` | Feed social (tabs: para-voce, seguindo) |
| POST | `/explorar/post` | Criar publicacao (com foto) |
| POST | `/explorar/post/:id/curtir` | Curtir publicacao |
| DELETE | `/explorar/post/:id/curtir` | Descurtir |
| GET | `/explorar/post/:id/comentarios` | Listar comentarios (JSON) |
| POST | `/explorar/post/:id/comentar` | Comentar |
| DELETE | `/explorar/comentario/:id` | Deletar comentario |
| POST | `/explorar/post/:id/fixar` | Fixar publicacao |
| DELETE | `/explorar/post/:id/fixar` | Desafixar |
| DELETE | `/explorar/post/:id` | Deletar publicacao |
| POST | `/explorar/seguir/:id` | Seguir usuario |
| DELETE | `/explorar/seguir/:id` | Deixar de seguir |
| GET | `/explorar/perfil/:id` | Perfil publico do usuario |
| GET | `/chat` | Lista de conversas |
| POST | `/chat/iniciar` | Iniciar/reabrir conversa |
| GET | `/chat/:conversaId` | Exibir conversa |
| GET | `/notificacoes` | Lista de notificacoes |
| GET | `/notificacoes/api/count` | API — contar nao lidas |
| POST | `/notificacoes/:id/lida` | Marcar como lida |
| POST | `/notificacoes/push/subscribe` | Salvar push subscription |
| POST | `/notificacoes/push/unsubscribe` | Remover push subscription |
| GET | `/agenda` | Listar agendamentos |
| POST | `/agenda` | Criar agendamento |
| POST | `/agenda/:id/cancelar` | Cancelar agendamento |
| POST | `/agenda/:id/confirmar` | Confirmar agendamento (admin) |
| GET | `/perfil` | Pagina de perfil do usuario |
| PUT | `/perfil` | Atualizar perfil |
| POST | `/api/localizacao` | Registrar localizacao de pet |
| GET | `/api/localizacao/:pet_id` | Historico de localizacoes |

### Rotas administrativas (admin)

| Metodo | Path | Descricao |
|---|---|---|
| GET | `/admin/login` | Pagina de login admin |
| POST | `/admin/login` | Processar login admin |
| GET | `/admin/logout` | Logout admin |
| GET | `/admin` | Dashboard com metricas |
| GET | `/admin/usuarios` | Lista de usuarios |
| POST | `/admin/usuarios/:id/role` | Alterar role do usuario |
| GET | `/admin/pets` | Lista de todos os pets |
| GET | `/admin/petshops` | Lista de petshops |
| GET | `/admin/pets-perdidos` | Lista de alertas |
| POST | `/admin/pets-perdidos/:id/aprovar` | Aprovar alerta + notificar |
| POST | `/admin/pets-perdidos/:id/rejeitar` | Rejeitar alerta |
| POST | `/admin/pets-perdidos/:id/escalar` | Escalar nivel do alerta |
| GET | `/admin/moderacao` | Fila de moderacao do chat |
| POST | `/admin/moderacao/:id/aprovar` | Aprovar mensagem |
| POST | `/admin/moderacao/:id/rejeitar` | Rejeitar mensagem |
| GET | `/admin/configuracoes` | Configuracoes do sistema |
| POST | `/admin/configuracoes` | Salvar configuracoes |
| GET | `/admin/gerenciar-mapa` | CRUD de pontos no mapa |
| GET | `/admin/mapa` | Mapa administrativo |
| POST | `/admin/pontos-mapa` | Criar ponto |
| PUT | `/admin/pontos-mapa/:id` | Atualizar ponto |
| POST | `/admin/pontos-mapa/:id/toggle` | Ativar/desativar ponto |
| DELETE | `/admin/pontos-mapa/:id` | Deletar ponto |
| GET | `/tags/admin/lista` | Lista de tags NFC |
| GET | `/tags/admin/lotes` | Lista de lotes |
| POST | `/tags/admin/gerar` | Gerar lote de tags |
| POST | `/tags/admin/:id/reservar` | Reservar tag |
| POST | `/tags/admin/:id/enviar` | Marcar como enviada |
| POST | `/tags/admin/:id/bloquear` | Bloquear tag |

---

## 33. Controllers

Cada controller recebe a request do router, orquestra a logica (chamando services/models) e retorna a response (render ou redirect).

### authController.js

| Funcao | Descricao |
|---|---|
| `mostrarLogin` | Renderiza a pagina de login |
| `login` | Valida credenciais, cria sessao + cookie JWT, redireciona para `/explorar` |
| `mostrarRegistro` | Renderiza a pagina de registro |
| `registrar` | Cria usuario via authService, inicia sessao, redireciona para `/explorar` |
| `mostrarEsqueciSenha` | Renderiza formulario de recuperacao |
| `esqueciSenha` | Gera token de reset (1h validade), armazena in-memory |
| `mostrarRedefinirSenha` | Renderiza formulario de nova senha (valida token) |
| `redefinirSenha` | Hash da nova senha com bcrypt, salva no banco |
| `logout` | Destroi sessao, limpa cookies JWT e session |

### petController.js

| Funcao | Descricao |
|---|---|
| `listar` | Lista pets do usuario logado |
| `mostrarCadastro` | Renderiza wizard de 8 passos |
| `criar` | Cria pet com upload de foto (multer, max 5MB) |
| `mostrarPerfil` | Perfil completo: idade humana, peso ideal, calendario, scans NFC |
| `mostrarEditar` | Formulario de edicao (verifica propriedade) |
| `atualizar` | Atualiza dados + foto do pet |
| `mostrarSaude` | Renderiza carteira de saude (vacinas + registros) |

### nfcController.js

| Funcao | Descricao |
|---|---|
| `processarScan` | Rota principal do NFC — decide qual tela exibir baseado no status da tag |
| `mostrarEncontrei` | Formulario "encontrei este pet" |
| `processarEncontrei` | Salva dados do encontrador (nome, telefone, localizacao, foto), notifica dono |
| `mostrarEnviarFoto` | Formulario para enviar foto |
| `processarEnviarFoto` | Upload de foto, notificacao ao dono |

### tagController.js

| Funcao | Descricao |
|---|---|
| `listarTags` | Lista todas as tags (admin, com filtro por status) |
| `listarLotes` | Lista lotes de fabricacao |
| `gerarLote` | Gera lote de N tags com codigos unicos (transacao atomica) |
| `reservar` | Reserva tag para usuario |
| `enviar` | Marca tag como enviada |
| `bloquear` | Bloqueia tag |
| `mostrarAtivacao` | Formulario de ativacao (usuario) |
| `ativar` | Ativa tag com 3 fatores |
| `escolherPet` | Lista pets para vincular |
| `vincularPet` | Vincula tag ao pet (status → active) |

### explorarController.js

| Funcao | Descricao |
|---|---|
| `feed` | Feed social paginado (tabs: para-voce, seguindo) |
| `criarPost` | Cria publicacao com foto (max 10MB) e pet opcional |
| `curtir` | Curtir publicacao (toggle) |
| `descurtir` | Remover curtida |
| `comentarios` | Listar comentarios de uma publicacao (JSON) |
| `comentar` | Adicionar comentario (com extracao de mencoes) |
| `deletarComentario` | Deletar comentario (apenas autor) |
| `fixar` | Fixar publicacao (max 2 fixadas) |
| `desafixar` | Remover fixacao |
| `deletarPost` | Deletar publicacao e foto associada |
| `seguir` | Seguir usuario |
| `deixarDeSeguir` | Deixar de seguir |
| `perfilPublico` | Perfil publico com posts, pets, seguidores |

### adminController.js

| Funcao | Descricao |
|---|---|
| `dashboard` | Metricas em paralelo (Promise.all) |
| `listarUsuarios` | Tabela de todos os usuarios |
| `atualizarRoleUsuario` | Alterna role usuario/admin |
| `listarPets` | Todos os pets do sistema |
| `listarPetshops` | Todos os petshops |
| `listarPerdidos` | Alertas de pets perdidos |
| `aprovarPerdido` | Aprova alerta + notifica proximos via PostGIS |
| `rejeitarPerdido` | Rejeita alerta + notifica tutor |
| `escalarAlerta` | Escala nivel (1→2→3) + amplia raio de notificacao |
| `mostrarModeracao` | Lista mensagens pendentes |
| `aprovarMensagem` | Aprova e entrega mensagem via Socket.IO |
| `rejeitarMensagem` | Rejeita mensagem (nao entregue) |
| `mostrarConfiguracoes` | Exibe configs do sistema |
| `salvarConfiguracoes` | Salva configs |
| `mostrarGerenciarMapa` | CRUD de pontos no mapa |
| `mostrarMapa` | Mapa admin completo |

### Outros controllers

| Controller | Descricao |
|---|---|
| `petPerdidoController.js` | Reportar pet perdido, marcar como encontrado, tela de celebracao |
| `chatController.js` | Lista de conversas, iniciar conversa, exibir conversa (verifica participacao) |
| `saudeController.js` | CRUD de vacinas e registros de saude (verifica propriedade do pet) |
| `diarioController.js` | CRUD de entradas do diario (verifica propriedade do pet) |
| `agendaController.js` | CRUD de agendamentos (cancelar verifica propriedade) |
| `notificacaoController.js` | Listar, contar nao lidas, marcar lida, push subscribe/unsubscribe |
| `mapaController.js` | API de pins por bounding box (GeoJSON) |
| `petshopController.js` | Listar e detalhar petshops |
| `perfilController.js` | Exibir e atualizar perfil, API de racas |
| `pontoMapaController.js` | CRUD de pontos no mapa (usado pelo admin) |
| `localizacaoController.js` | Registrar e consultar historico de localizacoes |
| `usuarioController.js` | Operacoes complementares de usuario |

---

## 34. Models

Cada model encapsula as queries SQL parametrizadas para uma tabela. Todos usam o pool de conexoes de `src/config/database.js`.

### Padrao dos models

Todos os models seguem o mesmo padrao:
- Metodos **estaticos** (nao instancia objetos)
- Queries **parametrizadas** (`$1, $2...`) para prevenir SQL injection
- Retornam `rows[0]` para busca unica ou `rows` para listas
- Usam `RETURNING *` em INSERT/UPDATE para retornar o registro criado/atualizado

### Metodos por model

| Model | Metodos principais |
|---|---|
| `Usuario` | criar, buscarPorEmail, buscarPorId, listarTodos, atualizarLocalizacao (PostGIS), contarTotal, atualizarPerfil, atualizarRole, deletar |
| `Pet` | criar, buscarPorId (JOIN usuarios), buscarPorUsuario, listarTodos, atualizar, atualizarStatus, atualizarFoto, deletar, contarTotal, contarPerdidos |
| `NfcTag` | criarLote (transacao), buscarPorTagCode (JOIN pets+usuarios), listarTodas, reservar, marcarEnviada, ativar, bloquear, vincularPet, contarPorStatus |
| `TagBatch` | criar, buscarPorId, listarTodos, buscarPorCodigo |
| `TagScan` | registrar, buscarPorTag, buscarPorPet (JOIN nfc_tags), ultimoScanPet, listarRecentes |
| `Petshop` | criar, buscarPorId, listarAtivos, listarTodos, atualizar, deletar, buscarProximos (ST_DWithin), contarTotal |
| `PontoMapa` | criar, buscarPorId, listarAtivos, buscarPorBoundingBox (ST_MakeEnvelope), atualizar, ativarDesativar, deletar |
| `PetPerdido` | criar, buscarPorId (JOIN pets+usuarios), listarPendentes, listarAprovados, aprovar, rejeitar, resolver, atualizarNivel, contarAtivos |
| `Localizacao` | registrar (PostGIS), buscarPorPet, buscarRecentes |
| `Conversa` | criar, buscarPorId (JOIN multiplos), buscarPorUsuario, encerrar |
| `MensagemChat` | criar, buscarPorConversa (so aprovadas), buscarPendentes, aprovar, rejeitar, deletarPorConversa, contarPendentes |
| `Notificacao` | criar, criarParaMultiplos (unnest), buscarPorUsuario, marcarComoLida, contarNaoLidas |
| `Vacina` | criar, buscarPorPet, atualizar, deletar, buscarVencendo (JOIN pets) |
| `RegistroSaude` | criar, buscarPorPet, buscarPorTipo, atualizar, deletar |
| `DiarioPet` | criar, buscarPorPetEData, buscarPorPet, deletar |
| `AgendaPetshop` | criar, buscarPorId (JOIN multiplos), buscarPorUsuario, cancelar, confirmar, concluir |
| `ConfigSistema` | buscarPorChave, atualizar, listarTodas |
| `PushSubscription` | salvar (upsert), remover, buscarPorUsuario, buscarPorUsuarios, buscarTodas |
| `Publicacao` | criar, buscarPorId, feedGeral, feedSeguindo, buscarPorUsuario, fixar, desafixar, contarFixadas, contarAtivas, deletar |
| `Curtida` | curtir (ON CONFLICT DO NOTHING), descurtir, verificar, contar |
| `Comentario` | criar, buscarPorPublicacao (JOIN usuarios), deletar, contar, extrairMencoes, resolverMencoes |
| `Repost` | repostar (ON CONFLICT DO NOTHING), remover, verificar, contar |
| `Seguidor` | seguir, deixarDeSeguir, estaSeguindo, contarSeguidores, contarSeguindo |

---

## 35. Services

Services contem a logica de negocio que nao pertence aos controllers nem aos models.

### authService.js

| Funcao | Descricao |
|---|---|
| `registrar` | Hash da senha com bcrypt (12 rounds), verifica email duplicado, cria usuario |
| `login` | Busca por email, compara bcrypt, gera JWT (7 dias, payload: id/email/role) |
| `verificarToken` | Decodifica e valida JWT |

### nfcService.js

| Funcao | Descricao |
|---|---|
| `processarScan` | Decide qual tela exibir baseado no status da tag (nao-ativada, ativar, intermediaria, bloqueada). Para tags ativas: registra scan, verifica se pet esta perdido, monta dados para a view |

### tagService.js

| Funcao | Descricao |
|---|---|
| `gerarLote` | Cria batch + N tags com codigos unicos (PET-XXXXXX) em transacao atomica |
| `ativar` | Ativacao com 3 fatores: tag_code + usuario autenticado + activation_code |
| `reservar/enviar/vincular` | Gerencia transicoes de estado no ciclo de vida |

### notificacaoService.js

| Funcao | Descricao |
|---|---|
| `criarNotificacao` | Cria notificacao + envia push + emite via Socket.IO |
| `notificarProximos` | Usa PostGIS ST_DWithin para encontrar usuarios no raio, cria notificacoes em massa via unnest, envia push para todos |

### pushService.js

| Funcao | Descricao |
|---|---|
| `enviarParaUsuario` | Envia push para um usuario (busca subscriptions) |
| `enviarParaMultiplos` | Envia push em massa para lista de usuarios |
| `enviarNotificacao` | Envia para endpoint especifico (com cleanup de subscriptions expiradas) |

### schedulerService.js

| Job | Intervalo | Descricao |
|---|---|---|
| Escalar alertas | 30 minutos | Busca alertas aprovados, escala nivel conforme horas configuradas |
| Lembretes de vacinas | 6 horas | Busca vacinas vencendo em 7 dias, notifica tutores |
| Limpeza de posts | 1 hora | Remove publicacoes expiradas e seus arquivos de foto |

### Outros services

| Service | Descricao |
|---|---|
| `chatService.js` | Chat moderado: toda mensagem fica pendente ate aprovacao. Limpa dados de conversa ao resolver alerta (LGPD) |
| `mapaService.js` | 4 queries paralelas por bounding box (petshops, pontos, perdidos, localizacoes). Retorna GeoJSON RFC 7946, max 200 features |
| `proximidadeService.js` | Sistema de escalacao com 3 niveis (raios configuraveis). Busca usuarios via ST_DWithin |
| `saudeService.js` | CRUD de vacinas/registros. Busca vacinas vencendo para notificacoes proativas |
| `petService.js` | Regras de negocio de pets (cadastro, atualizacao, verificacao de propriedade) |
| `localizacaoService.js` | Registro de localizacoes com ponto PostGIS (origem: nfc/gps/manual) |

---

## 36. Middlewares

### authMiddleware.js

| Middleware | Descricao |
|---|---|
| `estaAutenticado` | Protege rotas web. Verifica sessao, fallback via JWT cookie. Se nao autenticado, redireciona para `/auth/login` |
| `estaAutenticadoAPI` | Mesmo fluxo, mas retorna JSON 401 ao inves de redirect |

### adminMiddleware.js

| Middleware | Descricao |
|---|---|
| `apenasAdmin` | Verifica `req.session.admin`. Se nao for admin, redireciona para login admin |

### rateLimiter.js

| Limiter | Config | Descricao |
|---|---|---|
| `limiterGeral` | 500 req/15min | Limite geral (pula em dev e arquivos estaticos) |
| `limiterAuth` | 20 req/15min | Login e registro |
| `limiterAtivacao` | 10 req/15min | Ativacao de tags NFC |

### validator.js

| Validador | Campos |
|---|---|
| `validarRegistro` | nome (min 2), email (formato valido), senha (min 6), telefone (min 10 digitos) |
| `validarLogin` | email (formato valido), senha (nao vazia) |
| `validarPet` | nome (obrigatorio) |
| `validarResultado` | Coleta erros dos validadores anteriores, retorna via flash (HTML) ou JSON 422 |

---

## 37. WebSockets — tempo real

O Socket.IO e inicializado em `src/sockets/index.js` com 3 namespaces:

### Namespace: `/chat`

Arquivo: `src/sockets/chatSocket.js`

Eventos:
- **`connection`**: usuario entra na room da conversa (`conversa_${id}`)
- **`mensagem`**: nova mensagem enviada (fica pendente ate aprovacao)
- **`mensagem_aprovada`**: admin aprovou — entrega ao destinatario em tempo real
- **`disconnect`**: usuario sai da room

### Namespace: `/admin`

Arquivo: `src/sockets/adminSocket.js`

Eventos:
- **`connection`**: admin se conecta
- **`novo_alerta`**: novo alerta de pet perdido criado
- **`nova_mensagem_pendente`**: nova mensagem aguardando moderacao
- **`atualizacao_metricas`**: metricas do dashboard atualizadas

### Namespace: `/notificacoes`

Arquivo: `src/sockets/notificacaoSocket.js`

Eventos:
- **`connection`**: usuario entra na room `user_${id}`
- **`nova_notificacao`**: notificacao entregue em tempo real
- **`disconnect`**: usuario sai da room

---

## 38. Upload de arquivos

Upload centralizado via **multer** em `src/utils/upload.js` (factory por diretorio).

### Destinos e limites

| Destino | Uso | Limite | Formatos |
|---|---|---|---|
| `/images/pets/` | Fotos de perfil dos pets, fotos do "encontrei" e "enviar foto" | 5 MB | jpeg, jpg, png, gif, webp |
| `/images/diario/` | Fotos do diario do pet | 5 MB | jpeg, jpg, png, gif, webp |
| `/images/chat/` | Fotos enviadas no chat | 5 MB | jpeg, jpg, png, gif, webp |
| `/images/posts/` | Fotos do feed social (Explorar) | 10 MB | jpeg, jpg, png, gif, webp |

### Seguranca

- Nomes de arquivo randomizados via `crypto.randomBytes(16)` (previne colisao e path traversal)
- Filtro de tipo MIME (apenas imagens)
- Limite de tamanho por multer (rejeita uploads maiores)
- Diretorio de uploads no `.gitignore` (nao versionado)

---

## 39. Scheduler — jobs automaticos

O scheduler e inicializado no boot do servidor via `src/services/schedulerService.js` usando `setInterval`.

### Jobs configurados

| Job | Intervalo | O que faz |
|---|---|---|
| Escalar alertas | 30 minutos | Busca alertas aprovados com mais de N horas. Se `horas_para_nivel2` atingido → escala para nivel 2. Se `horas_para_nivel3` atingido → escala para nivel 3. Cada escalamento amplia o raio de notificacao e notifica novos usuarios |
| Lembretes de vacinas | 6 horas | Busca vacinas com `data_proxima` dentro dos proximos 7 dias. Cria notificacao para o tutor com link para a carteira de saude |
| Limpeza de posts | 1 hora | Remove publicacoes expiradas (se houver regra de expiracao) e deleta os arquivos de foto associados do servidor |

### Como os raios sao calculados

Os raios sao lidos da tabela `config_sistema`:
- Nivel 1: `raio_alerta_nivel1_km` (padrao: 1 km)
- Nivel 2: `raio_alerta_nivel2_km` (padrao: 3 km)
- Nivel 3: `raio_alerta_nivel3_km` (padrao: 0 = todos os usuarios)

Se o valor for 0 no nivel 3, **todos os usuarios do sistema** sao notificados.

---

## 40. Seguranca

### Autenticacao

- **Sessoes**: `express-session` com store no PostgreSQL (`connect-pg-simple`)
- **JWT**: cookie httpOnly como fallback (7 dias de validade)
- **Autenticacao dupla**: middleware verifica sessao primeiro, depois tenta JWT

### Senhas

- Hash com **bcrypt** (12 rounds) — resistente a ataques de forca bruta
- Senha admin tambem em bcrypt (via `ADMIN_PASSWORD_HASH` no `.env`)

### Rate limiting

- Geral: 500 requisicoes por 15 minutos
- Login/registro: 20 por 15 minutos
- Ativacao NFC: 10 por 15 minutos

### Headers HTTP

- **helmet**: configura headers de seguranca (Content-Security-Policy, X-Frame-Options, etc.)

### Validacao de entrada

- **express-validator**: valida todos os inputs de formularios
- Queries **parametrizadas**: previne SQL injection em todos os models

### Verificacao de propriedade (ownership)

Todas as operacoes de edicao/exclusao verificam se o recurso pertence ao usuario logado:
- Editar/deletar pet → verifica `pet.usuario_id === req.session.usuario.id`
- Deletar vacina/registro → JOIN com pet para verificar dono
- Deletar entrada do diario → verifica propriedade
- Cancelar agendamento → verifica `agenda.usuario_id`
- Deletar comentario → verifica `comentario.usuario_id`
- Deletar publicacao → verifica `publicacao.usuario_id`

### LGPD

- Ao resolver alerta de pet perdido, mensagens de chat sao **deletadas** e conversas **encerradas**
- Dados de localizacao associados ao encontrador sao tratados conforme necessidade

### Tags NFC — 3 fatores de ativacao

1. Posse fisica da tag (URL unica nao adivinhadavel)
2. Conta autenticada no sistema
3. Codigo de ativacao impresso na embalagem (nao gravado na tag)

---

## 41. PWA e Service Worker

### manifest.json

```json
{
  "name": "AIRPET",
  "short_name": "AIRPET",
  "theme_color": "#ec5a1c",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    { "src": "/images/icons/icon-192.svg", "sizes": "192x192" },
    { "src": "/images/icons/icon-512.svg", "sizes": "512x512" }
  ],
  "shortcuts": [
    { "name": "Meus Pets", "url": "/pets" },
    { "name": "Mapa", "url": "/mapa" }
  ]
}
```

### Service Worker (sw.js)

- **Cache offline**: paginas visitadas sao armazenadas em cache
- **Fallback**: quando offline, exibe `offline.html` com mensagem amigavel
- **Push**: recebe notificacoes push mesmo com a pagina fechada

### Registro (pwa.js)

- Registra o Service Worker no carregamento da pagina
- Solicita permissao de notificacao push
- Salva subscription no servidor via API `/notificacoes/push/subscribe`

---

# PARTE 5 — REFERENCIA RAPIDA

---

## 42. Tabela de referencia rapida

### Acoes de usuario

| Voce quer... | Faca isso |
|---|---|
| Criar conta | Acesse `/auth/registro` e preencha o formulario |
| Fazer login | Acesse `/auth/login` com email e senha |
| Recuperar senha | Acesse `/auth/esqueci-senha` e informe seu email |
| Cadastrar pet | Menu → Meus Pets → Cadastrar Pet (ou `/pets/cadastro`) |
| Ver perfil do pet | Menu → Meus Pets → clique no pet (ou `/pets/:id`) |
| Editar pet | Perfil do pet → botao Editar |
| Ver carteira de saude | Perfil do pet → botao Saude (ou `/pets/:id/saude`) |
| Adicionar vacina | Saude → aba Vacinas → Adicionar Vacina |
| Adicionar registro medico | Saude → aba Registros → Adicionar Registro |
| Ver diario do pet | Perfil do pet → botao Diario (ou `/diario/:pet_id`) |
| Adicionar entrada no diario | Diario → Adicionar Entrada |
| Ativar tag NFC | Escaneie a tag → siga as instrucoes na tela |
| Vincular tag a um pet | Apos ativar → Escolher Pet → selecione |
| Reportar pet perdido | Perfil do pet → botao "Reportar como Perdido" |
| Marcar pet como encontrado | Perfil do pet → botao "Meu Pet Foi Encontrado" |
| Compartilhar pet perdido | Perfil do pet perdido → botao WhatsApp |
| Criar publicacao | Feed (Explorar) → area de criacao no topo |
| Curtir publicacao | Clique no coracao do post |
| Comentar em publicacao | Clique no icone de comentario → digite → Enviar |
| Repostar | Clique no icone de repost |
| Fixar publicacao | Opcoes do post → Fixar (max 2) |
| Seguir usuario | Perfil do usuario → botao Seguir |
| Ver perfil publico | Clique no nome de um usuario ou `/explorar/perfil/:id` |
| Ver o mapa | Menu → Mapa (ou `/mapa`) |
| Agendar servico em petshop | Pagina do petshop → botao Agendar |
| Cancelar agendamento | Menu → Agenda → botao Cancelar |
| Ver notificacoes | Clique no sino no menu (ou `/notificacoes`) |
| Ativar push no celular | Aceite a permissao de notificacoes quando solicitado |
| Editar perfil | Menu → Perfil (ou `/perfil`) |
| Instalar como app (Android) | Chrome → banner "Adicionar a tela inicial" |
| Instalar como app (iPhone) | Safari → Compartilhar → Adicionar a Tela de Inicio |
| Ver termos de uso | Acesse `/termos` |
| Ver politica de privacidade | Acesse `/privacidade` |

### Acoes de administrador

| Voce quer... | Faca isso |
|---|---|
| Acessar o painel admin | Acesse `/admin/login` com credenciais do `.env` |
| Ver metricas do sistema | Admin → Dashboard (`/admin`) |
| Listar usuarios | Admin → Usuarios (`/admin/usuarios`) |
| Promover usuario a admin | Admin → Usuarios → botao de alterar role |
| Listar todos os pets | Admin → Pets (`/admin/pets`) |
| Listar petshops | Admin → Petshops (`/admin/petshops`) |
| Aprovar alerta de pet perdido | Admin → Pets Perdidos → botao "Aprovar e Notificar" |
| Rejeitar alerta | Admin → Pets Perdidos → botao "Rejeitar" |
| Escalar alerta manualmente | Admin → Pets Perdidos → botao "Escalar" |
| Moderar mensagens do chat | Admin → Moderacao (`/admin/moderacao`) → Aprovar ou Rejeitar |
| Gerar lote de tags NFC | Admin → Tags → Gerar Lote (`/tags/admin/gerar`) |
| Listar tags NFC | Admin → Tags → Lista (`/tags/admin/lista`) |
| Ver lotes de tags | Admin → Tags → Lotes (`/tags/admin/lotes`) |
| Reservar tag para usuario | Admin → Tags → botao Reservar na tag |
| Enviar tag | Admin → Tags → botao Enviar na tag |
| Bloquear tag | Admin → Tags → botao Bloquear na tag |
| Adicionar ponto no mapa | Admin → Gerenciar Mapa → Adicionar Ponto |
| Editar ponto no mapa | Admin → Gerenciar Mapa → botao Editar no ponto |
| Ativar/desativar ponto | Admin → Gerenciar Mapa → botao Toggle no ponto |
| Alterar raios de alerta | Admin → Configuracoes (`/admin/configuracoes`) |
| Alterar tempo de escalamento | Admin → Configuracoes → campo de horas |

### Referencia para programadores

| Voce quer... | Onde encontrar |
|---|---|
| Entender a arquitetura | [Secao 28 — Arquitetura](#28-arquitetura-do-sistema) |
| Ver todas as pastas | [Secao 29 — Estrutura de pastas](#29-estrutura-de-pastas) |
| Instalar o projeto | [Secao 30 — Como instalar e rodar](#30-como-instalar-e-rodar) |
| Ver tabelas do banco | [Secao 31 — Banco de dados](#31-banco-de-dados) |
| Ver todos os endpoints | [Secao 32 — Rotas e endpoints](#32-rotas-e-endpoints) |
| Entender um controller | [Secao 33 — Controllers](#33-controllers) |
| Ver metodos de um model | [Secao 34 — Models](#34-models) |
| Entender a logica de negocio | [Secao 35 — Services](#35-services) |
| Ver middlewares | [Secao 36 — Middlewares](#36-middlewares) |
| Entender WebSockets | [Secao 37 — WebSockets](#37-websockets--tempo-real) |
| Ver config de upload | [Secao 38 — Upload de arquivos](#38-upload-de-arquivos) |
| Entender jobs automaticos | [Secao 39 — Scheduler](#39-scheduler--jobs-automaticos) |
| Entender seguranca | [Secao 40 — Seguranca](#40-seguranca) |
| Entender PWA | [Secao 41 — PWA e Service Worker](#41-pwa-e-service-worker) |
| Adicionar nova rota | Crie em `src/routes/`, registre em `src/routes/index.js` |
| Adicionar novo model | Crie em `src/models/`, adicione tabela em `src/config/migrate.js` |
| Adicionar novo controller | Crie em `src/controllers/`, conecte na rota |
| Adicionar novo service | Crie em `src/services/`, use no controller |
| Gerar chaves VAPID | `npx web-push generate-vapid-keys` |
| Gerar hash bcrypt | `node -e "require('bcrypt').hash('senha', 12).then(console.log)"` |
| Compilar CSS | `npx tailwindcss -i src/public/css/input.css -o src/public/css/output.css` |
| Rodar em dev | `npm run dev` (nodemon com auto-restart) |
| Rodar em producao | `npm start` |
