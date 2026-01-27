# Onboarding — Constituição do Nascimento Institucional

Este diretório define o **onboarding canônico** do UnifiCard.

Onboarding **não é cadastro**, **não é UX**, **não é wizard**.
Onboarding é o **rito institucional** pelo qual uma entidade passa a **existir legitimamente no ecossistema**, adquirindo capacidade de agir, prometer e ser descoberta — **em etapas soberanas e auditáveis**.

---

## Princípios Invioláveis

* **Actor é soberano** (D1). Tudo que age é Actor.
* **Company não é capacidade operacional**. É lastro jurídico/administrativo.
* **Service é a promessa formal**. Marketplace só enxerga Service.
* **Indexação é ato institucional**, nunca efeito colateral.
* **Fiscalidade é externa ao core** (fora de matching, IA, Evento e RFQ).
* **Nenhuma inferência substitui decisão explícita**.

---

## Escopo do Onboarding

Este onboarding cobre **oferta econômica** no UnifiCard, contemplando **dois caminhos canônicos**:

1. **Pessoa Física (PF)** — prestador individual
2. **Empresa (PJ)** — via Company como lastro

Ambos **convergem no mesmo núcleo**:

> **Actor → Service → Availability (se aplicável) → Indexação**

A divergência ocorre **antes**, no nascimento do Actor.

---

## Gate Constitucional (Obrigatório)

### D17 — Prestação de serviço por Pessoa Física

* **DECIDIDO:** Pessoa Física **PODE** prestar serviços desde que opere como **Actor soberano**.
* **Company NÃO é obrigatória** para ofertar.
* Evento, RFQ, Matching e Marketplace **contratam Actor**, nunca Company.

Qualquer execução que force PF a criar Company, MEI ou CNPJ **viola a constituição**.

---

## Estados Canônicos do Onboarding

Onboarding **não é binário**. Estados mínimos:

* `CREATED` — Company criada (se PJ), sem capacidade operacional
* `ACTOR_READY` — Actor válido existe
* `SERVICE_DECLARED` — ao menos um Service declarado
* `SERVICE_PUBLISHABLE` — Service atende critérios de publicação
* `INDEXABLE` — pode ser indexado (não significa que foi)
* `LIVE` — ao menos um Service indexado

Bloqueios **são válidos** e **protegem o sistema**.

---

## O que ESTE Diretório Contém

* **empresa/** — nascimento e onboarding de PJ
* **pessoa_fisica/** — onboarding de PF prestadora
* **service/** — definição, estados e transições do Service
* **indexacao/** — regras de visibilidade pública
* **fluxos/** — fluxos institucionais (sem UX)

Cada documento aqui:

* é **canônico**
* deve ser respeitado pela **IA Guardiã**
* orienta a **IA Executora** sem improviso

---

## O que ESTE Diretório NÃO É

* Não é documentação de tela
* Não é backlog técnico
* Não é tutorial de produto
* Não contém decisões implícitas

Tudo aqui existe para **impedir onboarding falso**.

---

## Regra Final

Se algum fluxo:

* cria Service sem Actor
* indexa automaticamente
* mistura PF e PJ por conveniência
* usa IA para completar lacunas

→ **está institucionalmente inválido**, mesmo que “funcione”.

Este diretório é a **régua oficial** do nascimento institucional no UnifiCard.
