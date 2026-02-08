# Fluxo de Onboarding — Empresa (PJ)

Este documento descreve o **fluxo institucional completo de onboarding de uma Empresa (Pessoa Jurídica)** no UnifiCard.

Ele **não é UX**, **não é formulário**, **não é código**.
É um **mapa de entidades, estados e transições soberanas**, consolidando todos os documentos canônicos já definidos.

Este fluxo existe para:

* permitir validação pela IA Guardiã
* orientar execução pela IA Executora
* impedir atalhos, inferências e colapsos semânticos

---

## Visão Geral do Fluxo

O onboarding de Empresa **não é linear por interface**, mas **sequencial por autoridade**.

Fluxo canônico:

```
Usuário
  ↓
Company
  ↓
Actor
  ↓
Service
  ↓
Availability (se aplicável)
  ↓
Gate D15
  ↓
Indexação
```

A Empresa **só se torna “viva”** quando ao menos um Service é indexado.

---

## Etapa 0 — Intenção (fora do core)

* Usuário manifesta desejo de criar empresa
* Nenhuma entidade criada
* Nenhum estado institucional alterado

---

## Etapa 1 — Company (Lastro Jurídico)

**Criação:** Company

Estados:

```
Company: CREATED
Onboarding: CREATED
```

Regras:

* Company não age
* Company não oferta
* Company não é indexável

Bloqueio aqui é válido e esperado.

---

## Etapa 2 — Actor (Capacidade de Agir)

**Pré-condição:** Company existente

**Criação:** Actor institucional

Estados:

```
Actor: VALID
Onboarding: ACTOR_READY
```

Regras:

* Toda ação futura ocorre via Actor
* Company nunca substitui Actor

---

## Etapa 3 — Service (Promessa Formal)

**Pré-condição:** Actor válido

**Criação:** Um ou mais Services

Estados possíveis:

```
Service: DRAFT | DECLARED
Onboarding: SERVICE_DECLARED
```

Regras:

* Service pertence ao Actor
* Service não nasce público

---

## Etapa 4 — Availability (Capacidade Temporal)

**Condicional:** apenas se categoria exigir

**Criação:** Availability vinculada ao Actor/Service

Estado:

```
Availability: DECLARED | OPTIONAL
```

---

## Etapa 5 — Publicabilidade do Service

**Avaliação institucional**

Estados:

```
Service: PUBLISHABLE
Onboarding: SERVICE_PUBLISHABLE
```

Regras:

* Publishable ≠ visível
* Nenhuma indexação automática

---

## Etapa 6 — Gate D15 (Autorização)

**Avaliação soberana**

Estados possíveis:

```
Gate D15: PENDING | APPROVED | DENIED
```

Regras:

* Gate pode permanecer fechado
* Onboarding não força abertura

---

## Etapa 7 — Indexação (Visibilidade Pública)

**Ato explícito autorizado**

Estados:

```
Service: INDEXED
Onboarding: INDEXABLE
Marketplace: VISIBLE
```

Regras:

* Indexação só ocorre com Gate D15 = APPROVED
* Indexação é ato separado

---

## Etapa 8 — Empresa Viva no Ecossistema

**Condição objetiva:**

> Ao menos um Service indexado

Estados:

```
Company: ACTIVE
Actor: ACTIVE
Service(s): INDEXED
Onboarding: LIVE
```

---

## Estados de Bloqueio (Válidos)

O fluxo pode parar legitimamente em qualquer etapa por:

* ausência de Actor
* ausência de Service
* Service não publishable
* Gate D15 fechado

Bloqueio ≠ erro.

---

## Proibições Explícitas no Fluxo

* Criar Service antes de Actor
* Indexar Company
* Indexar automaticamente no fim do onboarding
* Responder RFQ com Company
* Usar IA para desbloquear etapas

---

## Regra Final

Este fluxo é **referência canônica** do onboarding PJ.

Qualquer implementação que viole este encadeamento é **institucionalmente inválida**, mesmo que tecnicamente funcional.

Este documento deve ser usado por:

* IA Guardiã (validação)
* IA Executora (implementação disciplinada)
