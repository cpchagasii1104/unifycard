# Human MVP — Entidades e Contratos

## Princípio de Modelagem
- Categorias = linguagem
- Entidades apenas REFERENCIAM categorias
- Nenhuma entidade cria hierarquia própria

## Entidade: PersonProfile
- Representa pessoa física
- Relaciona-se com categorias via habilidades
- Contexts usados: person, professional

## Entidade: Skill
- Sempre vinculada a UMA categoria
- Nunca livre-text
- Não existe skill fora da árvore

## Entidade: ServiceOffer
- Oferta de serviço executável
- Sempre vinculada a Skill
- Context: professional

## Entidade: Opportunity
- Demanda ou oferta de trabalho/atividade
- Sempre vinculada a categoria
- Contexts permitidos: professional, person, interest

## Entidade: EventInstance
- Representa data/hora concreta
- Sempre derivada de Opportunity ou ServiceOffer
- Não existe evento solto

## Entidade: AgendaItem
- Projeção temporal
- Derivada automaticamente
- Não é entidade de negócio primária

## Relações Proibidas
- Entidade sem categoria
- Categoria criada fora do fluxo oficial
- Relação many-to-many sem contexto explícito

## Contrato de Integridade
- Se categoria for removida → entidades órfãs são invalidadas
- Se contexto não bater → operação deve falhar

## Critério de Aceite
- Todas as entidades do MVP referenciam a árvore
- Nenhuma lógica paralela de classificação existe


