---
name: Diagramas Mermaid AIRPET
overview: "Conjunto de diagramas Mermaid que espelham as seções principais de [contexto_do_projeto.md](c:\\Users\\u17789\\Desktop\\vevo\\AIRPET\\contexto_do_projeto.md): arquitetura macro, camadas do backend, domínios de dados, autenticação web/mobile e estado no frontend — prontos para colar em documentação ou visualizadores Mermaid."
todos:
  - id: paste-mermaid
    content: Colar os blocos Mermaid desejados no destino (README, Notion, .md do projeto)
    status: pending
  - id: validate-renderer
    content: Validar no renderizador alvo (mindmap pode exigir fallback 3b)
    status: pending
isProject: false
---

# Diagramas visuais (Mermaid) a partir do contexto AIRPET

Os blocos abaixo podem ser copiados para qualquer renderizador Mermaid (GitHub, Notion, Mermaid Live Editor, extensões VS Code/Cursor).

---

## 1. Arquitetura macro (Seção 1)

```mermaid
flowchart TB
  subgraph clients [Clientes]
    Browser[PWA_Browser_EJS]
    Mobile[App_mobile_API]
  end

  subgraph edge [Edge_Cloudflare]
    Worker[Worker_airpet-edge]
    DO[Durable_Objects_slots]
    Q[Queue_webhook_opcional]
  end

  subgraph monolith [Monolito_Node_Express]
    SSR[SSR_EJS_views]
    API[Rotas_API_sync]
    Sock[Socket_IO_namespaces]
  end

  subgraph data [Dados]
    PG[(PostgreSQL_PostGIS)]
  end

  Browser --> Worker
  Mobile --> Worker
  Worker --> DO
  Worker --> SSR
  Q -.-> monolith
  SSR --> PG
  API --> PG
  Sock --> PG
```

---

## 2. Camadas do backend (Seção 3)

```mermaid
flowchart LR
  R[routes] --> C[controllers]
  C --> S[services]
  S --> M[models]
  M --> DB[(PostgreSQL)]
  MW[middlewares] -.-> R
  MW -.-> C
```

---

## 3. Domínios de entidades (Seção 4)

```mermaid
mindmap
  root((AIRPET_dominio))
    Identidade
      usuarios
      user_sessions
      refresh_tokens
      api_idempotency
    Pet_NFC
      pets
      nfc_tags
      tag_scans
      pets_perdidos
      localizacoes
      conversas
      mensagens_chat
      notificacoes
    Social
      publicacoes
      curtidas
      comentarios
      seguidores
      reposts
      post_stats
    Parceiros
      petshops
      petshop_accounts
      agendamentos
      produtos_servicos
    Metricas
      tabelas_raw_agg
```

*Nota:* `mindmap` exige sintaxe Mermaid com suporte a mindmap; se o renderizador falhar, use o diagrama 3b abaixo.

### 3b. Domínios (alternativa em flowchart)

```mermaid
flowchart TB
  subgraph id [Identidade_Acesso]
    U[usuarios]
    US[user_sessions]
    RT[refresh_tokens]
  end
  subgraph core [Pet_NFC_Recuperacao]
    P[pets]
    NFC[nfc_tags]
    PP[pets_perdidos]
    LOC[localizacoes]
    CHAT[conversas_mensagens]
    N[notificacoes]
  end
  subgraph soc [Social_Feed]
    PUB[publicacoes]
    ENG[curtidas_comentarios_seguidores]
  end
  subgraph par [Parceiros_Petshop]
    PS[petshops_contas]
    AG[agenda_produtos_servicos]
  end
  subgraph met [Metricas]
    MRAW[raw_agg_snapshots]
  end
```

---

## 4. Autenticação: Web vs API mobile (Seção 4)

```mermaid
flowchart TB
  subgraph web [Web_sessao_cookie]
    L[Login_web]
    L --> SESS[req.session.usuario]
    L --> JWT_C[JWT_airpet_token_httpOnly]
    EA[estaAutenticado]
    EA -->|sem_sessao| RESTORE[restaura_sessao_via_cookie_JWT]
    EA -->|falha| REDIR[redirect_/auth/login]
  end

  subgraph api [API_mobile_Bearer]
    ML[POST_mobile-login]
    RF[POST_refresh_rotacao]
    LO[POST_mobile-logout]
    EAA[estaAutenticadoAPI]
    EAA -->|401_JSON| UNAUTH[401_sem_redirect]
  end

  subgraph guards [Autorizacao]
    ADM[apenasAdmin]
    PS_G[guards_petshop_owner_aprovacao]
  end
```

---

## 5. Fluxo resumido: pet perdido (regras centrais)

```mermaid
stateDiagram-v2
  [*] --> pendente: dono_reporta
  pendente --> aprovado: admin_aprova
  pendente --> rejeitado: admin_rejeita
  aprovado --> resolvido: caso_encerrado
  resolvido --> pet_seguro: atualiza_pet
  resolvido --> limpa_chat: encerra_conversas
```

---

## 6. Estado global no frontend (Seção 6)

```mermaid
flowchart LR
  RC[AIRPET_REQ_COORDINATOR]
  SW[AIRPET_SWR_CACHE]
  LD[AIRPET_LOADING]
  OQ[AIRPET_OFFLINE_QUEUE]
  RC --> SW
  SW --> LD
  OQ --> RC
```

---

## 7. Integrações externas (Seção 6)

```mermaid
flowchart LR
  APP[AIRPET_app]
  APP --> NOM[Nominatim_OSM]
  APP --> VIA[ViaCEP]
  APP --> IBG[IBGE_Localidades]
  APP --> RES[Resend_email]
  APP --> R2[Cloudflare_R2_S3]
  APP --> CF[Worker_DO_Queue]
```

---

## Onde isso se ancora no repositório

- Arquitetura e pastas: [contexto_do_projeto.md](c:\Users\u17789\Desktop\vevo\AIRPET\contexto_do_projeto.md) §1, §3.
- Rotas/agregador: `src/routes/index.js`, `src/routes/syncApiRoutes.js`.
- Edge: [workers/airpet-edge/src/index.js](c:\Users\u17789\Desktop\vevo\AIRPET\workers\airpet-edge\src\index.js).

---

## Observações de renderização

- Evite espaços nos IDs de nós Mermaid (já aplicado com underscores).
- Se `mindmap` não renderizar, use o fluxo **3b**.
- Para um único “quadro geral”, combine os diagramas 1 + 2 + 4 em documentação separada por seção.

Nenhuma alteração de ficheiros é necessária: estes diagramas são entregáveis de documentação derivados do markdown existente.
