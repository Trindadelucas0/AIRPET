# Documentação Funcional do AIRPET

## 1) O que o sistema faz e para quem serve

O AIRPET é uma plataforma para:
- proteger pets com identificação por tag;
- ajudar no reencontro de pets perdidos;
- conectar tutores em uma rede social;
- aproximar tutores de petshops parceiros;
- permitir gestão administrativa de segurança, moderação e operação.

Perfis de uso principais:
- **Visitante**: conhece a plataforma, vê páginas públicas e pode iniciar cadastro.
- **Tutor (usuário logado)**: cadastra pets, publica no feed, recebe alertas, usa mapa, gerencia perfil.
- **Pessoa que encontrou um pet**: escaneia a tag e acessa uma página com ações rápidas para ajudar.
- **Parceiro (petshop)**: solicita parceria, acessa painel e gerencia informações/publicações.
- **Administrador**: acompanha indicadores, modera conteúdos e gerencia cadastros e mapas.

---

## 2) Navegação principal

### Navegação pública (sem login)
- **Início**: apresentação, benefícios e botões de entrada.
- **Entrar**: acesso de usuários já cadastrados.
- **Criar Conta**: cadastro de tutor.
- **Quero ser parceiro**: formulário de parceria para petshops.
- **Termos** e **Privacidade**: informações legais.

### Navegação do usuário logado (desktop)
- **Feed**: publicações de quem o usuário segue.
- **Explorar**: descoberta de perfis, pets e conteúdos.
- **Buscar**: busca de pessoas e pets.
- **Meus Pets**: lista e gestão dos pets do usuário.
- **Mapa**: visualização geográfica de pontos importantes.
- **Notificações**: alertas e atualizações.
- **Menu de perfil**:
  - **Meu Perfil** (perfil público),
  - **Configurações** (dados da conta),
  - **Sair**.

### Navegação do usuário logado (mobile)
Barra inferior com atalhos:
- **Feed**
- **Explorar**
- **Botão central de novo post**
- **Alertas**
- **Perfil**
- **Config**

---

## 3) Jornada do tutor (uso diário)

### 3.1 Cadastro e login
1. Acessa **Criar Conta**.
2. Preenche dados pessoais, contato e endereço.
3. Aceita termos e finaliza.
4. Faz login para entrar no ambiente completo.

### 3.2 Primeiro acesso recomendado
1. Ir em **Meus Pets**.
2. Clicar em **Novo Pet / Cadastrar pet**.
3. Preencher dados do pet.
4. Abrir o perfil do pet para:
   - editar dados,
   - acessar saúde,
   - acessar diário,
   - vincular tag quando disponível.

### 3.3 Feed e social
No **Feed** e no **Explorar**, o usuário pode:
- criar publicação;
- curtir e descurtir;
- comentar;
- repostar;
- compartilhar;
- seguir e deixar de seguir pessoas e pets;
- abrir perfis públicos.

### 3.4 Alertas de pet perdido
No perfil do pet, o tutor pode:
- abrir formulário de **pet perdido**;
- informar local e observações;
- depois marcar como encontrado quando necessário.

### 3.5 Notificações
Na tela de notificações:
- ver lista de eventos;
- marcar notificação individual como lida;
- marcar todas como lidas.

### 3.6 Perfil e configurações
Em **Configurações**:
- atualizar foto de perfil e capa;
- editar dados pessoais e endereço;
- ajustar aparência de perfil;
- gerenciar galeria de fotos.

---

## 4) Jornada de quem encontrou um pet (tag/NFC)

Quando uma pessoa escaneia a tag, ela cai em uma página intermediária com foco em ajuda rápida.

Botões principais desta página:
- **Ligar para o dono**: contato direto por telefone.
- **Enviar minha localização**: envia posição para ajudar no reencontro.
- **Encontrei este pet**: registra formalmente que o pet foi encontrado.
- **Levar ao petshop parceiro**: direciona para o ponto de apoio mais adequado.
- **Conversar com o dono** (quando aplicável): abre conversa direta.
- **Enviar foto** (quando aplicável): envia evidência visual do estado/local do pet.

Se o pet estiver marcado como perdido:
- a interface destaca alerta visual;
- reforça ações urgentes;
- pode exibir recompensa (quando cadastrada).

Resultado esperado desse fluxo:
- aumentar velocidade do reencontro com mínimo de atrito para quem ajudou.

---

## 5) Jornada de parceiros/petshops

### 5.1 Entrada de novos parceiros
Na página de parceiros:
- preencher formulário de cadastro comercial;
- enviar dados de contato, endereço e material do negócio;
- acompanhar status da solicitação.

### 5.2 Perfil público do petshop
Em páginas públicas de petshop:
- visitante pode ver detalhes do estabelecimento;
- usuário pode **seguir** o petshop;
- usuário pode **avaliar** o petshop;
- usuário pode iniciar contato/agendamento quando disponível.

### 5.3 Painel do parceiro
Após login no painel:
- visualizar **status da parceria** (pendente, em análise, aprovado, rejeitado);
- atualizar perfil público;
- cadastrar serviços;
- criar publicações e produtos;
- acompanhar e atualizar status de agendamentos.

Se ainda não estiver aprovado:
- recursos públicos ficam limitados até validação.

---

## 6) Jornada administrativa

Área administrativa focada em operação e controle:
- **Dashboard** com visão geral;
- gestão de **usuários**;
- gestão de **pets**;
- gestão de **petshops** e solicitações;
- moderação de conteúdos e promoções;
- gestão de casos de **pets perdidos**;
- ajustes de configurações gerais e aparência;
- gestão de mapa e pontos;
- envio de notificações e operação por regiões.

Objetivo da área:
- manter qualidade, segurança e funcionamento do ecossistema.

---

## 7) Botões e ações importantes por tela

## Início
- **Criar Conta Grátis**: inicia cadastro de tutor.
- **Já tenho conta**: leva ao login.
- **Quero ser parceiro**: leva ao cadastro de petshop.

## Login
- **Entrar**: autentica usuário.
- **Esqueci senha**: inicia recuperação de acesso.

## Feed / Explorar
- **Nova publicação**: cria post.
- **Curtir**: registra interação.
- **Comentar**: abre/insere comentários.
- **Repostar**: republica conteúdo.
- **Seguir**: conecta com perfis/pets.
- **Buscar**: filtra pessoas e pets.

## Meus Pets / Perfil do Pet
- **Cadastrar pet**: cria novo perfil de pet.
- **Editar**: atualiza dados do pet.
- **Saúde**: registra vacinas e observações.
- **Diário**: registra rotina/eventos.
- **Vincular tag**: liga identificação ao pet.
- **Reportar perdido**: inicia alerta comunitário.

## Mapa
- **Camadas**: liga/desliga tipos de informação.
- **Localizar região**: filtra por área.
- **Minha localização**: centraliza posição atual.

## Notificações
- **Marcar lida**: limpa item individual.
- **Marcar todas lidas**: limpa toda a lista.

## Perfil / Configurações
- **Salvar perfil**: grava alterações.
- **Galeria**: adicionar/remover fotos.
- **Sair**: encerra sessão.

## Parceiros
- **Enviar solicitação**: registra pedido de parceria.
- **Acompanhar status**: consulta andamento do cadastro.

## Painel do Petshop
- **Salvar perfil**: atualiza vitrine do petshop.
- **Salvar serviço**: adiciona oferta.
- **Publicar**: cria post/produto/promoção.
- **Atualizar agendamento**: aceita/recusa/conclui atendimento.

## Tag (pet encontrado)
- **Ligar para o dono**
- **Enviar localização**
- **Encontrei este pet**
- **Levar ao petshop parceiro**
- **Conversar com o dono**
- **Enviar foto**

---

## 8) Guia de uso no PWA (celular)

## O que é o PWA no AIRPET
É a versão instalável do sistema no celular, com atalho na tela inicial e experiência semelhante a app.

## Como instalar
1. Entrar no sistema pelo navegador do celular.
2. Aceitar o convite de instalação quando aparecer.
3. Confirmar **Instalar**.
4. Abrir pelo ícone na tela inicial.

## O que melhora no uso
- abertura mais rápida;
- acesso direto por ícone;
- experiência mais limpa no celular;
- recebimento de notificações (quando permitido).

## Notificações
- ao permitir notificações, o usuário recebe alertas relevantes;
- ao tocar no alerta, o sistema abre na tela associada ao aviso.

## Comportamento offline (atual)
- telas já acessadas tendem a abrir mesmo sem internet;
- há uma tela de aviso quando não há conexão;
- recursos de mapa dependem de internet para funcionar plenamente.

## Atualizações
- quando há nova versão disponível, o sistema pode pedir atualização;
- ao confirmar, recarrega para usar a versão mais recente.

---

## 9) Resumo rápido: como operar o sistema no dia a dia

Fluxo recomendado para um novo tutor:
1. Criar conta.
2. Cadastrar pelo menos 1 pet.
3. Configurar perfil e fotos.
4. Começar a seguir perfis/pets no Explorar.
5. Ativar uso de notificações.
6. Instalar o PWA no celular.

Fluxo em caso de pet perdido:
1. Abrir perfil do pet.
2. Acionar alerta de perdido.
3. Acompanhar notificações e mapa.
4. Usar interações recebidas de quem escaneou/encontrou.
5. Marcar como encontrado ao resolver.

Fluxo de parceria para petshop:
1. Preencher cadastro de parceiro.
2. Aguardar aprovação.
3. Entrar no painel.
4. Organizar perfil, serviços e publicações.
5. Gerenciar agendamentos.

---

## 10) Regras práticas para novos usuários da equipe

- Sem login, a pessoa vê somente áreas públicas.
- Com login, libera rotinas de gestão pessoal e interação social.
- Ações de parceiro exigem conta de parceiro.
- Ações administrativas ficam restritas ao time responsável.
- O PWA melhora o uso no celular, mas internet continua essencial para recursos dinâmicos (principalmente mapa e atualizações em tempo real).
