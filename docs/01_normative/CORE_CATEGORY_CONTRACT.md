Status: CORE
Domain: Categories
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Scope: Category System Governance

# CORE_CATEGORY_CONTRACT.md
## Contrato Fundacional — Sistema de Categorias do UnifiCard

Este documento define o **CORE DO SISTEMA DE CATEGORIAS** do UnifiCard.

Ele estabelece **o que categorias são**, **o que NÃO são**, **onde podem ser usadas** e **quais decisões estão explicitamente proibidas** de depender de categorias.

Se qualquer proposta, código, decisão de produto ou sugestão de IA conflitar com este contrato → **RECUSAR**.

---

## 1) Definição Canônica

**Categoria** é um **atributo descritivo**, utilizado exclusivamente para:

- classificação
- organização
- navegação
- agrupamento semântico
- filtragem
- descoberta
- analytics descritivo

Categoria **NÃO é**:
- regra de negócio
- política de decisão
- fator financeiro
- critério de permissão
- gatilho de comportamento automático

---

## 2) Regra de Ouro (Inquebrável)

> **Categorias descrevem. Categorias NÃO decidem.**

Qualquer uso de categoria que:
- altere preço
- altere split
- altere permissão
- altere visibilidade obrigatória
- altere fluxo automaticamente

é **institucionalmente inválido**.

---

## 3) Proibição de Categoria como Fonte de Verdade

É terminantemente proibido usar categoria como:

- fonte de decisão
- fallback de lógica
- heurística de negócio
- proxy de tipo
- substituto de policy
- mecanismo de inferência

Categoria **nunca** é “fonte de verdade”.

---

## 4) Usos Permitidos (Exclusivamente)

Categorias podem ser usadas **somente** para:

1. **UI / UX**
   - menus
   - filtros
   - listagens
   - agrupamentos visuais

2. **Busca e descoberta**
   - indexação
   - facetas
   - autocomplete
   - recomendação **não vinculante**

3. **Analytics descritivo**
   - relatórios
   - dashboards
   - métricas agregadas
   - segmentação observacional

📌 Em todos os casos:
> Categoria é **read-only sem efeito colateral**.

---

## 5) Usos Explicitamente Proibidos

Categorias **NÃO PODEM**:

- definir preço
- definir taxa
- definir split financeiro
- conceder ou negar permissão
- desbloquear funcionalidades
- disparar automações
- substituir `productType`, `serviceType` ou `policy`

Se isso for necessário, **categoria é o modelo errado**.

---

## 6) Separação Obrigatória de Domínios

### Categoria ≠ Tipo

- **Tipo** (`productType`, `serviceType`, `eventType`)  
  → pode influenciar lógica (via policy)

- **Categoria**  
  → apenas descreve

Nunca confundir os dois.

---

## 7) Integração com Outros Domínios

### Financeiro
- Categorias **NUNCA** influenciam:
  - preço
  - taxa
  - split
  - estorno
- Qualquer variação financeira usa **policy explícita**, nunca categoria.

### Temporal
- Categorias **NUNCA** criam:
  - disponibilidade
  - bloqueios
  - janelas
- Agenda Universal ignora categorias.

### Permissões / Identity
- Categorias **NUNCA** concedem:
  - acesso
  - papel
  - escopo
- Permissões vêm de contratos de identidade.

---

## 8) Anti-Heurística e Safety (IA + Humanos)

É proibido:

- “inferir” comportamento a partir de categoria
- assumir semântica implícita
- usar categoria como atalho de decisão
- criar lógica do tipo:
  - “se categoria X então faz Y”

Categorias **não carregam semântica operacional**.

---

## 9) Checklist de Validação (Obrigatório)

Antes de aprovar qualquer uso de categoria, responder:

- [ ] Categoria está sendo usada apenas para descrição?
- [ ] Não influencia decisão, preço, permissão ou fluxo?
- [ ] Não substitui tipo ou policy?
- [ ] Não cria efeito colateral?

Se alguma resposta for “não” → **uso inválido**.

---

## 10) Precedência Institucional

Este contrato prevalece sobre:

- decisões de produto
- conveniências de implementação
- sugestões de IA
- heurísticas de crescimento
- atalhos técnicos

Se houver conflito:
➡️ corrige-se a proposta  
➡️ **NUNCA o contrato**

---

## 11) Frase Canônica Final

No UnifiCard:

> **Categoria organiza.  
> Categoria NÃO governa.**
