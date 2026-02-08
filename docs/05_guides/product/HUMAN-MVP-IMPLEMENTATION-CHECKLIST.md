# Human MVP — Checklist de Implementação Controlada

## Regra Geral
- Implementar SOMENTE o que já está documentado
- Se algo não estiver nos documentos do MVP, NÃO implementar

## Backend — Checklist
- [ ] Endpoint criar Skill (categoria obrigatória)
- [ ] Endpoint criar ServiceOffer (Skill obrigatória)
- [ ] Endpoint publicar Opportunity (categoria obrigatória)
- [ ] Endpoint listar matching por categoria
- [ ] Todos exigem context + tenant
- [ ] Permissões por context validadas
- [ ] Eventos gerados conforme HUMAN-MVP-FLOWS.md

## Frontend — Checklist
- [ ] Tela declarar habilidade (usa categorias)
- [ ] Tela criar serviço (usa Skill existente)
- [ ] Tela listar oportunidades
- [ ] Nenhuma lógica de negócio no frontend

## Eventos — Checklist
- [ ] SKILL_CREATED
- [ ] SERVICE_OFFER_CREATED
- [ ] OPPORTUNITY_PUBLISHED
- [ ] MATCH_FOUND
- [ ] EVENT_SCHEDULED
- [ ] ACTIVITY_EXECUTED
- [ ] Todos persistidos e auditáveis

## Enforcement — Checklist
- [ ] Falha se categoria inválida
- [ ] Falha se contexto inválido
- [ ] Falha se permissão insuficiente
- [ ] Nenhuma exceção manual

## Proibições Explícitas
- [ ] Não implementar pagamento
- [ ] Não implementar reputação
- [ ] Não implementar chat
- [ ] Não implementar automações extras
- [ ] Não criar endpoints genéricos

## Critério de Conclusão
- Todos os itens marcados
- Nenhum item fora da lista implementado
- MVP executa fluxo humano completo
- Tudo rastreável por eventos


