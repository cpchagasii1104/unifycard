# Pessoa Física — Onboarding Canônico (Passo a Passo)

Este documento define o **rito institucional completo de onboarding de uma Pessoa Física (PF) prestadora de serviços** no UnifiCard.

Ele **não descreve UX**, **não descreve telas**, **não descreve código**.
Ele descreve **atos soberanos**, **pré-condições**, **estados válidos** e **bloqueios legítimos**, conforme a decisão **D17**.

Este rito é **equivalente em dignidade** ao onboarding de Empresa (PJ), divergindo apenas **na ausência de Company**.

---

## Visão Geral do Rito

A Pessoa Física **não passa por Company**.
Ela ingressa no ecossistema **diretamente como Actor soberano**.

Sequência imutável:

1. Actor (capacidade de agir)
2. Service (promessa de oferta)
3. Availability (capacidade temporal, se aplicável)
4. Indexação (visibilidade pública)

---

## FASE 0 — Intenção (fora do core)

**Quem age:** Usuário (Pessoa Física)

Ato:

> “Quero oferecer meus serviços no UnifiCard”

Resultado:

* Nenhuma entidade criada
* Nenhuma promessa assumida

Esta fase **não gera estado institucional**.

---

## FASE 1 — Capacidade Operacional (Actor)

**Ato soberano:** Criar Actor individual

Cria:

* `Actor` (tipo individual)

Estado resultante:

```
Actor: VALID
Onboarding: ACTOR_READY
```

Regras:

* Actor é soberano
* Actor responde por todas as ações

Bloqueios válidos:

* Falha de identidade
* Falha de autorização

---

## FASE 2 — Declaração de Serviços (Service)

**Pré-condição:** Actor válido

**Ato soberano:** Actor declara oferta

Cria:

* Um ou mais `Service`

Campos canônicos mínimos:

* Categoria
* Escopo semântico
* Localização canônica

Estado possível:

```
Service: DECLARED | DRAFT
Onboarding: SERVICE_DECLARED
```

Regras:

* Service pertence exclusivamente ao Actor
* Service não nasce publicado
* Service não nasce indexado

Bloqueios válidos:

* Categoria inválida
* Dados insuficientes

---

## FASE 3 — Capacidade Temporal (Availability) *(se aplicável)*

**Pré-condição:** Service declarado

**Ato soberano:** Declarar disponibilidade

Cria:

* Registros na Unified Availability

Estado:

```
Availability: DECLARED | OPTIONAL
```

Regras:

* Availability pertence ao Actor / Service
* Availability não é inferida

Bloqueios válidos:

* Categoria exige disponibilidade não declarada

---

## FASE 4 — Publicabilidade do Service

**Pré-condição:** Service declarado

**Ato institucional:** Avaliar se Service pode ser publicado

Resultado:

```
Service: PUBLISHABLE
Onboarding: SERVICE_PUBLISHABLE
```

Regras:

* Publicável ≠ publicado
* Nenhuma visibilidade automática é concedida

Bloqueios válidos:

* Regras de governança
* Pendências de disponibilidade

---

## FASE 5 — Indexação (Visibilidade Pública)

**Pré-condição:** Service publishable

**Ato soberano:** Indexar Service

Resultado:

```
Service: INDEXED
Onboarding: INDEXABLE
Marketplace: VISIBLE
```

Regras:

* Indexação é explícita
* Indexação nunca é automática

Bloqueios válidos:

* Gate D15 não decidido
* Ato soberano não autorizado

---

## FASE 6 — PF Viva no Ecossistema

**Definição objetiva:**

> Uma Pessoa Física é considerada **ativa no ecossistema** quando **ao menos um Service está indexado**.

Estado possível:

```
Actor: ACTIVE
Service(s): INDEXED
Onboarding: LIVE
```

Onboarding pode continuar (novos serviços, ajustes, expansão), sem reiniciar o rito.

---

## Bloqueios Legítimos (Não Erros)

O onboarding pode parar validamente quando:

* Actor não foi criado
* Nenhum Service foi declarado
* Service não é publishable
* Indexação não foi autorizada

Bloqueio **não é bug**.
Bloqueio é **proteção institucional**.

---

## Proibições Absolutas

São violações constitucionais:

* Forçar PF a criar Company
* Criar Company automática
* Inferir MEI ou CNPJ
* Indexar PF diretamente
* Usar IA para completar lacunas

---

## Regra Final

Este passo a passo é a **régua oficial** do onboarding de Pessoa Física prestadora.

* IA Guardiã valida conformidade
* IA Executora implementa sem inferência

Qualquer desvio é **ilegal institucionalmente**, mesmo que funcione tecnicamente.
