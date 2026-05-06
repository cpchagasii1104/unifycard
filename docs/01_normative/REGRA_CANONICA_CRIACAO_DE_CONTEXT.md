# REGRA CANÔNICA — CRIAÇÃO DE CONTEXT

## Status
NORMATIVO • CANÔNICO • VINCULANTE

## Contexto

Este documento estabelece as regras canônicas para criação e uso de `context` (CategoryContext) no ecossistema UnifiCard, garantindo que a árvore semântica não seja fragmentada por decisões informais ou fallbacks.

---

## PRINCÍPIO

`context` é um atributo canônico que define o domínio semântico de uma categoria. Cada `context` representa uma ontologia distinta e não intercambiável. A criação de novos `context` deve ser excepcional e justificada por necessidade ontológica, não por conveniência técnica ou fragmentação de domínio.

---

## REGRAS PERMITIDAS

1. **Criação de novo `context` é permitida APENAS quando:**
   - Representa uma ontologia distinta e não intercambiável com contexts existentes
   - Não pode ser representada por metadata ou filtros sobre contexts existentes
   - É aprovada por decisão institucional formal registrada em `/docs/02_decisions/`
   - A decisão declara explicitamente a justificativa ontológica

2. **Uso de `context` existente é permitido quando:**
   - O domínio semântico corresponde exatamente a um `context` canônico existente
   - O `context` é fornecido explicitamente, sem fallback ou default
   - O `context` é obrigatório em todos os pontos de entrada (endpoints, serviços, funções)

---

## REGRAS PROIBIDAS

1. **É PROIBIDO criar novo `context` quando:**
   - Pode ser representado por metadata ou filtros sobre contexts existentes
   - É apenas uma variação ou subcategoria de um `context` existente
   - É criado para resolver problemas técnicos ou de implementação
   - É criado sem decisão institucional formal

2. **É PROIBIDO usar `context` com:**
   - Fallback implícito (ex: `context || 'professional'`)
   - Default em parâmetros (ex: `context: CategoryContext = 'professional'`)
   - Hardcode em lógica de negócio (ex: `const context = 'professional'`)
   - Inferência ou dedução silenciosa
   - Cast forçado sem validação (ex: `context as CategoryContext`)

3. **É PROIBIDO usar `context` para:**
   - Representar domínios que devem usar metadata (ex: marketplace_domain, taxonomy)
   - Representar estados temporários ou transacionais
   - Representar filtros ou visões sobre o mesmo domínio semântico

---

## PROCESSO DE DECISÃO

1. **Autoridade Decisória:**
   - A decisão de criar novo `context` é de natureza institucional
   - Deve ser registrada em documento formal em `/docs/02_decisions/`
   - O documento deve conter: justificativa ontológica, impacto arquitetural, e aprovação institucional

2. **Critérios de Aprovação:**
   - Representa ontologia distinta e não intercambiável
   - Não pode ser resolvido por metadata ou filtros
   - Não fragmenta a árvore semântica existente
   - Justificativa ontológica explícita e documentada

3. **Registro Obrigatório:**
   - Toda criação de novo `context` deve ser registrada em ADR em `/docs/02_decisions/`
   - O ADR deve referenciar este documento normativo
   - O ADR deve declarar explicitamente a justificativa ontológica

---

## VIOLAÇÃO E CONSEQUÊNCIA

1. **Violação de Regras Proibidas:**
   - Criação informal de `context` sem decisão institucional formal
   - Uso de fallback, default ou hardcode de `context`
   - Uso de `context` para domínios que devem usar metadata

2. **Consequência:**
   - Violação constitui desvio arquitetural grave
   - Código que viola estas regras deve ser corrigido antes de merge
   - Decisões de criar `context` sem processo formal são nulas

---

**Data de criação:** 2026-01-22
**Status:** NORMATIVO • CANÔNICO • VINCULANTE

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->