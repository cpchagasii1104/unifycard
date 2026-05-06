Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Empresa — Nascimento Canônico

Este documento define **o nascimento institucional de uma Empresa (PJ)** no UnifiCard.

Ele **não descreve UX**, **não descreve telas**, **não descreve execução técnica**.
Ele define **o que uma Empresa é**, **o que ela não é**, e **em que momento ela passa a existir legitimamente no sistema**.

---

## 1. Definição Canônica de Empresa

### O que é Empresa

* **Empresa é um registro institucional de lastro jurídico, administrativo e econômico**.
* Empresa existe para **permitir que Actors institucionais existam legitimamente**.
* Empresa **não é sujeito de ação** no UnifiCard.

> Empresa é **origem de legitimidade**, não origem de comportamento.

---

### O que Empresa NÃO é

Empresa **NÃO é**:

* ❌ Soberana
* ❌ Actor
* ❌ Prestadora de serviços
* ❌ Participante de matching
* ❌ Entidade indexável
* ❌ Origem de RFQ ou Evento

Qualquer fluxo que trate Empresa como ofertante **viola D1 e D3**.

---

## 2. Relação Empresa ↔ Actor

* Empresa **nunca age diretamente**.
* Toda ação ocorre **via Actor soberano**.
* Actor pode representar:

  * uma Empresa (PJ)
  * uma Pessoa Física (PF, conforme D17)

> **Empresa sem Actor é institucionalmente inerte.**

A cardinalidade Company ↔ Actor **não é decidida neste documento**.
Este documento apenas estabelece:

* ❗ Empresa **não substitui** Actor
* ❗ Empresa **não herda** soberania

---

## 3. Momento de Nascimento da Empresa

### Ato Constitutivo

O nascimento de uma Empresa ocorre **exclusivamente** quando:

* um usuário autorizado declara a criação de uma entidade jurídica
* dados mínimos jurídicos/administrativos são registrados

Resultado institucional:

```
Company: CREATED
Onboarding: CREATED
```

---

### Consequências do Nascimento

Após o nascimento:

Empresa:

* ✔ existe no banco institucional
* ✔ pode ser referenciada por Actors

Empresa:

* ❌ não oferta serviços
* ❌ não aparece no marketplace
* ❌ não pode ser indexada
* ❌ não responde RFQ

Este estado **é válido e esperado**.

---

## 4. Separação Obrigatória: Empresa vs Oferta

A criação de Empresa **NÃO** implica:

* criação de Actor
* criação de Page
* criação de Service
* criação de Availability
* indexação

Cada um desses passos exige **ato soberano próprio**.

Misturar esses passos cria:

* promessa sem ator
* visibilidade sem legitimidade
* fraude semântica

---

## 5. Papel da Empresa no Onboarding

Durante o onboarding:

* Empresa funciona como **pré-condição jurídica**
* Empresa **não desbloqueia mercado**
* Empresa **não acelera matching**

O onboarding **pode parar indefinidamente** neste estado sem erro.

Bloqueio aqui **não é falha**, é proteção institucional.

---

## 6. Convivência com Pessoa Física (D17)

Conforme D17:

* Empresa **não é obrigatória** para prestação de serviços
* PF pode operar diretamente como Actor

Este documento **não cria exceção** nem tenta unificar PF e PJ artificialmente.

---

## 7. Violações Institucionais Comuns

São violações explícitas:

* criar Service automaticamente ao criar Empresa
* indexar Empresa diretamente
* permitir Empresa responder RFQ
* inferir capacidade operacional a partir da Empresa
* criar Company “fake” para PF

Tais práticas **invalidam o onboarding**, mesmo que tecnicamente funcionem.

---

## 8. Regra Final

Empresa **não nasce viva**.

Empresa nasce **inerte**, e **ganha vida somente através de Actors e Services**.

Este documento é **referência canônica** para:

* IA Guardiã (validação institucional)
* IA Executora (implementação sem inferência)

Qualquer divergência é **violação constitucional**, não otimização.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->