# ADR: Aba Profissional — Carregamento da Árvore Profissional

## Status
APROVADO

## Contexto
- Aba Pessoal funciona corretamente após correções de bootstrap
- Aba Profissional falha quando tenta acessar dados sem árvore carregada
- Existe endpoint canônico: GET /categories/tree?context=professional
- tenantId é resolvido via JWT antes do bootstrap
- Não existe garantia de perfil profissional criado
- Não existe dependência legítima de actor para esta aba

## Decisão
- A árvore profissional é INDEPENDENTE do perfil profissional
- A árvore profissional NÃO depende de:
  - actor
  - social
  - feed
  - perfil profissional existente
- A árvore profissional DEVE ser carregada:
  - após tenantId resolvido
  - ao entrar na aba Profissional
  - usando obrigatoriamente context='professional'

## Regras
- Proibido fallback silencioso
- Proibido inventar categorias
- Proibido exigir actor
- Proibido bloquear UI por ausência de perfil profissional

## Escopo
- Apenas definição do modelo canônico da aba Profissional
- Nenhuma alteração de código neste ADR

## Critério de sucesso
- Aba Profissional sempre exibe a árvore correta quando tenantId é válido
- Perfil profissional pode ou não existir sem quebrar a aba
- Erro "Tenant ID não encontrado" não ocorre neste fluxo

## Referências
- SSOT_Categorias_UnifiCard.md
- golden_path.md
- AUDITORIA_ARQUITETURAL_UNIFYCARD_2026.md

