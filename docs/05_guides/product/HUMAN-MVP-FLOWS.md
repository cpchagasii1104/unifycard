# Human MVP — Fluxos de Dados e Eventos

## Regra Geral
- Todo fluxo começa em uma ação humana
- Toda ação gera evento rastreável
- Nenhum fluxo cria dados fora da árvore

## Fluxo A — Cadastro de Habilidade
- Input: PersonProfile + Categoria
- Validação: categoria existe + context permitido
- Evento gerado: SKILL_CREATED
- Resultado: Skill ativa e indexada

## Fluxo B — Criação de Serviço
- Input: Skill + dados mínimos do serviço
- Validação: Skill válida + context professional
- Evento gerado: SERVICE_OFFER_CREATED
- Resultado: ServiceOffer disponível para matching

## Fluxo C — Publicação de Oportunidade
- Input: Categoria + origem (pessoa, sistema, governo)
- Validação: permissão por tenant/context
- Evento gerado: OPPORTUNITY_PUBLISHED
- Resultado: Opportunity ativa

## Fluxo D — Matching
- Trigger: OPPORTUNITY_PUBLISHED
- Regra: matching por categoria + context
- Evento gerado: MATCH_FOUND
- Resultado: candidatos notificados

## Fluxo E — Agendamento
- Trigger: MATCH_FOUND aceito
- Regra: gera EventInstance
- Evento gerado: EVENT_SCHEDULED
- Resultado: AgendaItem criado automaticamente

## Fluxo F — Execução
- Trigger: data/hora atingida
- Evento gerado: ACTIVITY_EXECUTED
- Resultado: atividade concluída (ou não)

## Fluxos Proibidos
- Matching sem categoria
- Evento sem origem
- Agenda criada manualmente
- Atividade sem evento

## Contrato de Consistência
- Se categoria mudar → reindexar
- Se permissão revogada → fluxo falha
- Se contexto inválido → erro imediato

## Critério de Aceite
- Todo fluxo termina em evento
- Todo evento é rastreável
- Não existe fluxo implícito ou silencioso


