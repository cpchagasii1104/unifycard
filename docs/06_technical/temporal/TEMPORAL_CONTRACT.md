# TEMPORAL_CONTRACT.md

## STATUS

CANÔNICO · VIGENTE · OBRIGATÓRIO · NÃO FLEXÍVEL

Este documento define o **contrato temporal oficial** do sistema.

Ele existe para:

* impedir regressão estrutural
* eliminar ambiguidade entre Date, string e timestamp
* garantir coerência entre core, modules, repositories, contratos e eventos
* tornar **impossível** “se perder de novo” em datas e horários

Este contrato tem **força de lei técnica**.

---

## 1. PRINCÍPIO FUNDAMENTAL

> **Tempo é dado estrutural, não detalhe de implementação.**

Qualquer inconsistência temporal:

* quebra contratos
* gera bugs silenciosos
* invalida eventos
* destrói rastreabilidade

Por isso, tempo segue regras **globais e imutáveis**.

---

## 2. REGRA SUPREMA (SEM EXCEÇÕES)

### 2.1 Forma canônica de datas no sistema

| Camada                                | Representação permitida  |
| ------------------------------------- | ------------------------ |
| Contratos (API, DTOs, inputs/outputs) | `string` (ISO 8601)      |
| Eventos                               | `string` (ISO 8601, UTC) |
| Core / Services / Repositories        | `string` (ISO 8601)      |
| Banco de dados                        | `TIMESTAMPTZ`            |
| Adapters / Boundaries                 | `Date` (uso restrito)    |

➡️ **`Date` NÃO é um tipo de domínio.**
➡️ **`Date` NÃO atravessa boundaries.**

---

## 3. PROIBIÇÃO ABSOLUTA

É **PROIBIDO**:

* Usar `Date` em:

  * contratos
  * DTOs
  * services
  * repositories
  * eventos
* Expor `Date` em qualquer interface pública ou interna
* Armazenar datas como:

  * `string` não ISO
  * `number`
  * formatos locais
* Criar campos temporais sem sufixo canônico

**Se um campo é tempo, ele OBRIGATORIAMENTE segue este contrato.**

---

## 4. NOMENCLATURA TEMPORAL (LEI)

### 4.1 Timestamps (data + hora)

* Sufixo obrigatório:

  * Banco: `_at`
  * Código/Contrato: `At`
* Sempre com timezone

Exemplos válidos:

* `created_at` → `createdAt`
* `paid_at` → `paidAt`
* `scheduled_at` → `scheduledAt`

Exemplos inválidos:

* `created`
* `creation_date`
* `date_created`
* `timestamp`
* `delivery_date`

---

### 4.2 Datas sem hora (uso raro)

* Permitido **somente quando hora NÃO importa**
* Tipo:

  * DB: `DATE`
  * Código: `string` ISO (`YYYY-MM-DD`)

Exemplos válidos:

* `scheduled_date`
* `manufactured_at` (quando aplicável)

Se existe SLA, ordenação, expiração ou deadline → **NÃO é DATE**.

---

## 5. DURAÇÃO ≠ TIMESTAMP

### Regra obrigatória

* Duração representa **tempo decorrido**
* Nunca representa um ponto no tempo
* Sempre possui unidade explícita

Permitido:

* `duration_seconds`
* `duration_minutes`
* `sla_minutes`
* `response_time_seconds`

Proibido:

* `duration`
* `time`
* `duration_min` (ambíguo)
* qualquer duração sem unidade

---

## 6. ETA, SLA E PRAZOS

### ETA

* `eta_at` → timestamp estimado
* `eta_minutes` → duração estimada

### SLA / Deadline

* `deadline_at`
* `sla_minutes`
* `sla_breached_at`

Nunca usar:

* `expected_date`
* `delivery_time`
* `due`

---

## 7. HORÁRIOS SEM DATA

Usar apenas quando **a data não importa**.

* Tipo DB: `TIME`
* Campos:

  * `opens_at`
  * `closes_at`
  * `cutoff_time`

Sempre acompanhado de:

* `timezone` (IANA)

---

## 8. FUSO HORÁRIO (CRÍTICO)

### Regra absoluta

* Apenas timezones IANA

Válido:

* `UTC`
* `America/Sao_Paulo`
* `America/New_York`

Proibido:

* `BRT`
* `GMT-3`
* `-03:00`

---

## 9. EVENTOS

Todo evento DEVE conter:

* `timestamp`
* formato ISO 8601
* UTC (`Z`)

Exemplo canônico:

```json
{
  "eventType": "order.created",
  "timestamp": "2026-02-05T14:30:00Z"
}
```

Eventos **NUNCA** transportam `Date`.

---

## 10. BOUNDARY OFICIAL (ONDE `Date` É PERMITIDO)

`Date` só pode existir em:

* adapters de banco
* adapters de integração externa
* parsing de entrada externa

Responsabilidade do adapter:

* converter `Date` → `string` ISO
* nunca vazar `Date` para o domínio

Se um `Date` passar do adapter → **violação de contrato**.

---

## 11. REGRA DE CONVERSÃO (IMUTÁVEL)

> `Date` ENTRA apenas via boundary
> `Date` MORRE no boundary
> O sistema opera exclusivamente com `string` ISO

---

## 12. REGRESSÃO = FALHA DE PROTOCOLO

Qualquer PR que:

* introduza `Date` fora de adapter
* crie campo temporal sem `_at` / `At`
* use duração sem unidade
* ignore timezone

➡️ **INVALIDA o contrato temporal**
➡️ **EXIGE correção antes de merge**

---

## 13. DECLARAÇÃO FINAL

Este contrato existe para garantir que:

* tempo seja previsível
* auditoria seja possível
* eventos sejam rastreáveis
* o sistema não volte ao estado caótico anterior

**Tempo não é detalhe.
Tempo é infraestrutura.**

---

**FIM DO DOCUMENTO**
