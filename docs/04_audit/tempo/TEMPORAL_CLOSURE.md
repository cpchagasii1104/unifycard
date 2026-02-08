# TEMPORAL_CLOSURE.md

## Status

**FECHADO**

Este documento encerra formalmente o eixo de **DATA / TEMPO** do sistema.

A partir deste ponto, qualquer alteração relacionada a tempo deve respeitar
integralmente as decisões aqui registradas. O que permanece pendente **não é**
mais um problema temporal, mas **dívida arquitetural explicitamente mapeada**.

---

## Escopo do saneamento temporal

O saneamento temporal teve como objetivos:

* Eliminar inconsistências de nomenclatura
* Unificar contratos de data/hora
* Definir boundaries claros para uso de `Date`
* Impedir regressão futura
* Revelar falhas arquiteturais ocultas

O escopo **não incluiu** refactors estruturais profundos.
Esses foram **intencionalmente apenas identificados**, não executados.

---

## Decisões canônicas (lei do sistema)

### 1. Contrato temporal

* `Date` **NÃO é tipo de domínio**
* `Date` **NÃO é permitido** em:

  * services
  * controllers
  * routes
  * contratos públicos
* Tempo no sistema é representado como **`string` ISO 8601**
* `Date` só pode existir **no boundary de banco** (repositories / acesso a dados)

---

### 2. Nomenclatura

* Campos temporais usam sufixo `_at` / `At`
* Não existem exceções
* Durações devem explicitar unidade (`_seconds`, `_minutes`, etc.)

Status: **FECHADO**

---

## Correções realizadas

### ✔️ PADRÃO C — Uso indevido de `.toISOString()`

* Removidas chamadas de `.toISOString()` em valores já tipados como `string`
* Correção aplicada em lote
* Erros TS2551 eliminados

Status: **FECHADO**

---

### ✔️ PADRÃO B2 — Boundary de banco

* Repositories e mappers corrigidos
* Conversão `Date → string` feita **exclusivamente no boundary**
* `Date` não vaza mais dos repositories corrigidos

Status: **FECHADO**

---

### ✔️ PADRÃO B3 — Services sem `Date`

* Removidos fallbacks ilegais (`|| new Date()`)
* Nenhuma conversão feita em services
* Nenhum contrato foi quebrado

Status: **FECHADO (PARCIAL, CONFORME REGRA)**

---

## Pendências identificadas (NÃO temporais)

Os seguintes casos **NÃO foram corrigidos de propósito**:

* Services que fazem **query direta no banco**
* Services que recebem `Date` sem passar por repository
* Campos temporais obrigatórios sem valor `string` disponível no escopo

Esses casos:

* **NÃO** são erro de data/tempo
* **NÃO** são resolvidos por tipagem
* **SÃO** dívida arquitetural

Eles devem ser tratados em um **eixo separado**, por exemplo:

> “Isolamento de acesso a dados / proibição de query direta em service”

---

## Arquivos impactados (resumo)

* **Repositories:** corrigidos onde necessário
* **Services:**

  * correções mecânicas aplicadas quando seguras
  * casos estruturais **explicitamente bloqueados**
* Nenhum ajuste foi feito fora do escopo temporal

---

## Regra anti-regressão (obrigatória)

A partir deste fechamento:

* ❌ É proibido reintroduzir `Date` fora do boundary
* ❌ É proibido usar `.toISOString()` em valores `string`
* ❌ É proibido criar `Date` em services
* ❌ É proibido “resolver rápido” violando o contrato temporal

Qualquer PR que viole essas regras **deve ser rejeitado**.

---

## Conclusão

O saneamento temporal:

* Corrigiu o passado
* Estabilizou o presente
* Expôs problemas reais de arquitetura
* Criou um contrato claro para o futuro

O eixo **DATA / TEMPO está oficialmente encerrado**.

Próximos trabalhos devem partir deste estado como **baseline imutável**.

---

## Evidências de Auditoria

O fechamento do eixo DATA/TEMPO é sustentado pelos seguintes relatórios:

* `docs/04_audit/TemporalBusiness.md`
* `docs/04_audit/TemporalDomain.md`
* `docs/04_audit/TemporalIO.md`
* `docs/04_audit/TemporalSummary.md`

Esses documentos mapeiam integralmente o uso de tempo no backend,
**sem alteração de código**, em **modo de auditoria**.

---

**FIM DO DOCUMENTO**

