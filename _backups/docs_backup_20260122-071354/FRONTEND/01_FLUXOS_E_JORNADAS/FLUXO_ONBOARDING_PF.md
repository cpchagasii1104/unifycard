# Fluxo de Onboarding — Pessoa Física (PF)

Este documento descreve o **fluxo institucional completo de onboarding de uma Pessoa Física prestadora de serviços** no UnifiCard.

Ele **não é UX**, **não é formulário**, **não é código**.
É um **mapa de entidades, estados e transições soberanas**, alinhado à decisão **D17**.

Este fluxo garante que a Pessoa Física opere **sem Company**, **sem exceções** e **sem inferência fiscal**.

---

## Visão Geral do Fluxo

A Pessoa Física ingressa no ecossistema **diretamente como Actor soberano**.

Fluxo canônico:

```
Usuário
  ↓
Actor (PF)
  ↓
Service
  ↓
Availability (se aplicável)
  ↓
Gate D15
  ↓
Indexação
```

A PF é considerada **ativa no ecossistema** quando ao menos um Service é indexado.

---

## Etapa 0 — Intenção (fora do core)

* Usuário manifesta desejo de prestar serviços
* Nenhuma entidade criada
* Nenhum estado institucional alterado

---

## Etapa 1 — Actor (Capacidade de Agir)

**Criação:** Actor individual

Estados:

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

## Etapa 2 — Service (Promessa Formal)

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

## Etapa 3 — Availability (Capacidade Temporal)

**Condicional:** apenas se categoria exigir

**Criação:** Availability vinculada ao Actor/Service

Estado:

```
Availability: DECLARED | OPTIONAL
```

---

## Etapa 4 — Publicabilidade do Service

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

## Etapa 5 — Gate D15 (Autorização)

**Avaliação soberana**

Estados possíveis:

```
Gate D15: PENDING | APPROVED | DENIED
```

Regras:

* Gate pode permanecer fechado
* Onboarding não força abertura

---

## Etapa 6 — Indexação (Visibilidade Pública)

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

## Etapa 7 — PF Ativa no Ecossistema

**Condição objetiva:**

> Ao menos um Service indexado

Estados:

```
Actor: ACTIVE
Service(s): INDEXED
Onboarding: LIVE
```

---

## Estados de Bloqueio (Válidos)

O fluxo pode parar legitimamente em qualquer etapa por:

* Actor não criado
* Nenhum Service declarado
* Service não publishable
* Gate D15 fechado

Bloqueio ≠ erro.

---

## Proibições Explícitas no Fluxo

* Forçar PF a criar Company
* Criar Company automática
* Indexar PF diretamente
* Indexar automaticamente no fim do onboarding
* Responder RFQ sem Service indexado
* Usar IA para desbloquear etapas

---

## Regra Final

Este fluxo é **referência canônica** do onboarding PF.

Ele deve ser usado por:

* IA Guardiã (validação)
* IA Executora (implementação disciplinada)

Qualquer desvio é **institucionalmente inválido**, mesmo que tecnicamente funcional.
