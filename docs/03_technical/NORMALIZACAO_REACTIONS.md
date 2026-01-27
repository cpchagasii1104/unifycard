CONTEXTO INSTITUCIONAL — NORMALIZAÇÃO TARDIA DE LEGADO (REACTIONS)

A tabela `reactions` foi criada originalmente pela migration 050 com um
contrato estrutural legado, sem as colunas:
- entity_type
- entity_id
- user_id
- actor_id

Posteriormente, a migration 160_create_reactions.sql assumiu implicitamente
um contrato canônico mais recente para `reactions`, o que causou falha
estrutural quando executada em ambientes CORE_ONLY.

As migrations 159a, 159b e 159c NÃO introduzem nova feature.
Elas executam exclusivamente uma NORMALIZAÇÃO ESTRUTURAL tardia,
alinhando o legado ao contrato esperado pela migration 160.

Essas migrations existem para:
- preservar rastreabilidade
- evitar edição retroativa da migration 160
- garantir causalidade explícita
- impedir correções implícitas futuras

A partir deste ponto, a estrutura de `reactions` deve ser considerada
CANÔNICA e qualquer nova migration deve assumir esse contrato.
