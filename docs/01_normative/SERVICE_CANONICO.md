Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Service — Definição Canônica

Este documento define **o que é um Service no UnifiCard**, sua natureza institucional, seus limites e seu papel como **única ponte legítima entre oferta e demanda**.

Service **não é feature**, **não é perfil**, **não é categoria solta**.
Service é **promessa formal institucionalizada**.

---

## 1. Definição Fundamental

### O que é um Service

* **Service é uma promessa formal de oferta**, declarada explicitamente por um **Actor soberano**.
* Ele afirma que o Actor:

  * pode
  * quer
  * se dispõe
    a atender determinado tipo de demanda.

> **Service não executa, não decide, não negocia.**
> Quem cumpre a promessa é o Actor.

---

### Entidade proprietária

* Todo Service **pertence obrigatoriamente a um Actor**.
* Service **nunca pertence a Company**.
* Service **nunca pertence a Evento ou RFQ**.

Service sem Actor é **institucionalmente inválido**.

---

## 2. Papel do Service no Ecossistema

Service é:

* ✅ a **menor unidade de verdade econômica** do UnifiCard
* ✅ a **única entidade indexável de oferta**
* ✅ o **único alvo legítimo de RFQ e Matching**

Service **é o que o marketplace enxerga**.

---

## 3. O que Service NÃO é

Service **NÃO é**:

* ❌ Actor
* ❌ Company
* ❌ Perfil
* ❌ Categoria genérica
* ❌ Resultado de inferência
* ❌ Consequência automática de onboarding

Criar Service sem vontade explícita do Actor é **fraude semântica**.

---

## 4. Nascimento Institucional do Service

### Pré-condições obrigatórias

Um Service **só pode existir** se:

* Actor existe
* Actor é válido
* Actor tem autoridade institucional

---

### Ato constitutivo

**Quem age:** Actor soberano

Ação válida:

> “Declaro que ofereço este serviço”

Resultado:

* Criação de um `Service`

---

### Campos canônicos mínimos

Todo Service deve possuir, no mínimo:

* `actor_id`
* categoria
* escopo semântico
* localização canônica
* estado

Sem esses campos, o Service **não é válido**.

---

## 5. Estados Canônicos do Service

Service **existe independentemente de visibilidade**.

Estados mínimos:

* `DRAFT` — promessa privada
* `DECLARED` — promessa formal
* `PUBLISHABLE` — apto a ser publicado
* `INDEXED` — visível publicamente
* `SUSPENDED` — promessa retirada temporariamente
* `CLOSED` — promessa encerrada (histórico)

📌 Estado define **visibilidade**, não existência.

---

## 6. Service e Availability

* Availability **não vive dentro do Service**.
* Service **referencia** Availability quando aplicável.
* Availability pertence ao Actor.

Service:

* ❌ não agenda
* ❌ não bloqueia tempo

---

## 7. Service e RFQ

* RFQ **nunca cria Service**.
* RFQ **nunca altera Service**.
* RFQ **consulta Services compatíveis**.

Resposta a RFQ:

* é ação do Actor
* nunca do Service

---

## 8. Service e Evento

* Evento **não cria Service**.
* Evento **não modifica Service**.
* Evento **pode fornecer contexto** usado para avaliar compatibilidade.

Evento nunca é soberano sobre Service.

---

## 9. Service e Indexação

* Service **só é visível se indexado**.
* Indexação é **ato institucional explícito**.
* Service pode existir indefinidamente sem ser indexado.

Criar Service ≠ aparecer no marketplace.

---

## 10. Proibições Absolutas

São violações constitucionais:

* Criar Service automaticamente
* Inferir Service por perfil
* Criar Service a partir de RFQ ou Evento
* Permitir Service responder RFQ
* Indexar Service implicitamente

---

## Regra Final

Service é **promessa formal**, não conveniência de produto.

Se Service for frouxo:

* matching vira ruído
* marketplace perde confiança

Se Service for canônico:

* onboarding escala
* eventos fazem sentido
* RFQ é defensável

Este documento é **canônico e vinculante** para:

* IA Guardiã
* IA Executora

Qualquer desvio é **violação constitucional**, mesmo que “funcione”.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- PF_PRESTADOR_CANONICO.md
<!-- AUTO-GENERATED-END -->