# CHECKLIST — ALTERAÇÃO DE CATEGORIAS

## Status
ATIVO • OBRIGATÓRIO • ALTO RISCO

Este checklist deve ser utilizado
ANTES de qualquer alteração relacionada a categorias,
incluindo criação, edição, exclusão, merge, seed, importação ou IA.

Se qualquer item falhar → **NÃO PROSSIGA**.

---

## 1. NATUREZA DA ALTERAÇÃO

- [ ] Estou alterando CATEGORIA (estrutura semântica)?
- [ ] Não estou confundindo categoria com:
  - feature
  - ferramenta (ex: agenda)
  - domínio (marketplace, services, etc.)
  - agrupamento de UI

Categoria NÃO é conveniência visual.

---

## 2. NECESSIDADE REAL

- [ ] Existe justificativa clara para alterar a árvore?
- [ ] A alteração NÃO é apenas para “facilitar navegação”?
- [ ] A alteração NÃO resolve um problema que deveria ser resolvido em outro lugar?

Se não houver necessidade estrutural → **NÃO ALTERE**.

---

## 3. SSOT (REGRA INEGOCIÁVEL)

- [ ] Existe UM único caminho canônico de leitura?
- [ ] Tree, Search e Autocomplete usam o MESMO serviço?
- [ ] Nenhuma lógica paralela está sendo criada?
- [ ] Index, cache ou seed são DERIVADOS, nunca fonte?

Qualquer violação disso quebra SSOT.

---

## 4. CONTEXT

- [ ] `context` é explícito e obrigatório
- [ ] NÃO existe fallback
- [ ] NÃO existe inferência
- [ ] Alteração NÃO cria novo `context`

Context errado → árvore errada.

---

## 5. DOMAIN (SE APLICÁVEL)

- [ ] `domain` está sendo usado apenas como metadata
- [ ] `domain` NÃO altera estrutura da árvore
- [ ] Não existe mistura silenciosa de domínios

Se domain muda a árvore → erro conceitual.

---

## 6. IMPACTO TRANSVERSAL

- [ ] Avaliei impacto em:
  - busca
  - navegação
  - autocomplete
  - IA
  - seeds
  - migrations
- [ ] A alteração NÃO quebra consistência histórica

Categoria é infraestrutura compartilhada.

---

## 7. FRONTEND × BACKEND

- [ ] Frontend NÃO contém lógica própria de categorias
- [ ] Backend é a única fonte de verdade
- [ ] Nenhuma “correção” é feita no frontend

UI não manda na ontologia.

---

## 8. USO DE IA

- [ ] IA foi instruída a NÃO criar categorias livremente
- [ ] Prompt canônico foi utilizado
- [ ] IA NÃO inferiu categoria a partir de texto solto

IA sugere, humano decide.

---

## 9. TESTES E VALIDAÇÃO

- [ ] Testes de navegação vs busca continuam passando
- [ ] Não existem categorias “fantasma”
- [ ] A alteração é reversível

Se não é reversível, é perigoso.

---

## 10. DOCUMENTAÇÃO

- [ ] Alteração está documentada no local correto
- [ ] SSOT_Categorias_UnifiCard.md continua válido
- [ ] Nenhuma regra canônica foi violada

Documento errado hoje = bug amanhã.

---

## 11. CONFIRMAÇÃO FINAL

- [ ] Todos os itens acima foram verificados
- [ ] Não houve exceção “só dessa vez”
- [ ] Não houve atalho “temporário”

Se tudo estiver marcado → **PODE PROSSEGUIR**.

---

## REGRA FINAL

> Categorias são infraestrutura semântica.
> Mexer nelas sem rigor cria bugs invisíveis.

Fim.
