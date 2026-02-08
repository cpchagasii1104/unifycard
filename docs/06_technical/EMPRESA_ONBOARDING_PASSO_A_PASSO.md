# Empresa — Onboarding Canônico (Passo a Passo)

Este documento define o **rito institucional completo** de onboarding de uma **Empresa (PJ)** no UnifiCard.

Ele **não descreve UX**, **não descreve telas**, **não descreve código**.
Ele descreve **atos institucionais**, **pré-condições**, **estados válidos** e **bloqueios legítimos**.

Este passo a passo **deve ser seguido exatamente nesta ordem**.
Qualquer atalho ou inferência constitui **violação constitucional**.

---

## Visão Geral do Rito

O onboarding de Empresa **não cria tudo de uma vez**.
Ele **autoriza capacidades progressivamente**, respeitando soberania e governança.

Sequência imutável:

1. Company (lastro jurídico)
2. Actor (capacidade de agir)
3. Service (promessa de oferta)
4. Availability (capacidade temporal, se aplicável)
5. Indexação (visibilidade pública)

---

## FASE 0 — Intenção (fora do core)

**Quem age:** Usuário (Pessoa Física)

Ato:

> “Quero criar uma empresa no UnifiCard”

Resultado:

* Nenhuma entidade criada
* Nenhuma promessa assumida

Esta fase **não gera estado institucional**.

---

## FASE 1 — Criação da Empresa (Company)

**Ato soberano:** Registrar entidade jurídica

Cria:

* `Company`

Estado resultante:

```
Company: CREATED
Onboarding: CREATED
```

Regras:

* Company é **inerte**
* Company **não age**
* Company **não oferta**
* Company **não é indexável**

Bloqueios válidos:

* Falta de dados jurídicos mínimos

---

## FASE 2 — Capacidade Operacional (Actor)

**Pré-condição:** Company existe

**Ato soberano:** Criar Actor representativo da Empresa

Cria:

* `Actor` (institucional)

Estado resultante:

```
Actor: VALID
Onboarding: ACTOR_READY
```

Regras:

* Toda ação futura ocorre **via Actor**
* Company nunca substitui Actor

Bloqueios válidos:

* Actor inválido
* Falha de autorização

---

## FASE 3 — Declaração de Serviços (Service)

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

* Service pertence **exclusivamente** ao Actor
* Service não nasce publicado
* Service não nasce indexado

Bloqueios válidos:

* Categoria inválida
* Dados semânticos insuficientes

---

## FASE 4 — Capacidade Temporal (Availability) *(se aplicável)*

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
* Availability **não é inferida**

Bloqueios válidos:

* Categoria exige disponibilidade não declarada

---

## FASE 5 — Publicabilidade do Service

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

## FASE 6 — Indexação (Visibilidade Pública)

**Pré-condição:** Service publishable

**Ato soberano:** Indexar Service

Resultado:

```
Service: INDEXED
Onboarding: INDEXABLE
Marketplace: VISIBLE
```

Regras:

* Indexação é **explícita**
* Indexação nunca é automática

Bloqueios válidos:

* Gate D15 não decidido
* Ato soberano não autorizado

---

## FASE 7 — Empresa Viva no Ecossistema

**Definição objetiva:**

> Uma Empresa é considerada **viva** quando **ao menos um Service está indexado**.

Estado possível:

```
Company: ACTIVE
Actor: ACTIVE
Service(s): INDEXED
Onboarding: LIVE
```

Onboarding **pode continuar** (novos serviços, expansão), sem reiniciar o rito.

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

* Criar Service antes de Actor
* Indexar Company
* Tornar visível no “fim do cadastro”
* Usar IA para completar lacunas
* Forçar PF a criar Company

---

## Regra Final

Este passo a passo é a **régua oficial** do onboarding de Empresa.

* IA Guardiã valida conformidade
* IA Executora implementa sem inferência

Qualquer desvio é **ilegal institucionalmente**, mesmo que funcione tecnicamente.
