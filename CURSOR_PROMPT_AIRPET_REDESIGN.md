# PROMPT COMPLETO — REDESIGN TOTAL DO SISTEMA AIRPET
# Cole este prompt no Cursor AI (Agent Mode) e execute

---

Você é um engenheiro frontend sênior especializado em design systems e UX de redes sociais.
Preciso que você refatore **TODAS** as views EJS do projeto com um novo design system dark, premium e coeso.
Leia este prompt inteiramente antes de começar. Siga cada instrução com precisão.

---

## DESIGN SYSTEM — LEIA PRIMEIRO, APLIQUE EM TUDO

### Paleta de cores (CSS variables obrigatórias em TODAS as views)

```css
:root {
  --ink:          #0d0d0f;   /* fundo principal */
  --ink-2:        #13131a;   /* fundo cards */
  --ink-3:        #1c1c26;   /* fundo inputs, itens hover */
  --ink-4:        #242432;   /* bordas internas, hover profundo */
  --border:       rgba(255,255,255,0.07);
  --border-hover: rgba(255,255,255,0.13);
  --text:         #e4e4f0;   /* texto principal */
  --text-dim:     #7a7a96;   /* texto secundário */
  --text-muted:   #3d3d52;   /* placeholder, texto desabilitado */
  --accent:       #f26020;   /* laranja primário */
  --accent-light: #ff7a3d;   /* laranja hover */
  --accent-glow:  rgba(242,96,32,0.12);
  --green:        #22c55e;
  --green-glow:   rgba(34,197,94,0.1);
  --red:          #ef4444;
  --red-glow:     rgba(239,68,68,0.1);
  --purple:       #a78bfa;
  --blue:         #60a5fa;
  --yellow:       #facc15;
  --radius:       16px;
  --radius-sm:    10px;
  --radius-xs:    8px;
}
```

### Tipografia (importar no `<head>` de CADA view ou no layout global)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
```

- **Font display / títulos:** `'Syne', sans-serif` — peso 700 ou 800, letter-spacing -0.01em
- **Font corpo:** `'DM Sans', sans-serif` — pesos 400, 500, 600
- **NUNCA use:** Inter, Roboto, Arial, system-ui como fonte principal

### Regras visuais invioláveis

1. `body` sempre `background: var(--ink); color: var(--text); font-family: 'DM Sans', sans-serif;`
2. Todos os cards: `background: var(--ink-2); border: 1px solid var(--border); border-radius: var(--radius);`
3. Cards hover: `border-color: var(--border-hover)` com `transition: border-color 0.2s`
4. Inputs: `background: var(--ink-3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: 'DM Sans', sans-serif;`
5. Inputs focus: `border-color: rgba(242,96,32,0.5); box-shadow: 0 0 0 3px rgba(242,96,32,0.06);`
6. Botão primário: `background: var(--accent); color: #fff; border-radius: var(--radius-sm); font-weight: 700;`
7. Botão ghost: `background: transparent; border: 1px solid var(--border); color: var(--text-dim); border-radius: var(--radius-sm);`
8. Botão primário hover: `background: var(--accent-light); transform: translateY(-1px);`
9. Sticky headers sempre: `background: rgba(13,13,15,0.85); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border);`
10. Badges/pills: fundo com opacidade 10-12% da cor + border com opacidade 15-20%
11. Animação padrão de entrada: `@keyframes slide-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; } }`
12. Todos os section titles: font-family Syne, font-size mínimo 18px, font-weight 800

---

## COMPONENTES REUTILIZÁVEIS — crie em `partials/`

### `partials/header.ejs` — Navbar top

```
- Fundo: rgba(13,13,15,0.9) + backdrop-filter blur(20px)
- Border-bottom: 1px solid var(--border)
- Logo "AIRPET" em Syne 800, cor var(--accent)
- Links de nav com cor var(--text-dim), hover var(--accent)
- Ícone de notificação com badge numérico (se tiver notificações)
- Avatar do usuário clicável (abre dropdown com links: Perfil, Configurações, Sair)
- Dropdown do avatar: background var(--ink-3), border var(--border), border-radius 12px, box-shadow 0 12px 40px rgba(0,0,0,0.5)
- Mobile: hamburger menu que abre sidebar deslizante
- Z-index: 50, position: sticky top-0
```

### `partials/footer.ejs` — Barra de navegação mobile

```
- Posição: fixed bottom-0, z-index 50
- Fundo: rgba(13,13,15,0.95) + backdrop-filter blur(20px)
- Border-top: 1px solid var(--border)
- 5 ícones: Home, Explorar, Publicar (+), Notificações, Perfil
- Ícone ativo: cor var(--accent)
- Ícones inativos: cor var(--text-dim)
- Botão publicar (+): círculo var(--accent), 48px, centralizado
- APENAS visível em mobile (md:hidden)
```

### `partials/flash.ejs` — Mensagens de alerta

```
- Sucesso: background rgba(34,197,94,0.08), border rgba(34,197,94,0.2), cor var(--green), ícone fa-check-circle
- Erro: background rgba(239,68,68,0.08), border rgba(239,68,68,0.2), cor #f87171, ícone fa-circle-xmark
- Aviso: background rgba(250,204,21,0.08), border rgba(250,204,21,0.2), cor var(--yellow), ícone fa-triangle-exclamation
- Border-radius: var(--radius-sm)
- Padding: 12px 16px
- Botão de fechar (×) no canto direito
- Auto-dismiss após 5s com animação fade-out
```

---

## VIEWS — aplique o design em CADA arquivo

---

### `views/home.ejs` — Landing Page (visitantes)

**Estrutura:**

**1. HERO SECTION**
- min-height: 100vh, background: var(--ink)
- Grid de linhas finas como fundo: `background-image: linear-gradient(rgba(242,96,32,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(242,96,32,0.04) 1px, transparent 1px); background-size: 60px 60px;`
- Glow radial laranja no canto superior direito: `radial-gradient(circle, rgba(242,96,32,0.12) 0%, transparent 70%)`
- Layout 2 colunas (desktop): esquerda = copy, direita = mockup de celular flutuando
- Badge animado: `inline-flex, background rgba(242,96,32,0.1), border rgba(242,96,32,0.25), dot verde pulsante`
- H1: font Syne 800, 72-108px, linha height 0.95, cor #fff
- Palavra de destaque em var(--accent) com underline que aparece (animation scaleX)
- Subtítulo: 17px, cor var(--text-dim), max-width 440px
- 3 botões: Criar Conta (accent), Entrar (ghost), Ser Parceiro (green ghost)
- Mockup celular direita: div simulando tela com stories, posts, curtidas (não precisa ser funcional — é decorativo)
- Mockup: `border-radius: 36px, background: var(--ink-2), border: 1.5px solid var(--ink-3), box-shadow: 0 40px 80px rgba(0,0,0,0.6), animation: float 6s ease-in-out infinite`

**2. STAT STRIP**
- `background: var(--ink-2), border-top/bottom: 1px solid var(--ink-3)`
- 4 colunas com divisórias: Tutores ativos, Pets protegidos, Parceiros, Pets resgatados
- Números em Syne 800, 48px, brancos
- Label em uppercase 12px var(--text-dim)
- Contador animado (JS) ao entrar na viewport

**3. COMO FUNCIONA**
- 3 cards em grid com `background: var(--ink-2), border: 1px solid var(--border)`
- Cada card: ícone em box accent-glow, número do passo em accent, título 20px bold, descrição var(--text-dim)
- Número gigante decorativo no canto do card: `font-size: 120px, color: rgba(255,255,255,0.025)`

**4. FEATURES 2×2**
- Grid 2 colunas, cada card com pill colorida (orange/blue/green/pink), ícone emoji grande, título e descrição

**5. PETS PERDIDOS** (se `petsPerdidosRecentes.length > 0`)
- Grid 3 colunas (2 mobile)
- Cards com foto, badge "Perdido" vermelho pulsante, nome, raça, botão "Quero Ajudar"

**6. CTA FINAL**
- Ícone centralizado em box accent-glow
- H2 Syne 80px branco
- Botão primário grande + botão login parceiro ghost

---

### `views/auth/login.ejs` — Tela de login

```
- Layout centralizado, min-height 100vh, fundo var(--ink)
- Grid radial decorativo no fundo (igual ao hero da home)
- Card central: max-width 440px, background var(--ink-2), border var(--border), border-radius var(--radius), padding 40px
- Topo do card: logo AIRPET em Syne + subtítulo
- Inputs: email e senha (padrão do design system)
- Checkbox "Lembrar de mim" estilizado (accent quando checked)
- Link "Esqueci a senha" em var(--accent)
- Botão primário full-width "Entrar"
- Divider "ou"
- Link para registro
- Link separado para Login de Parceiro (ghost, menor)
```

---

### `views/auth/registro.ejs` — Cadastro

```
- Mesmo layout do login
- Campos: Nome, Email, Senha, Confirmar senha
- Validação inline (borda vermelha + ícone de erro abaixo do campo)
- Indicador de força de senha (barra colorida: red/yellow/green)
- Checkbox de termos estilizado
- Botão primário "Criar minha conta"
- Link para login
```

---

### `views/auth/esqueci-senha.ejs` e `views/auth/redefinir-senha.ejs`

```
- Mesmo layout do login (card centralizado)
- Ícone de cadeado/envelope centralizado acima do formulário
- Mensagem de instrução em var(--text-dim)
- Input + botão primário
- Link voltar (ghost)
```

---

### `views/feed.ejs` — Feed principal

**Layout:** 2 colunas desktop (feed principal + sidebar 300px), 1 coluna mobile

**Sticky header:**
```
"Feed" em Syne 800 20px + saudação ao usuário direita
background: rgba(13,13,15,0.85) + blur
```

**Composer (criar post):**
```
- Card var(--ink-2)
- Avatar do usuário + textarea expandível
- Preview de imagem removível
- Select de pet (se tiver pets cadastrados)
- Toolbar: botão foto, botão emoji
- Contador de chars + botão "Publicar" (accent, disabled quando vazio)
```

**Cards de post:**
```
- background: var(--ink-2), border: 1px solid var(--border)
- Hover: border-color: var(--border-hover)
- Header: avatar (com ring colorida por cor_perfil) + nome + pet linkado + timestamp relativo + menu (⋯)
- Menu dropdown: background var(--ink-3), border var(--border), border-radius 12px — opções: Fixar, Excluir
- Texto do post: 14px, var(--text), line-clamp-3 com botão "ver mais"
- Foto: width 100%, max-height 520px, object-fit cover
- Repost embed: card interno com border var(--border), border-radius 12px
- Barra de ações: 4 botões iguais (Comentar, Repostar, Curtir, Compartilhar)
  - Divisórias verticais entre botões
  - Curtir ativo: var(--red) + fa-solid fa-heart
  - Repost ativo: var(--green) + animação heartPop
  - Hover cada botão: background rgba(255,255,255,0.03)
- Input de comentário inline: background var(--ink-3), border var(--border), border-radius 10px
```

**Cards especiais:**
```
- Promo petshop: strip verde topo + badge, logo, título, botões
- Patrocinado: strip roxa topo + badge
```

**Sidebar:**
```
- position: sticky, top: 130px
- "Quem seguir": card com lista de usuários + botão "Seguir" por item
- "Pets em destaque": idem
- "Petshops próximos": card com lista
- Footer links mínimos em var(--text-dim) 11px
```

---

### `views/explorar/index.ejs` — Página de explorar

```
- Header sticky com título "Explorar" e barra de busca inline (desktop)
- Tabs: Pets | Pessoas | Petshops | Perdidos
  - Tab ativa: border-bottom 2px solid var(--accent), cor var(--accent)
  - Tab inativa: cor var(--text-dim)
- Grid de resultados (3 colunas desktop, 2 tablet, 1 mobile)
- Card de pet: foto, nome, raça, dono, botão seguir
- Card de pessoa: avatar + ring, nome, bio curta, contagem de pets, botão seguir
- Card de petshop: logo, nome, endereço, avaliação, botão vincular
- Card de pet perdido: foto com badge vermelho pulsante, nome, última localização, botão ajudar
```

---

### `views/explorar/busca.ejs` — Busca

```
- Input de busca grande no topo (44px altura, var(--ink-3), ícone lupa dentro)
- Resultado em tempo real via AJAX (debounce 300ms)
- Categorias de resultado separadas com label uppercase
- Estado vazio: ilustração sutil + texto orientando
- Estado carregando: skeleton cards (shimmer dark)
```

---

### `views/explorar/perfil-publico.ejs` — Perfil público de usuário

```
- Banner topo (100% width, 200px altura, fundo padrão se não tiver foto)
- Avatar sobreposto ao banner (-40px margin-top), 88px, border 3px var(--ink-2), ring de cor_perfil
- Nome em Syne 700 22px, username/cidade em var(--text-dim)
- Stats row: N pets | N seguidores | N seguindo — clicáveis
- Botão "Seguir" / "Seguindo" + botão "Mensagem" (se tiver)
- Tabs: Posts | Pets | Galeria
- Posts: grid de cards no padrão do feed
- Pets: grid de pet chips maiores (72px avatar, nome, raça)
- Galeria: grid masonry de fotos (3 colunas, hover mostra overlay com info)
```

---

### `views/explorar/pet.ejs` — Perfil público do pet

```
- Header com foto do pet (banner ou avatar grande centralizado)
- Nome do pet em Syne 800, raça em var(--text-dim)
- Info chips: espécie, raça, idade, peso — cada um como pill com ícone
- Seção "Tutor": mini card linkando para o perfil do dono
- Vacinação: tabela ou lista de vacinas com status (em dia / atrasada / badge colorido)
- Galeria de fotos do pet
- Botão "Seguir pet"
- Histórico de localizações (se perdido: alerta vermelho no topo)
```

---

### `views/pets/index.ejs` — Meus pets (lista)

```
- Header "Meus Pets" + botão "Novo pet" (accent, canto direito)
- Grid 3 colunas (2 tablet, 1 mobile)
- Card de pet:
  - Foto (altura 160px, object-fit cover) ou placeholder com emoji
  - Badge de status: Ativo / Perdido / etc
  - Nome, raça
  - Ações: Editar, Ver perfil, Configurar tag NFC
  - hover: border-color var(--border-hover), transform translateY(-2px)
- Estado vazio: ícone pata, texto, botão cadastrar
```

---

### `views/pets/cadastro.ejs` e `views/pets/editar.ejs`

```
- Layout de formulário em card único (max-width 640px, centralizado)
- Título em Syne + subtítulo
- Seções colapsáveis: "Dados básicos", "Saúde", "Aparência", "Localização"
- Upload de foto com preview circular + botão crop
- Campos: nome, espécie (radio buttons estilizados), raça, data nascimento, peso, cor, porte
- Seção saúde: vacinas (adicionar dinamicamente), vermifugação, castrado (toggle)
- Campo de observações (textarea)
- Botão salvar primário + cancelar ghost
```

---

### `views/pets/tag-nfc.ejs` — Configuração da tag NFC

```
- Ilustração/ícone de tag NFC grande centralizado (SVG ou emoji 🏷️)
- Status da tag: Vinculada / Não vinculada — badge colorido
- QR Code display (se aplicável)
- Instruções passo a passo numeradas
- Botão "Vincular nova tag" (accent)
- Seção "Dados exibidos ao escanear" — preview simulado da tela que aparece
- Botão "Testar tag"
```

---

### `views/perfil.ejs` — Configurações do usuário

**Estrutura geral:** cards de seção empilhados, max-width 720px centralizado

**Profile Hero card:**
```
- Banner editável (clique para trocar, botão "editar" no hover)
- Avatar com botão camera sobreposto
- Nome em Syne 700, email, localização
- Link "Ver perfil público"
- Sistema de crop de imagem ao trocar foto
```

**Cards de seção (cada um independente):**
```
1. Meus Pets — carrossel horizontal de chips + botão "Novo pet"
2. Publicações — barra de progresso X/10 com cores dinâmicas
3. Dados pessoais — nome, apelido, bio, cor de destaque (swatches visuais)
4. Localização — CEP com lookup automático, endereço, cidade, estado, botão geolocalização
5. Alterar senha — senha atual, nova, confirmar
6. Galeria por pet — select de pet + grid de fotos com hover para remover
7. Notificações — toggles de preferências (email, push)
8. Conta — Danger zone com botão excluir (red-tinted card, confirmação)
```

---

### `views/notificacoes.ejs` — Central de notificações

```
- Header "Notificações" + botão "Marcar todas como lidas"
- Tabs: Todas | Não lidas | Menções
- Lista de notificações:
  - Avatar do usuário que gerou + ícone de tipo no canto (coração/comentário/seguindo/etc)
  - Texto da notificação + timestamp relativo
  - Fundo ligeiramente diferente para não lidas: background rgba(242,96,32,0.04)
  - Border-left 2px solid var(--accent) nas não lidas
  - Clique marca como lida e navega para o conteúdo
- Estado vazio: ícone sino, texto "Nenhuma notificação ainda"
- Paginação ou infinite scroll
```

---

### `views/petshops/index.ejs` — Lista de petshops

```
- Header com título + toggle "Lista / Mapa"
- Filtros: distância, categoria, avaliação (pills clicáveis)
- Grid 3 colunas ou lista
- Card de petshop:
  - Logo (80px) ou placeholder loja
  - Nome, endereço curto, distância
  - Categoria (pill colorida)
  - Avaliação (estrelas)
  - Botões: Ver mais, Vincular
```

---

### `views/petshops/detalhe.ejs` — Detalhe do petshop

```
- Banner topo (240px)
- Logo sobreposta ao banner
- Nome em Syne 800, categoria, endereço completo
- Stats: avaliação média, qtd avaliações, pets vinculados
- Botão "Vincular meu pet" (accent) + botão "Contato" (ghost)
- Tabs: Promoções | Serviços | Avaliações | Fotos
- Promoções: cards com título, descrição, validade, botão aproveitar
- Mapa: iframe Google Maps ou placeholder estilizado
```

---

### `views/mensagens/index.ejs` — Mensagens (se existir)

```
- Layout split: lista de conversas (esquerda 320px) + área de chat (direita)
- Mobile: lista ou chat, não os dois
- Lista de conversas:
  - Avatar + nome + última mensagem truncada + timestamp
  - Badge de não lidas (pill accent)
  - Conversa ativa: background var(--ink-3)
- Área de chat:
  - Header com avatar + nome do destinatário
  - Mensagens em balões (próprias = accent à direita, outras = ink-3 à esquerda)
  - Input de texto + botão enviar
```

---

### `views/explorar/post.ejs` — Post individual (com comentários)

```
- Botão voltar no topo
- Card do post original (padrão do feed mas expandido, sem line-clamp)
- Seção comentários:
  - Título "X Comentários" em Syne
  - Input de novo comentário (com avatar do usuário logado)
  - Lista de comentários:
    - Avatar + nome + tempo
    - Texto
    - Botão curtir comentário (coração pequeno)
    - Botão responder
    - Respostas indentadas
```

---

### `views/explorar/perdidos.ejs` — Pets perdidos (mapa/lista)

```
- Header com alerta vermelho sutil: "X pets perdidos na sua região"
- Toggle: Lista / Mapa
- Filtros: espécie, raça, região, data
- Cards de pets perdidos (padrão da home mas maior)
- Mapa (se tiver integração) ou placeholder
- Botão "Reportar pet perdido" (accent, fixed bottom mobile)
```

---

## PADRÕES DE INTERAÇÃO — aplique em todas as views

### Skeletons (loading state)
```css
@keyframes shimmer-dark {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    var(--ink-3) 25%, var(--ink-4) 50%, var(--ink-3) 75%);
  background-size: 200% 100%;
  animation: shimmer-dark 1.5s infinite;
  border-radius: 8px;
}
```
Use para: listas de posts, cards de usuários, conteúdo dinâmico

### Empty states
Sempre que não houver dados, mostrar:
- Ícone/emoji grande (40-48px, opacidade 0.25)
- Título "Nada aqui ainda" em 15px bold var(--text)
- Subtítulo explicativo em var(--text-dim)
- Botão de ação primária (quando aplicável)

### Toasts/feedback
```javascript
// Implementar toast global (não usar alert())
function showToast(message, type = 'success') {
  // type: 'success' | 'error' | 'info'
  // aparecer no canto inferior direito
  // auto-dismiss 4s
  // cores seguindo o design system
  // animação slide-in da direita
}
```

### Confirmações destrutivas
Nunca usar `confirm()` nativo. Criar modal:
```
- Overlay: rgba(0,0,0,0.7) + backdrop-filter blur(4px)
- Card central: background var(--ink-2), border var(--border), border-radius var(--radius)
- Título da ação, descrição do risco
- Botões: Cancelar (ghost) + Confirmar (danger red)
```

### Formulários
- Validação inline (não bloquear submit para mostrar erros todos de uma vez)
- Erro: border-color rgba(239,68,68,0.6) + mensagem abaixo em 11px #f87171
- Sucesso de campo: border-color rgba(34,197,94,0.4)
- Botão submit: disabled + spinner enquanto envia
- Após sucesso: toast + redirect ou reset do form

---

## ANIMAÇÕES PADRÃO — use consistentemente

```css
/* Entrada de cards/seções */
@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Escala para dropdowns/modais */
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}

/* Fade simples */
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Pulsação de badges ativos */
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(242,96,32,0.4); }
  70%  { box-shadow: 0 0 0 8px rgba(242,96,32,0); }
  100% { box-shadow: 0 0 0 0 rgba(242,96,32,0); }
}

/* Coração ao curtir */
@keyframes heart-pop {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.4); }
  60%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}
```

**Uso:**
- Staggered para listas: `animation-delay: calc(index * 50ms)`
- Scroll reveal: IntersectionObserver com threshold 0.12
- Não exagerar — 1 animação de entrada por seção, micro-interações no hover

---

## RESPONSIVIDADE — breakpoints

```
mobile:  < 640px  → 1 coluna, navegação bottom bar
tablet:  640-900px → 2 colunas onde aplicável
desktop: > 900px  → layout completo com sidebar
```

- Sidebar sempre oculta em mobile
- Bottom nav (partials/footer) apenas em mobile
- Touch targets mínimos: 44px × 44px
- Textos mínimos: 13px (nunca menor)

---

## ESTRUTURA DE ARQUIVOS ESPERADA

```
views/
├── partials/
│   ├── header.ejs        ← redesenhar
│   ├── footer.ejs        ← redesenhar (bottom nav mobile)
│   └── flash.ejs         ← redesenhar
├── home.ejs              ← landing page
├── feed.ejs              ← feed social
├── perfil.ejs            ← configurações
├── notificacoes.ejs      ← notificações
├── auth/
│   ├── login.ejs
│   ├── registro.ejs
│   ├── esqueci-senha.ejs
│   └── redefinir-senha.ejs
├── explorar/
│   ├── index.ejs         ← explorar geral
│   ├── busca.ejs         ← busca
│   ├── perfil-publico.ejs
│   ├── pet.ejs
│   ├── post.ejs
│   └── perdidos.ejs
├── pets/
│   ├── index.ejs
│   ├── cadastro.ejs
│   ├── editar.ejs
│   └── tag-nfc.ejs
├── petshops/
│   ├── index.ejs
│   └── detalhe.ejs
└── mensagens/
    └── index.ejs
```

---

## INSTRUÇÕES DE EXECUÇÃO PARA O CURSOR

1. Leia todos os arquivos EJS existentes no projeto antes de começar
2. Identifique todas as variáveis EJS (`<%= %>` e `<%- %>`) e preserve-as intactas
3. Preserve todos os `id=""`, `data-*` attributes e classes JS (ex: `.btn-curtir`, `.btn-comentar`) — são usados pelo JavaScript existente
4. Preserve todas as rotas de formulário (`action="/rota"`) e métodos
5. Mantenha toda a lógica EJS (`<% if %>`, `<% forEach %>`, etc)
6. Aplique o design system a CADA view — não pule nenhuma
7. Não remova JavaScript existente — apenas adicione ou ajuste estilos
8. Ao terminar cada view, verifique: body dark? tipografia correta? variáveis CSS? responsivo?
9. Crie os estilos inline `<style>` no topo de cada view ou prefira um arquivo `public/css/design-system.css` importado no header
10. Teste visualmente: nenhuma tela pode ter fundo branco, texto preto puro, ou fonte genérica

---

## CHECKLIST FINAL

Antes de finalizar, confirme que em TODAS as views:

- [ ] Body tem `background: var(--ink)` e `color: var(--text)`
- [ ] Fonte Syne + DM Sans importada e aplicada
- [ ] Não há branco puro (#fff ou white) como fundo de página ou cards
- [ ] Cards usam `var(--ink-2)` com `border: 1px solid var(--border)`
- [ ] Inputs usam `var(--ink-3)` com focus laranja
- [ ] Botão primário é `var(--accent)` com hover `var(--accent-light)`
- [ ] Sticky headers com backdrop-filter blur
- [ ] Estados vazios estilizados
- [ ] Mobile responsivo (bottom nav, 1 coluna)
- [ ] Animações de entrada com slide-up
- [ ] Nenhuma view usa Bootstrap, Material UI ou outro framework visual externo
- [ ] Font Awesome está disponível (já estava no projeto original)
- [ ] Todas as variáveis EJS do projeto original foram preservadas

---

Execute view por view, na ordem: partials → home → auth → feed → perfil → explorar → pets → petshops → notificações → mensagens.
Após cada arquivo, confirme que está funcionando antes de passar para o próximo.
