# Roadmap de Implementação - Petshops Parceiros

## Fase 1 - Fundação de dados e autenticação
- Criar tabelas de onboarding, conta própria de petshop, perfil, posts, produtos, seguidores, avaliações, agenda avançada e alertas de recuperação.
- Habilitar autenticação do parceiro via `petshop_accounts` e sessão dedicada (`req.session.petshopAccount`).
- Validar geodados e upload de mídia no onboarding.

## Fase 2 - Onboarding e moderação administrativa
- Publicar formulário público de parceria em `/parceiros/cadastro`.
- Criar fila de análise no admin em `/admin/petshops/solicitacoes`.
- Implementar ações: aprovar, rejeitar, colocar em análise e suporte.

## Fase 3 - Perfil público e descoberta
- Evoluir página pública para formato marketplace social:
  - capa, KPIs, seguidores, avaliações, produtos e posts.
- Disponibilizar mapa dedicado com todos os parceiros em `/petshops/mapa`.
- Habilitar seguir petshop e envio de avaliação por estrelas.

## Fase 4 - Publicações, produtos e promoções
- Permitir postagens normais no feed do perfil do petshop.
- Tratar `produto` e `promocao` fora do feed comum e no catálogo comercial.
- Aplicar limite de 15 produtos ativos por parceiro.
- Moderar apenas promoções (status `pendente` para aprovação admin).

## Fase 5 - Agenda e vínculo pet ↔ petshop
- Estruturar serviços e regras semanais do parceiro.
- Criar e atualizar agendamentos com status (`pendente`, `aceito`, `recusado`, `concluido`).
- Manter vínculo pet-petshop para elegibilidade de promoções e suporte.

## Fase 6 - Integração recuperação (pets perdidos + NFC)
- Ao aprovar/escalar alerta de pet perdido, disparar trilha de petshops próximos (`petshop_lost_pet_alerts`).
- No scan NFC, sugerir petshop parceiro mais próximo e destacar CTA de apoio.
- Registrar auditoria de notificações para rastreio operacional.

## Fase 7 - Qualidade, operação e escala
- Monitorar métricas de conversão (cadastro > aprovação > engajamento).
- Criar testes de integração para fluxos críticos:
  - aprovação de parceiro,
  - moderação de promoção,
  - limite de produtos,
  - sugestão de petshop no NFC,
  - notificação por proximidade em pet perdido.
- Revisar política de segurança de upload e retenção de dados (LGPD).

## Checklist de validação profissional
- Índices geoespaciais e paginação aplicados.
- Fluxos com mensagens claras de erro/sucesso.
- Moderação auditável para decisões administrativas.
- Sessão de parceiro isolada da sessão de tutor/admin.
- UX consistente entre feed, perfil público, mapa e painel parceiro.
