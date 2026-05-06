Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Pessoa Física Prestadora — Definição Canônica

Este documento define **a prestação de serviços por Pessoa Física (PF)** no UnifiCard.

Ele formaliza a **decisão D17** e estabelece, de forma constitucional, **como uma pessoa física pode existir como ofertante legítimo**, sem criar exceções ocultas, empresas fictícias ou inferência fiscal.

Este documento **não trata de impostos, notas fiscais ou obrigações legais externas**. Esses temas são **explicitamente fora do core**.

---

## 1. Princípio Fundamental (D17)

### Decisão Canônica

**Pessoa Física PODE prestar serviços no UnifiCard**, desde que opere como **Actor soberano**.

Consequências diretas:

* **Actor continua sendo a única entidade soberana** (D1)
* **Company NÃO é pré-requisito** para ofertar
* **Service pertence ao Actor**, nunca à Company
* Evento, RFQ, Matching e Marketplace **contratam Actor**, não entidade jurídica

---

## 2. O que Pessoa Física É no UnifiCard

Pessoa Física:

* ✔ é um **sujeito real**
* ✔ pode assumir compromissos
* ✔ pode declarar capacidade
* ✔ pode ofertar serviços

No sistema, isso se materializa como:

> **Pessoa Física = Actor Individual**

---

## 3. O que Pessoa Física NÃO é

Pessoa Física **NÃO é**:

* ❌ Company
* ❌ Exceção temporária
* ❌ Atalho para onboarding
* ❌ Entidade fiscal implícita

PF **não herda** comportamentos de Company.
PF **não simula** CNPJ.

---

## 4. Nascimento Institucional da PF Prestadora

### Ato Constitutivo

O nascimento institucional ocorre quando:

* um usuário cria um **Actor individual**

Resultado:

```
Actor: VALID (tipo individual)
Onboarding: ACTOR_READY
```

Nenhuma Company é criada neste processo.

---

## 5. Oferta de Serviços por PF

Após existir como Actor:

* PF pode **declarar Service(s)**
* Os mesmos requisitos de Service se aplicam (ver SERVICE_CANONICO.md)

Service por PF:

* ✔ é promessa formal
* ✔ pode ser indexado
* ✔ pode receber RFQ

Desde que:

* respeite estados do Service
* passe pelos gates de indexação

---

## 6. Disponibilidade (se aplicável)

Se a categoria exigir tempo:

* PF declara Availability normalmente
* Availability pertence ao Actor

Nenhuma inferência automática é permitida.

---

## 7. Indexação e Visibilidade

PF **não é indexada**.

O que pode ser indexado:

* **Service do Actor PF**

A PF aparece no marketplace **exclusivamente por meio de seus Services indexados**.

---

## 8. Relação com Empresa (PJ)

Pessoa Física pode:

* continuar operando indefinidamente como PF
* futuramente criar Company

Criar Company:

* **não invalida** Services existentes
* **não é automática**
* **não é inferida**

Transição PF → PJ é **ato soberano separado**, fora deste documento.

---

## 9. Proibições Absolutas

São violações constitucionais:

* Forçar PF a criar Company
* Criar Company automática para PF
* Inferir MEI, CNPJ ou obrigação fiscal
* Bloquear PF em matching ou RFQ
* IA sugerir formalização jurídica

Qualquer uma dessas práticas **invalida o sistema institucionalmente**.

---

## 10. Convivência com Eventos e RFQ

* Eventos **não distinguem PF de PJ**
* RFQs são enviados a **Actors compatíveis**
* Responsabilidade nasce do Actor

PF e PJ são **ontologicamente equivalentes** no mercado.

---

## Regra Final

Pessoa Física prestadora **não é exceção**.

Ela é **parte legítima do core**, sustentada pela mesma lei que rege Empresas.

Este documento é **canônico e vinculante** para:

* IA Guardiã
* IA Executora

Qualquer desvio é **violação constitucional**, não decisão de produto.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md
- SERVICE_CANONICO.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->