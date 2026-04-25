import {
  H1, H2, H3, Text, Stack, Grid, Row, Card, CardHeader, CardBody,
  Divider, Table, Stat, Pill, Callout, Spacer,
  PieChart,
  useCanvasState,
} from 'cursor/canvas';

type Tab = 'overview' | 'produto' | 'social' | 'ux' | 'arquitetura' | 'seguranca' | 'crescimento' | 'critica';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumo Geral' },
  { id: 'produto', label: 'Produto & Negocio' },
  { id: 'social', label: 'Rede Social' },
  { id: 'ux', label: 'Design & UX' },
  { id: 'arquitetura', label: 'Arquitetura & DevOps' },
  { id: 'seguranca', label: 'Seguranca' },
  { id: 'crescimento', label: 'Crescimento & Monetizacao' },
  { id: 'critica', label: 'Critica Direta' },
];

export default function AirpetAuditoria() {
  const [tab, setTab] = useCanvasState<Tab>('tab', 'overview');

  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Stack gap={4}>
        <H1>Auditoria AIRPET</H1>
        <Text tone="secondary">
          Analise completa — produto, tecnica, UX, crescimento e seguranca.
        </Text>
      </Stack>

      <Row gap={6} wrap>
        {TABS.map(t => (
          <Pill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Pill>
        ))}
      </Row>

      <Divider />

      {tab === 'overview' && <OverviewSection />}
      {tab === 'produto' && <ProdutoSection />}
      {tab === 'social' && <SocialSection />}
      {tab === 'ux' && <UxSection />}
      {tab === 'arquitetura' && <ArquiteturaSection />}
      {tab === 'seguranca' && <SegurancaSection />}
      {tab === 'crescimento' && <CrescimentoSection />}
      {tab === 'critica' && <CriticaSection />}
    </Stack>
  );
}

function OverviewSection() {
  return (
    <Stack gap={24}>
      <H2>Visao Geral do Sistema</H2>
      <Text>
        O AIRPET e um sistema de identificacao de pets via NFC com camada social (feed, seguidores, comentarios),
        loja de tags, mapa, chat, petshops, agenda e alertas de pets perdidos. A ideia central resolve um problema
        real. O produto ja tem substancial implementacao — 65+ modelos, PostGIS, PWA, push, pagamento integrado.
      </Text>

      <H3>Pontuacao por dimensao</H3>
      <Grid columns={4} gap={12}>
        <Stat value="B" label="Conceito de Produto" tone="info" />
        <Stat value="C+" label="UX / Interface" tone="warning" />
        <Stat value="B+" label="Arquitetura Tecnica" tone="info" />
        <Stat value="D+" label="Crescimento Atual" tone="danger" />
        <Stat value="C" label="Monetizacao" tone="warning" />
        <Stat value="C-" label="Seguranca" tone="warning" />
        <Stat value="B-" label="Features Sociais" tone="info" />
        <Stat value="A-" label="Cobertura de Dados" tone="success" />
      </Grid>

      <Callout tone="info" title="O que o AIRPET tem de certo">
        A ideia de unir NFC + rede social de pets e diferenciada. O banco de dados e rico e bem estruturado.
        Ha PWA, push, chat, mapas com PostGIS, loja de tags com pagamento, Worker Cloudflare para edge.
        Isso e muito mais do que a maioria dos concorrentes entrega.
      </Callout>

      <Callout tone="danger" title="Maior problema hoje">
        O produto sofre de featuritis — muitas funcionalidades construidas, mas nenhuma delas polida o suficiente
        para reter um usuario novo. A experiencia de onboarding e fraca, a proposta de valor nao e clara na home,
        e o loop de crescimento viral nao existe.
      </Callout>

      <H3>Top 10 Problemas Criticos</H3>
      <Table
        headers={['#', 'Problema', 'Impacto', 'Prioridade']}
        rows={[
          ['1', 'Onboarding sem clareza — usuario nao entende o que fazer ao entrar', 'Altissimo', 'Urgente'],
          ['2', 'Tela de scan NFC sem fluxo claro para quem encontrou o pet', 'Altissimo', 'Urgente'],
          ['3', 'Admin precisa aprovar alerta de pet perdido — gera delay em emergencia', 'Alto', 'Urgente'],
          ['4', 'Sem loop viral — nao ha mecanismo que faca usuario indicar outro', 'Alto', 'Alta'],
          ['5', 'Stack SSR/EJS limita interatividade do feed social', 'Medio', 'Media'],
          ['6', 'Sem historico de scans visivel ao dono', 'Medio', 'Media'],
          ['7', '.env.example ausente do repositorio', 'Medio', 'Media'],
          ['8', 'Sistema de gamificacao (badges) existe no banco mas nao e exibido', 'Medio', 'Baixa'],
          ['9', 'Petshop e rede social competem pela atencao na mesma interface', 'Medio', 'Media'],
          ['10', 'Sem app nativo — PWA nao funciona em iOS antigo para push', 'Baixo', 'Baixa'],
        ]}
        rowTone={['danger', 'danger', 'danger', 'warning', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral']}
        striped
      />
    </Stack>
  );
}

function ProdutoSection() {
  return (
    <Stack gap={24}>
      <H2>Produto e Logica de Negocio</H2>

      <H3>O conceito faz sentido?</H3>
      <Text>
        Sim. Pets perdidos e um problema enorme no Brasil — estima-se 30 milhoes de animais em situacao de risco.
        A combinacao NFC + perfil digital + rede social cria um ecossistema onde identificar um pet perdido
        pode ser resolvido em segundos. Esse e o nucleo valioso do produto.
      </Text>
      <Text>
        O problema e que o AIRPET tenta ser simultaneamente: sistema de identificacao, rede social,
        marketplace de petshops, agenda, loja de tags e app de saude. Isso dilui o foco e nenhuma area
        fica excepcional.
      </Text>

      <Callout tone="danger" title="Problema central da proposta de valor">
        Um novo usuario que entra no AIRPET hoje nao consegue responder em 10 segundos: "Para que serve isso?"
        A home precisa comunicar UMA coisa: "Cadastre seu pet e nunca mais o perca."
      </Callout>

      <H3>Falhas na Logica de Negocio</H3>
      <Table
        headers={['Area', 'Problema', 'Solucao']}
        rows={[
          [
            'Pet Perdido',
            'Status "pendente" requer aprovacao do admin antes de publicar o alerta',
            'Publicar imediatamente com moderacao pos-publicacao. Cada minuto conta em emergencia.'
          ],
          [
            'Pet Perdido',
            'Nao ha notificacao automatica para usuarios proximos ao pet perdido',
            'Usar PostGIS + push para alertar usuarios em raio de 5km automaticamente'
          ],
          [
            'NFC Scan',
            'Quem escaneia a tag nao tem fluxo claro de "o que fazer agora"',
            'Tela de scan deve ter CTA gigante: ligar para o dono + mapa + foto do local'
          ],
          [
            'Cadastro de pet',
            'Cadastro tem muitos campos opcionais — gera abandono no formulario',
            'Onboarding em 3 passos: foto + nome + raca. Resto depois, no perfil.'
          ],
          [
            'Ativacao de tag',
            'Fluxo de ativacao nao e intuitivo — status "sent" nao e claro para o usuario',
            'Wizard visual de ativacao com codigo simples ou QR code'
          ],
          [
            'Status perdido/encontrado',
            'Dono precisa marcar manualmente como "encontrado" — pode esquecer',
            'Lembrete automatico apos 48h sem atualizacao. Confirmar por SMS/email.'
          ],
          [
            'Transferencia de pet',
            'Nao ha fluxo para adocao ou venda — transferir pet com historico para outro usuario',
            'Implementar fluxo de transferencia de posse preservando historico medico e de scans'
          ],
        ]}
        striped
      />

      <H3>O que esta faltando na regra de negocio</H3>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader>Sistema de recompensas</CardHeader>
          <CardBody>
            <Text>Quem encontra e devolve um pet deveria ganhar pontos, badge ou recompensa.
            Cria incentivo real para escanear tags desconhecidas na rua.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Historico de localizacoes</CardHeader>
          <CardBody>
            <Text>Cada scan de tag deve gerar um ponto no mapa visivel ao dono. Mostra onde o pet foi
            avistado ao longo do tempo — dado invaluavel em situacao de perda.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Verificacao de identidade do pet</CardHeader>
          <CardBody>
            <Text>Qualquer um pode cadastrar qualquer pet. Falta validacao via microchip
            ou documento veterinario para reduzir fraudes e dar credibilidade ao sistema.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>SOS de emergencia</CardHeader>
          <CardBody>
            <Text>Botao de emergencia no app que alerta automaticamente: grupos de WhatsApp da regiao,
            redes sociais do dono e usuarios AIRPET proximos. Tudo de uma vez, em 1 toque.</Text>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}

function SocialSection() {
  return (
    <Stack gap={24}>
      <H2>Estrutura como Rede Social</H2>

      <Text>
        O AIRPET ja tem as tabelas e rotas para um feed social completo: publicacoes, curtidas, comentarios com threads,
        reposts, mencoes, seguidores de usuarios e de pets, gamificacao e trending. A infraestrutura esta la.
        O problema e que nao e claro para o usuario que o app funciona como uma rede social.
      </Text>

      <H3>O que ja existe vs. o que falta</H3>
      <Table
        headers={['Feature', 'Existe?', 'Qualidade', 'Observacao']}
        rows={[
          ['Feed de posts', 'Sim', 'Media', 'Feed existe mas mistura posts com patrocinados sem separacao visual clara'],
          ['Curtidas', 'Sim', 'Ok', 'Funcional'],
          ['Comentarios com threads', 'Sim', 'Ok', 'Tem parent_id — ponto positivo e pouco explorado'],
          ['Reposts', 'Sim', 'Ok', 'Implementado mas pouco visivel na UI'],
          ['Seguir usuarios', 'Sim', 'Ok', 'Funcional'],
          ['Seguir pets', 'Sim', 'Ok', 'Diferencial unico — explorar muito mais'],
          ['Stories / status diario', 'Nao', '---', 'Alta retencao em redes sociais modernas'],
          ['Reacoes multiplas', 'Nao', '---', 'Aumenta engajamento sem exigir comentario'],
          ['Notificacoes em tempo real no feed', 'Parcial', 'Fraca', 'Socket.IO existe mas integracao com feed nao e clara'],
          ['Explorar / discovery de novos pets', 'Sim', 'Media', 'Existe /explorar mas UI nao e atraente o suficiente'],
          ['Ranking / leaderboard visivel', 'Banco existe', 'Invisivel', 'Tabelas de gamificacao nao sao expostas ao usuario'],
          ['Compartilhamento externo', 'Parcial', 'Fraca', 'Alerta de perdido tem link publico. Posts normais nao.'],
          ['DM / chat entre usuarios', 'Sim', 'Media', 'Chat existe mas nao e proeminente na navegacao'],
          ['Grupos por raca ou cidade', 'Nao', '---', 'Aumenta retencao via comunidade especifica'],
        ]}
        rowTone={[
          undefined, undefined, undefined, undefined, undefined, undefined,
          'danger', 'warning', 'warning', 'warning', 'warning', 'warning', 'neutral', 'danger'
        ]}
        striped
      />

      <Callout tone="info" title="O diferencial que ninguem explora">
        "Seguir pets" e uma feature rarissima no mercado e pode ser o viral hook do produto. Um cachorro famoso
        com 50k seguidores no AIRPET e publicidade organica enorme. Perfis de pets como personalidades
        digitais — investir pesado nessa narrativa.
      </Callout>

      <H3>Features de engajamento recomendadas</H3>
      <Grid columns={3} gap={16}>
        <Card>
          <CardHeader>Diario do Pet (Stories)</CardHeader>
          <CardBody>
            <Text>Post diario que some em 24h. Cria habito de abrir o app todo dia.
            A tabela diario_pet ja existe no banco — so falta a UI.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Desafios Semanais</CardHeader>
          <CardBody>
            <Text>"Poste uma foto do seu pet dormindo" — desafios tematicos geram conteudo organico
            e fazem usuarios abrirem o app mesmo sem ter nada novo.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Pet do Mes</CardHeader>
          <CardBody>
            <Text>Votacao mensal para o pet mais popular da plataforma.
            Gera campanha organica, compartilhamento e retencao dos donos.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Mapa Social de Avistamentos</CardHeader>
          <CardBody>
            <Text>Mapa ao vivo mostrando onde pets foram fotografados hoje na cidade.
            Incentiva descoberta de novos pets e locais pet-friendly.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Badges Visiveis no Perfil</CardHeader>
          <CardBody>
            <Text>As tabelas user_gamification e badges existem mas nao aparecem para o usuario.
            Exibir no perfil cria motivacao para completar acoes e engajamento recorrente.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Grupos por Raca</CardHeader>
          <CardBody>
            <Text>Donos de Golden Retriever querem falar entre si. Grupos por raca ou cidade
            aumentam retencao via comunidade de nicho.</Text>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}

function UxSection() {
  return (
    <Stack gap={24}>
      <H2>Design e Experiencia do Usuario</H2>

      <H3>Problemas de UX identificados</H3>
      <Table
        headers={['Problema', 'Onde ocorre', 'Solucao']}
        rows={[
          [
            'Navegacao fragmentada — multiplos menus para funcoes relacionadas',
            'Nav principal',
            'Bottom navigation com 5 icones fixos: Feed, Explorar, Meus Pets, Alertas, Perfil'
          ],
          [
            'Home publica nao converte — usuario nao entende o produto em 10 segundos',
            'Home publica',
            'Hero com video curto de 15s mostrando NFC sendo escaneado + CTA "Proteja seu pet agora"'
          ],
          [
            'Cadastro de pet coleta dados demais no inicio gerando abandono',
            'Cadastro de pet',
            'Wizard de 3 passos: 1-Foto/Nome, 2-Raca/Especie, 3-Vincular tag. Resto depois.'
          ],
          [
            'Tela de scan NFC nao tem clareza — quem achou o pet nao sabe o que fazer',
            'Scan publico (sem login)',
            'CTA gigante: numero do dono em texto legivel, botao de localizacao, botao de foto'
          ],
          [
            'Feed mistura tipos de conteudo sem hierarquia visual clara',
            'Feed principal',
            'Cards distintos por tipo: post social (neutro) vs. alerta perdido (vermelho) vs. petshop (cor de marca)'
          ],
          [
            'Alerta de pet perdido nao tem urgencia visual na listagem',
            'Mapa e feed',
            'Card com borda colorida de alerta, foto grande, nome e numero em destaque'
          ],
          [
            'Perfil de pet nao e atraente como cartao de visita digital',
            'Perfil do pet',
            'Redesenhar como cartao: foto grande, nome, stats (seguidores, posts), botao de contato imediato'
          ],
          [
            'Mapa de pets perdidos sem filtros uteis',
            'Mapa',
            'Filtros: raio de distancia, especie, cor, data de perda. Cluster de marcadores proximos.'
          ],
        ]}
        striped
      />

      <H3>Mockup textual — Tela de Scan NFC ideal</H3>
      <Card>
        <CardHeader>Scan NFC (publica, zero login necessario)</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text weight="semibold">Foto grande do pet ocupa 60% da tela</Text>
            <Text>Nome do pet em fonte grande e legivel — destaque maximo</Text>
            <Text tone="secondary">Raca / Idade / Cor do pelo</Text>
            <Divider />
            <Text weight="semibold">3 acoes primarias (botoes grandes, faceis de tocar com polegar):</Text>
            <Text>[ Ligar para o dono ] — abre discagem direta com o numero</Text>
            <Text>[ Enviar minha localizacao ] — GPS do achador enviado ao dono por push/SMS</Text>
            <Text>[ Tirar foto aqui ] — upload anonimo da situacao atual do pet</Text>
            <Divider />
            <Text tone="secondary" size="small">Nenhum cadastro necessario para ajudar. O achador nao precisa ter conta.</Text>
          </Stack>
        </CardBody>
      </Card>

      <H3>Mockup textual — Home publica ideal</H3>
      <Card>
        <CardHeader>Home (usuario nao logado)</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text weight="semibold">Hero Section — unica mensagem:</Text>
            <Text>Headline: "Proteja seu pet. Em 2 minutos."</Text>
            <Text>Sub: "Cadastre, vincule uma tag NFC e nunca mais perca seu animal."</Text>
            <Text>CTA primario: [ Comece de graca ]  CTA secundario: [ Como funciona — 30s ]</Text>
            <Divider />
            <Text weight="semibold">Social Proof logo abaixo:</Text>
            <Text>X pets cadastrados | Y tags ativas | Z pets encontrados este mes</Text>
            <Divider />
            <Text weight="semibold">Feed publico de pets encontrados recentemente</Text>
            <Text tone="secondary" size="small">Prova social de que o sistema funciona — sem exigir login para ver</Text>
          </Stack>
        </CardBody>
      </Card>

      <H3>Sistema de cores recomendado</H3>
      <Table
        headers={['Contexto', 'Cor recomendada', 'Uso']}
        rows={[
          ['Emergencia / Pet perdido', 'Vermelho ou laranja forte', 'Borda de card, badge, CTA de alerta'],
          ['Pet encontrado / Sucesso', 'Verde', 'Confirmacao, resolucao de caso'],
          ['Acao primaria', 'Cor da marca (azul escuro)', 'Botoes principais, links de navegacao'],
          ['Conteudo social neutro', 'Cinza claro / branco', 'Cards de feed, backgrounds gerais'],
          ['Contexto comercial / Petshop', 'Roxo ou turquesa', 'Diferenciar conteudo comercial do social'],
        ]}
        striped
      />
    </Stack>
  );
}

function ArquiteturaSection() {
  return (
    <Stack gap={24}>
      <H2>Arquitetura, Stack e DevOps</H2>

      <H3>Avaliacao do stack atual</H3>
      <Table
        headers={['Camada', 'Tecnologia atual', 'Nota', 'Comentario']}
        rows={[
          ['Runtime', 'Node.js + Express 5', 'A', 'Solido. Express 5 e moderno e estavel.'],
          ['Views', 'EJS (SSR)', 'C', 'Limita interatividade. Aceitavel para MVP, gargalo a longo prazo.'],
          ['CSS', 'Tailwind CSS 3', 'A', 'Excelente escolha. Consistencia e velocidade de desenvolvimento.'],
          ['Banco de dados', 'PostgreSQL + PostGIS', 'A', 'Otimo para dados geoespaciais. Decisao correta.'],
          ['Autenticacao', 'Session + JWT duplo', 'B', 'Flexivel mas adiciona complexidade de manutencao.'],
          ['Upload / Storage', 'Multer + S3/R2', 'A', 'Correto. R2 da Cloudflare e mais barato que S3 puro.'],
          ['Push notifications', 'web-push VAPID', 'B+', 'Bom. Nao funciona em iOS < 16.4 sem app nativo.'],
          ['Realtime', 'Socket.IO', 'B', 'Ok para chat. SSE seria mais leve para notificacoes simples.'],
          ['Edge / CDN', 'Worker Cloudflare', 'A', 'Excelente para scan de tags com latencia minima global.'],
          ['Migrations', 'node-pg-migrate + baseline', 'B+', 'Baseline idempotente e uma decisao inteligente.'],
        ]}
        rowTone={[undefined, 'warning', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]}
        striped
      />

      <Callout tone="warning" title="Maior risco arquitetural — EJS como gargalo">
        EJS + SSR com JS vanilla vai criar um gargalo de produtividade e UX conforme o produto cresce.
        O feed social precisa de atualizacoes em tempo real, carregamento incremental e componentes reativos.
        Migrar o frontend para React (mantendo Express como API REST) e o passo correto na proxima fase.
        Nao e refatoracao — e divida tecnica que vai custar meses se ignorada.
      </Callout>

      <H3>Banco de dados — pontos de atencao para escala</H3>
      <Table
        headers={['Tabela / Area', 'Problema', 'Recomendacao']}
        rows={[
          ['tag_scans', 'Cresce indefinidamente sem TTL ou particao', 'Particionar por data ou arquivar scans com mais de 1 ano'],
          ['feed_candidate_pool', 'Pool de candidatos sem invalidacao clara', 'TTL explicito ou job de limpeza periodico agendado'],
          ['post_interactions_raw', 'Dados brutos de interacao crescem muito rapido', 'Agregar para tabela de stats periodicamente e descartar raw'],
          ['profile_visits_raw', 'Mesmo problema de crescimento ilimitado', 'Janela deslizante de 30 dias como maximo'],
          ['mensagens_chat', 'Sem paginacao clara de mensagens antigas', 'Cursor-based pagination. Arquivar conversas com mais de 6 meses.'],
          ['user_sessions', 'Sessoes expiradas acumulam na tabela', 'Job de limpeza diario ou TTL nativo do connect-pg-simple'],
        ]}
        striped
      />

      <H3>Para escalar para milhoes de usuarios</H3>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader>Cache agressivo de feed</CardHeader>
          <CardBody>
            <Text>O feed e o maior gargalo de leitura. Redis para cachear os ultimos 50 posts
            de cada usuario. Invalidar ao publicar novo post. Sem isso, cada acesso ao feed
            faz N queries simultaneas no banco.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Fila para operacoes pesadas</CardHeader>
          <CardBody>
            <Text>Push notifications, emails, calculo de trending e alertas regionais
            devem ir para fila (BullMQ + Redis). Nao bloquear o request do usuario
            esperando essas operacoes assincronas.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Replica de leitura no PostgreSQL</CardHeader>
          <CardBody>
            <Text>PostgreSQL suporta replica de leitura. Feed, explorar e mapa devem ler da replica.
            Apenas writes vao para o primario. Isso resolve 80% dos problemas de escala
            sem mudar nada na logica da aplicacao.</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Transformacao de imagem on-the-fly</CardHeader>
          <CardBody>
            <Text>R2 ja e usado para storage. Adicionar Cloudflare Images ou imgproxy
            para servir thumbnails otimizados por dispositivo. Reduz 70% do peso
            das paginas de feed.</Text>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}

function SegurancaSection() {
  return (
    <Stack gap={24}>
      <H2>Seguranca e LGPD</H2>

      <Callout tone="warning" title="Contexto de risco">
        O sistema lida com dados pessoais de usuarios, localizacao de pets (e indiretamente de pessoas),
        dados de saude animal e pagamentos. LGPD se aplica integralmente. Alguns pontos exigem atencao imediata.
      </Callout>

      <H3>Riscos identificados</H3>
      <Table
        headers={['Risco', 'Severidade', 'Detalhe', 'Mitigacao recomendada']}
        rows={[
          [
            'Exposicao de localizacao precisa do achador',
            'Alto',
            'Scan de tag registra coordenada exata — dado sensivel que pode ser abusado',
            'Agregar localizacao em raio de 200m. Nunca expor coordenada exata. Expirar apos 72h.'
          ],
          [
            'Admin path potencialmente previsivel',
            'Alto',
            'ADMIN_PATH configuravel mas pode estar no valor padrao /admin em producao',
            'Randomizar path + rate limit severo + 2FA obrigatorio para admin'
          ],
          [
            'NFC tag clonagem',
            'Medio',
            'Tags NTAG213 padroes sao clonaveis — tag falsa pode fingir ser o pet',
            'Usar tags NTAG424 com UID unico bloqueado ou HMAC de verificacao no backend'
          ],
          [
            'JWT sem rotacao periodica',
            'Medio',
            'airpet_token sem refresh — se vazado, permanece valido por longo tempo',
            'Implementar refresh token com rotacao automatica e blacklist no banco'
          ],
          [
            'Upload sem validacao de magic bytes',
            'Medio',
            'Multer valida MIME declarado — facilmente falsificavel pelo cliente',
            'Validar magic bytes apos upload. Rejeitar SVG (risco de XSS armazenado).'
          ],
          [
            'Chat de visitante com rate limit bypassavel',
            'Medio',
            'Rate limit baseado em IP pode ser contornado com IPs rotativos',
            'CAPTCHA para visitantes apos 3 mensagens + ban por fingerprint de dispositivo'
          ],
          [
            'CSRF — cobertura nao auditada',
            'Medio',
            'Middleware de CSRF existe mas pode nao cobrir todas as rotas criticas',
            'Auditar todas as rotas POST/PUT/DELETE de dados sensiveis para garantir CSRF token'
          ],
        ]}
        rowTone={['danger', 'danger', 'warning', 'warning', 'warning', 'warning', 'warning']}
        striped
      />

      <H3>Checklist LGPD</H3>
      <Table
        headers={['Requisito LGPD', 'Status', 'Acao necessaria']}
        rows={[
          ['Politica de privacidade', 'Pagina existe (/privacidade)', 'Verificar se cobre coleta de localizacao do achador'],
          ['Consentimento explicito para localizacao', 'Nao claro', 'Modal de consentimento no primeiro scan de tag por visitante'],
          ['Direito ao esquecimento', 'Parcial', 'Verificar se exclusao remove dados em S3, logs e tabelas analytics'],
          ['Minimizacao de dados', 'Falha', 'Coletar coordenada exata do achador e dado excessivo — reduzir precisao'],
          ['Notificacao de vazamento', 'Nao implementado', 'Processo de resposta a incidentes precisa existir e estar documentado'],
          ['DPO designado', 'Nao visivel', 'Para produto comercial, obrigatorio acima de certo volume de dados'],
        ]}
        rowTone={[undefined, 'warning', 'warning', 'danger', 'danger', 'warning']}
        striped
      />
    </Stack>
  );
}

function CrescimentoSection() {
  return (
    <Stack gap={24}>
      <H2>Crescimento e Monetizacao</H2>

      <H3>Por que o crescimento esta fraco hoje</H3>
      <Text>
        O AIRPET nao tem um loop viral estruturado. Usuarios entram, cadastram o pet e nao tem motivo
        concreto para trazer outros usuarios. O produto e util individualmente mas nao tem o efeito de rede
        que faz plataformas sociais crescerem organicamente. Cada feature nova que nao gera aquisicao
        e tempo perdido neste momento.
      </Text>

      <H3>Loops de crescimento que precisam existir</H3>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader>Loop 1 — Pet Perdido Viral</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text weight="semibold">Fluxo:</Text>
              <Text>Dono perde pet → compartilha alerta no WhatsApp com 1 toque → amigos abrem link sem login →
              alguns se cadastram para ajudar → cadastram seus proprios pets.</Text>
              <Text tone="secondary" size="small">
                Este e o loop mais poderoso. Cada pet perdido pode trazer 5 a 20 novos usuarios.
                O link publico precisa funcionar com zero fricao.
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Loop 2 — Tag NFC como Marketing Ambulante</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text weight="semibold">Fluxo:</Text>
              <Text>Pessoa ve cachorro na rua com tag → escaneia por curiosidade →
              ve perfil do pet + rede social → se cadastra porque quer isso para o seu pet.</Text>
              <Text tone="secondary" size="small">
                A tag NFC e um outdoor ambulante. Cada pet com tag ativa e um agente de aquisicao organico.
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Loop 3 — Conteudo Social Exportavel</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text weight="semibold">Fluxo:</Text>
              <Text>Usuario posta foto do pet → compartilha no Instagram/TikTok com watermark "via AIRPET" →
              pessoas clicam no perfil do pet → baixam o app.</Text>
              <Text tone="secondary" size="small">
                Exige compartilhamento facil com link rico (Open Graph) e watermark opcional.
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Loop 4 — Referral B2B2C via Petshop</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text weight="semibold">Fluxo:</Text>
              <Text>Petshop parceiro indica AIRPET para clientes → clientes ganham desconto na tag →
              petshop ganha clientes via plataforma → ciclo se repete.</Text>
              <Text tone="secondary" size="small">
                Sistema de referrals ja existe no banco. Monetizar esse canal e questao de ativar.
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <H3>Estrategias de marketing com maior ROI</H3>
      <Table
        headers={['Canal', 'Acao', 'Custo', 'Potencial']}
        rows={[
          ['WhatsApp', 'Mensagem pre-formatada ao compartilhar alerta de pet perdido', 'Zero', 'Altissimo'],
          ['TikTok / Reels', 'Video "escaneei a tag de um cachorro perdido" — conteudo organico', 'Baixo', 'Altissimo'],
          ['Veterinarios', 'Parceria: vet recomenda tag AIRPET na consulta como item de seguranca', 'Medio', 'Alto'],
          ['Pet shops fisicas', 'Expor tags NFC fisicamente na loja com QR de cadastro', 'Medio', 'Alto'],
          ['SEO', '"pet perdido em [cidade]" — alertas publicos indexaveis pelo Google', 'Baixo', 'Medio'],
          ['Grupos Facebook/WhatsApp', 'Auto-post de alertas em grupos de pets da regiao configurada', 'Zero', 'Alto'],
        ]}
        striped
      />

      <H3>Modelo de monetizacao</H3>
      <Grid columns={2} gap={20}>
        <Stack gap={8}>
          <H3>O que FUNCIONA</H3>
          <Table
            headers={['Modelo', 'Justificativa']}
            rows={[
              ['Venda de tags NFC fisicas', 'Core do produto. Margem boa. Cliente paga uma vez, usa por anos.'],
              ['Assinatura Pet Premium', 'Historico ilimitado, alertas prioritarios, perfil verificado, analytics.'],
              ['Petshop SaaS', 'Petshops pagam para ter painel, agenda e visibilidade no app.'],
              ['Tags personalizadas com design', 'Tag com foto do pet ou nome gravado — premium cosmético de alto valor.'],
              ['Plano familia (multi-pets)', 'Desconto para quem tem 3+ pets — aumenta LTV do usuario.'],
            ]}
            striped
          />
        </Stack>
        <Stack gap={8}>
          <H3>O que NAO FUNCIONA</H3>
          <Table
            headers={['Modelo', 'Problema']}
            rows={[
              ['Publicidade de terceiros no feed', 'Destroi UX. Usuarios de pet nao toleram ads intrusivos em conteudo emocional.'],
              ['Cobrar por alerta de pet perdido', 'Antiético e destroi a proposta de valor central do produto.'],
              ['Assinatura so para cadastrar pet', 'Freemium mal calibrado. Cadastro basico deve ser sempre gratuito.'],
              ['Marketplace de adocao pago', 'Mercado saturado e muito sensivel. Alto risco de imagem negativa.'],
            ]}
            striped
          />
        </Stack>
      </Grid>

      <H3>Distribuicao de receita recomendada</H3>
      <PieChart
        data={[
          { label: 'Venda de tags fisicas (incluindo personalizadas)', value: 45 },
          { label: 'Assinaturas Premium de usuarios', value: 25 },
          { label: 'Petshop SaaS (painel + agenda)', value: 20 },
          { label: 'Outros (referrals, parceiros)', value: 10 },
        ]}
      />
    </Stack>
  );
}

function CriticaSection() {
  return (
    <Stack gap={24}>
      <H2>Critica Direta — Sem Rodeios</H2>

      <Callout tone="danger" title="Problemas graves que precisam ser resolvidos agora">
        <Stack gap={12}>
          <Stack gap={4}>
            <Text weight="semibold">1. O produto tenta ser tudo e nao e nada direito.</Text>
            <Text>Ha rota para: rede social, petshop, agenda, loja, mapa, saude, chat, NFC, notificacoes.
            Nenhuma dessas areas esta polida o suficiente para impressionar um usuario novo.
            Um produto com 3 features excelentes bate um com 15 features mediocres toda vez.</Text>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text weight="semibold">2. Alerta de pet perdido aguarda aprovacao de admin. Isso e inaceitavel.</Text>
            <Text>Se alguem perde um cachorro as 2h da manha, o alerta fica pendente ate um admin acordar.
            Isso nao pode existir em um produto que se posiciona como sistema de seguranca de pets.
            Publique imediatamente e modere depois. A urgencia e o produto.</Text>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text weight="semibold">3. O stack EJS esta te limitando e voce ainda nao percebeu o custo.</Text>
            <Text>EJS com JS vanilla funciona para CRUD simples. Para uma rede social com feed em tempo real,
            notificacoes ao vivo, carregamento incremental de posts e transicoes fluidas, voce esta
            lutando contra a ferramenta. Isso e divida tecnica que vai custar meses de retrabalho
            se nao for endereçada na proxima fase de produto.</Text>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text weight="semibold">4. Nao ha diferenca percebida entre gratuito e premium.</Text>
            <Text>O usuario nao consegue entender facilmente o que ganha ao pagar. O paywall precisa
            ser claro, sentido como vantagem — nao como bloqueio artificial de funcoes que ja existem.</Text>
          </Stack>
        </Stack>
      </Callout>

      <Callout tone="warning" title="Problemas medios que corroem a qualidade">
        <Stack gap={12}>
          <Stack gap={4}>
            <Text weight="semibold">5. A tela de scan NFC e a mais importante do produto e nao e tratada assim.</Text>
            <Text>Essa e a tela que um desconhecido ve na rua ao encontrar um pet perdido.
            Ela precisa funcionar offline (fallback), carregar em menos de 1 segundo,
            mostrar o numero de telefone em texto legivel gigante e ter um botao de localizacao
            que funciona no primeiro toque, sem cadastro.</Text>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text weight="semibold">6. Feed social sem personalidade e sem conexao emocional.</Text>
            <Text>Posts aparecem como fotos soltas. O usuario nao sabe quem sao os pets.
            Um feed bom cria apego aos animais que aparecem. Isso exige perfis ricos,
            historias, contexto — nao apenas imagens em grid.</Text>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text weight="semibold">7. Gamificacao construida, invisivel, desperdicada.</Text>
            <Text>Voce construiu tabelas de badges e gamificacao mas nao as exibe ao usuario.
            Isso e um crime de UX. Cada badge conquistada e um momento de celebracao.
            Cada conquista exibida no perfil e um motivo para o usuario voltar. Use isso agora.</Text>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text weight="semibold">8. .env.example ausente do repositorio.</Text>
            <Text>Um desenvolvedor novo nao consegue configurar o projeto sem pedir ajuda.
            Isso nao e detalhe — e fricao que impede contribuicoes, onboarding de equipe
            e qualquer possibilidade de open source no futuro.</Text>
          </Stack>
        </Stack>
      </Callout>

      <Callout tone="success" title="O que esta genuinamente bom — preserve isso">
        O banco de dados e completo e bem pensado: PostGIS para localizacao, estrutura social rica,
        historico de scans, gamificacao, referrals. A decisao de usar R2 + Cloudflare Worker para edge e
        inteligente e economica. O sistema de petshop com agenda e painel e uma oportunidade B2B real.
        A base esta la — o trabalho agora e polimento, foco e ativacao do que ja foi construido.
        Nao construir mais features novas antes de polir as que existem.
      </Callout>

      <H3>Roadmap recomendado — proximos 90 dias</H3>
      <Table
        headers={['Periodo', 'Foco', 'Entregaveis principais']}
        rows={[
          [
            'Dias 1-30',
            'Fundacao critica',
            '1. Tela de scan NFC redesenhada (funciona sem login, sem internet, com CTA claro). 2. Alerta de pet perdido sem aprovacao previa. 3. Onboarding de 3 passos. 4. .env.example criado.'
          ],
          [
            'Dias 31-60',
            'Loop viral',
            '1. Compartilhamento de alerta no WhatsApp com link rico e um toque. 2. Notificacao regional automatica ao reportar pet perdido. 3. Badges visiveis no perfil. 4. Historico de scans para o dono.'
          ],
          [
            'Dias 61-90',
            'Engajamento',
            '1. Diario do Pet (Stories com 24h). 2. Desafio semanal de foto. 3. Feed com separacao visual por tipo de conteudo. 4. Loop de referral de petshop ativado. 5. Explorar secao de pets em destaque.'
          ],
        ]}
        rowTone={['danger', 'warning', 'info']}
      />
    </Stack>
  );
}
