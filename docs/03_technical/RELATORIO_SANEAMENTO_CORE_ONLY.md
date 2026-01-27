RELATÓRIO — SANEAMENTO DE MIGRATIONS CORE_ONLY

Durante a execução completa das migrations CORE_ONLY, foi identificado
um conjunto de inconsistências históricas no schema, incluindo:

- Assunção incorreta de PKs (uso de `id` onde o contrato real era diferente)
- Sintaxe SQL inválida aceita em versões anteriores
- Ordem incorreta de criação de colunas vs. RLS
- Views com referências ambíguas
- Dados legados inválidos (UUIDs vazios, valores semânticos incorretos)

As inconsistências foram corrigidas seguindo os princípios:
- Não alterar migrations já executadas
- Corrigir apenas migrations pendentes
- Normalizar dados antes de hardening
- Preservar rastreabilidade e causalidade

Após o saneamento:
- Todas as migrations CORE_ONLY executam sem erro
- O schema final reflete os contratos reais
- Nenhuma exceção estrutural foi introduzida

Este documento existe para evitar reintrodução de correções implícitas
ou “limpezas criativas” futuras.