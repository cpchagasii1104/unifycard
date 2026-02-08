# Fluxo Comparativo — Pessoa Física (PF) vs Empresa (PJ)

Este documento apresenta uma **comparação canônica** entre os fluxos de onboarding de **Pessoa Física prestadora (PF)** e **Empresa (PJ)** no UnifiCard.

O objetivo é:

* deixar explícito **onde os fluxos divergem**
* deixar inequívoco **onde eles convergem**
* declarar **onde é proibido misturar conceitos ou etapas**

Este documento existe para **evitar gambiarras institucionais** e **exceções silenciosas**.

---

## Visão Geral

* PF e PJ **não são o mesmo objeto**
* PF e PJ **não têm o mesmo nascimento jurídico**
* PF e PJ **convergem no mesmo núcleo operacional**

> A convergência ocorre no **Actor → Service → Availability → Indexação**.

---

## 🧭 Tabela Comparativa Canônica

| Dimensão               | Pessoa Física (PF)                 | Empresa (PJ)                        |
| ---------------------- | ---------------------------------- | ----------------------------------- |
| Origem jurídica        | Pessoa física (CPF)                | Entidade jurídica (CNPJ / registro) |
| Company                | ❌ Não existe                       | ✅ Obrigatória como lastro           |
| Actor                  | ✅ Actor individual soberano        | ✅ Actor institucional soberano      |
| Soberania              | Actor (PF)                         | Actor (representante da Company)    |
| Capacidade de agir     | Via Actor                          | Via Actor                           |
| Service                | Declarado pelo Actor               | Declarado pelo Actor                |
| Propriedade do Service | Actor PF                           | Actor da Empresa                    |
| Availability           | Opcional / governada por categoria | Opcional / governada por categoria  |
| Gate D15               | Obrigatório                        | Obrigatório                         |
| Indexação              | Apenas via Service                 | Apenas via Service                  |
| Marketplace            | Enxerga Service                    | Enxerga Service                     |
| RFQ                    | Direcionado ao Actor               | Direcionado ao Actor                |
| Evento                 | Contrata Actor                     | Contrata Actor                      |
| Fiscalidade            | Fora do core                       | Fora do core                        |

---

## 🔀 Onde os Fluxos CONVERGEM

Os fluxos PF e PJ **são idênticos** a partir do momento em que:

* um **Actor válido** existe
* um **Service é declarado**

Convergência obrigatória:

```
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

A partir desse ponto:

* matching não distingue PF de PJ
* RFQ não distingue PF de PJ
* Evento não distingue PF de PJ

---

## 🔀 Onde os Fluxos DIVERGEM

A divergência ocorre **antes do Actor**.

### Divergência estrutural

| Etapa                  | PF           | PJ              |
| ---------------------- | ------------ | --------------- |
| Lastro jurídico        | Não existe   | Company         |
| Criação inicial        | Actor direto | Company → Actor |
| Dependência de Company | Proibida     | Obrigatória     |

---

## 🚫 Onde é PROIBIDO MISTURAR

As seguintes misturas são **violações constitucionais**:

### ❌ Misturas proibidas

* Forçar PF a criar Company
* Criar Company automática para PF
* Tratar Company como ofertante
* Associar Service diretamente à Company
* Indexar Company ou PF diretamente
* Inferir obrigação fiscal a partir do fluxo
* Criar exceções de matching baseadas em PF/PJ

---

## 🛑 Anti‑Padrões Clássicos (Explicitamente Proibidos)

* "PF pequena, PJ grande"
* "Se faturar muito vira empresa"
* "MEI implícito"
* "Company light"
* "Perfil profissional vira Service"

Todos são **atalhos ilegais**.

---

## 📌 Regra de Ouro

> **O sistema nunca contrata Company.**
> **O sistema nunca contrata Pessoa Física.**
> **O sistema contrata Actor.**

PF e PJ existem apenas para **legitimar o Actor**, nunca para substituí‑lo.

---

## Regra Final

Este documento é a **referência comparativa oficial** entre PF e PJ no onboarding.

Ele deve ser utilizado por:

* IA Guardiã (validação de consistência)
* IA Executora (implementação sem bifurcação suja)
* Humanos (decisão consciente)

Qualquer implementação que misture PF e PJ fora dessas regras é **institucionalmente inválida**, mesmo que funcione tecnicamente.
