# Indexação — Definição Canônica

Este documento define **o que é indexação no UnifiCard**, quando ela pode ocorrer e quais entidades **têm permissão institucional para se tornarem visíveis**.

Indexação **não é busca**, **não é ranking**, **não é consequência de cadastro**.
Indexação é **ato institucional explícito de exposição pública**.

---

## 1. Princípio Fundamental

Indexar é declarar:

> “Esta entidade pode ser descoberta, considerada e acionada por terceiros no ecossistema.”

Isso envolve:

* risco econômico
* reputação
* impacto jurídico
* confiança sistêmica

Por isso, **indexação nunca é automática**.

---

## 2. Entidades Elegíveis à Indexação

Somente as seguintes entidades **podem ser indexadas**:

* ✅ **Service** (única entidade de oferta)
* ⚠️ **Page** (apenas como projeção social, se permitido por governança)
* ⚠️ **Evento** (somente se explicitamente autorizado em documento próprio)

📌 **Company nunca é indexável**.
📌 **Actor nunca é indexável diretamente**.

---

## 3. Entidades Proibidas de Indexação

Nunca podem ser indexadas:

* ❌ Company
* ❌ Actor
* ❌ RFQ
* ❌ Availability
* ❌ Estados internos de onboarding
* ❌ Metadados ou rascunhos

Indexar qualquer um desses é **vazamento de estado interno**.

---

## 4. Indexação ≠ Criação

Criar uma entidade **não concede visibilidade**.

Exemplos proibidos:

* “Criou Service → aparece”
* “Finalizou onboarding → indexa”
* “Recebeu RFQ → indexa”

Toda indexação exige **ato separado**.

---

## 5. Pré-condições Canônicas para Indexar Service

Um Service **só pode ser indexado** se TODAS forem verdade:

* Service existe
* Service pertence a Actor válido
* Service está no estado `PUBLISHABLE`
* Categoria é permitida
* Localização canônica definida
* Availability declarada (se exigida)
* Gate D15 autorizado

Falha em qualquer item → **não indexa**.

---

## 6. Autoridade sobre Indexação

Indexação ocorre por:

* ato soberano explícito do Actor
* ou ato institucional autorizado por governança

📌 IA **não possui autoridade de indexação**.
📌 UX **não concede indexação**.

---

## 7. Relação com Busca e Marketplace

### Busca

* Busca **opera exclusivamente sobre o índice**
* Nunca consulta dados não indexados

### Marketplace

* Marketplace **só apresenta entidades indexadas**
* Nunca força visibilidade

---

## 8. Relação com IA

IA:

* ❌ não indexa
* ❌ não desindexa
* ❌ não sugere entidades não indexadas

IA **só raciocina sobre o que já é público**.

Qualquer violação disso é **ilegal institucionalmente**.

---

## 9. Desindexação (Obrigatória)

Desindexar é tão importante quanto indexar.

Desindexação ocorre quando:

* Service muda para estado não-publicável
* Actor perde validade
* Categoria perde permissão
* Violação institucional
* Decisão soberana explícita

Desindexar:

* ❌ não apaga histórico
* ❌ não destrói Service
* ✔ remove visibilidade pública

---

## 10. Erros Clássicos (Proibidos)

* Indexar automaticamente no fim do cadastro
* Indexar Company
* Indexar por reação a RFQ
* IA “descobrir” fornecedor oculto

Todos são **atalhos ilegais**.

---

## Regra Final

Indexação é **o portão da realidade pública**.

Quem controla esse portão controla:

* confiança
* mercado
* risco

Este documento é **canônico e vinculante** para:

* IA Guardiã
* IA Executora

Qualquer implementação que indexe fora destas regras é **institucionalmente inválida**, mesmo que tecnicamente funcional.
