# Human MVP — Enforcement e Falhas

## Princípio de Enforcement
- Toda regra é mecânica
- Nenhuma regra depende de decisão humana manual
- Falha é preferível a exceção

## Falhas Obrigatórias (hard fail)
- Criar Skill sem categoria → erro
- Criar ServiceOffer sem Skill válida → erro
- Criar Opportunity sem categoria → erro
- Matching sem categoria → erro
- Context inválido → erro
- Permissão insuficiente → erro

## Falhas de Integridade
- Categoria removida → entidades associadas ficam inválidas
- Skill inválida → ServiceOffer automaticamente suspensa
- Opportunity inválida → eventos derivados cancelados

## Proibições Absolutas
- Override manual de categoria
- Criação de agenda manual
- Benefício sem evento executado
- Execução sem registro de evento

## Auditoria
- Toda falha gera evento de auditoria
- Toda tentativa proibida é registrada
- Não existe falha silenciosa

## Comportamento do Sistema
- Sistema não "corrige" erro humano
- Sistema exige ação válida
- Sistema não cria exceções administrativas

## Critério de Aceite
- Qualquer violação interrompe o fluxo
- Nenhuma regra pode ser bypassada
- Enforcement é verificável por testes


