---
name: Checklist operacional segurança
overview: Levantar o que falta para o AIRPET rodar após clone do GitHub e priorizar correções de segurança essenciais (incluindo .env e proteção contra SQL Injection/CSRF).
todos:
  - id: env-template
    content: Criar e versionar .env.example + ajustar .gitignore
    status: pending
  - id: bootstrap-docs
    content: Documentar bootstrap local e variáveis por ambiente
    status: pending
  - id: csrf-session
    content: Implementar CSRF e endurecer cookies/sessão
    status: pending
  - id: sql-review
    content: Revisar SQL dinâmico e formalizar checklist anti-injection
    status: pending
  - id: critical-routes-audit
    content: Auditar rotas de risco alto e padronizar uploads
    status: pending
isProject: false
---

# Plano para colocar o AIRPET no ar com segurança

## 1) Corrigir configuração base ausente no repositório

- Criar e versionar um arquivo modelo de ambiente `[C:/Users/u17789/Desktop/vevo/AIRPET/.env.example](C:/Users/u17789/Desktop/vevo/AIRPET/.env.example)` com todas as chaves mínimas detectadas em `server.js` e módulos de serviço.
- Ajustar `[C:/Users/u17789/Desktop/vevo/AIRPET/.gitignore](C:/Users/u17789/Desktop/vevo/AIRPET/.gitignore)` para **não** ignorar `.env.example` (manter ignorado apenas `.env`).
- Incluir no modelo as variáveis obrigatórias já validadas em `[C:/Users/u17789/Desktop/vevo/AIRPET/server.js](C:/Users/u17789/Desktop/vevo/AIRPET/server.js)`: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `SESSION_SECRET`, `JWT_SECRET`.

## 2) Fechar lacunas de inicialização local/prod

- Validar fluxo padrão: `npm install`, `npm run db:migrate`, `npm run dev` com PostgreSQL ativo.
- Criar documentação curta de bootstrap (README) com pré-requisitos e ordem de execução.
- Confirmar variáveis opcionais por feature (email, push, storage R2) para o sistema subir mesmo sem integrações não críticas.

## 3) Endurecer segurança de formulários e sessão

- Implementar proteção CSRF (token em formulários SSR + validação em rotas mutáveis), pois hoje existe comentário explícito de lacuna em `[C:/Users/u17789/Desktop/vevo/AIRPET/src/app.js](C:/Users/u17789/Desktop/vevo/AIRPET/src/app.js)`.
- Revisar cookies de sessão (`httpOnly`, `secure`, `sameSite`) em `[C:/Users/u17789/Desktop/vevo/AIRPET/src/config/session.js](C:/Users/u17789/Desktop/vevo/AIRPET/src/config/session.js)` para produção.
- Definir CSP mais restritiva (evitar `unsafe-inline`) e migrar gradualmente scripts inline.

## 4) Consolidar proteção contra SQL Injection

- Manter padrão atual de queries parametrizadas via `[C:/Users/u17789/Desktop/vevo/AIRPET/src/config/database.js](C:/Users/u17789/Desktop/vevo/AIRPET/src/config/database.js)` (`$1`, `$2`, ...).
- Revisar pontos com SQL dinâmico em `[C:/Users/u17789/Desktop/vevo/AIRPET/src/models/Usuario.js](C:/Users/u17789/Desktop/vevo/AIRPET/src/models/Usuario.js)` garantindo whitelist de colunas e placeholders (sem interpolar entrada direta de usuário).
- Criar checklist de PR: “sem concatenação de input do usuário em SQL”.

## 5) Priorizar páginas/rotas sensíveis para auditoria

- Auditar primeiro rotas de risco alto já mapeadas em `[C:/Users/u17789/Desktop/vevo/AIRPET/docs/qa/route-inventory.md](C:/Users/u17789/Desktop/vevo/AIRPET/docs/qa/route-inventory.md)`:
  - autenticação (`/auth/login`, `/auth/registro`, `/auth/redefinir-senha/:token`),
  - admin (`/login`, `/usuarios`, `/petshops/`*, `/tags/admin/`*),
  - perfil segurança (`/perfil/seguranca`).
- Em uploads (`multer`), padronizar validação de mime/type, tamanho e extensão em um middleware único reutilizável.

## Resultado esperado

- Projeto sobe sem “config faltando” após clone.
- Segurança mínima de produção ativa (CSRF, sessão, CSP inicial).
- Política clara anti-SQL Injection e foco de auditoria nas páginas críticas.

