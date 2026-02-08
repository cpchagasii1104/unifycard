# TEMPORAL_PREFLIGHT.md

## STATUS

OBRIGATÓRIO · BLOQUEANTE · ANTI-REGRESSÃO

Este checklist deve ser executado **ANTES de qualquer merge** que:

* crie ou altere campos temporais
* toque em contratos, eventos, repositories ou services
* mexa em adapters ou boundaries
* introduza novos domínios ou módulos

**Se qualquer item falhar → PR NÃO PODE SER MERGEADO.**

---

## 1. CONTRATO TEMPORAL (VALIDAÇÃO GLOBAL)

* [ ] Todos os campos temporais seguem o `TEMPORAL_CONTRACT.md`
* [ ] Não existe nenhuma exceção “temporária”
* [ ] Nenhuma decisão temporal foi tomada fora do contrato

---

## 2. TIPO DE DADO (CRÍTICO)

### Date

* [ ] Nenhum `Date` foi introduzido em:

  * contratos
  * DTOs
  * services
  * repositories
  * eventos
* [ ] Todo `Date` existente está restrito a adapters/boundaries
* [ ] Nenhum `Date` atravessa boundary

### String ISO

* [ ] Todos os campos temporais no código são `string`
* [ ] Formato ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ` ou equivalente válido)
* [ ] Não existem formatos locais ou customizados

---

## 3. NOMENCLATURA TEMPORAL

### Timestamps (data + hora)

* [ ] Todos terminam com `_at` (DB) / `At` (código)
* [ ] Nenhum campo usa:

  * `date`
  * `created`
  * `timestamp`
  * `time` genérico

### Datas sem hora

* [ ] Usadas **apenas** quando hora não importa
* [ ] Tipo correto (`DATE` no DB)
* [ ] Nenhum SLA, deadline ou ordenação depende delas

---

## 4. DURAÇÃO (TEMPO DECORRIDO)

* [ ] Nenhuma duração sem unidade explícita
* [ ] Unidades permitidas:

  * `_seconds`
  * `_minutes`
  * `_hours` (quando aplicável)
* [ ] Nenhum uso de:

  * `duration`
  * `time`
  * `duration_min`
  * nomes ambíguos

---

## 5. ETA, SLA E PRAZOS

* [ ] `eta_at` usado apenas para ponto estimado no tempo
* [ ] `eta_minutes` usado apenas para duração estimada
* [ ] `deadline_at` presente quando existe prazo real
* [ ] Nenhum uso de:

  * `expected_date`
  * `delivery_time`
  * `due`

---

## 6. EVENTOS

* [ ] Todo evento contém campo `timestamp`
* [ ] `timestamp` está em ISO 8601 UTC (`Z`)
* [ ] Nenhum evento carrega `Date`
* [ ] Nenhum evento omite tempo quando ele é relevante

---

## 7. HORÁRIOS SEM DATA

* [ ] Campos de horário usam `TIME`
* [ ] Usados apenas quando a data não importa
* [ ] Sempre acompanhados de `timezone`

---

## 8. FUSO HORÁRIO

* [ ] Apenas timezones IANA
* [ ] Nenhum uso de:

  * `BRT`
  * `GMT-3`
  * offsets (`-03:00`)
* [ ] Conversões de fuso feitas apenas em boundary/adapters

---

## 9. BOUNDARIES (ONDE O TEMPO ENTRA)

* [ ] Existe um ponto claro onde `Date` entra
* [ ] Conversão `Date → string ISO` ocorre imediatamente
* [ ] Nenhuma lógica de negócio depende de `Date`

---

## 10. REPOSITORIES E QUERIES

* [ ] Repositories não retornam `Date`
* [ ] Queries não fazem parsing temporal implícito
* [ ] Nenhum cast (`any`, `unknown`) foi usado para “passar” tipo temporal

---

## 11. CHECK FINAL (OBRIGATÓRIO)

* [ ] O código compila (`tsc`) sem warnings temporais
* [ ] Nenhum comentário indica “arrumar depois”
* [ ] Nenhuma exceção foi criada fora da norma
* [ ] O autor do PR consegue explicar:

  > “Onde o tempo entra, onde ele é convertido e onde ele é usado”

Se não consegue explicar → **o PR falha**.

---

## 12. DECLARAÇÃO FINAL

Este checklist existe para garantir que:

* o sistema não volte ao estado inconsistente anterior
* datas e horários sejam previsíveis
* eventos sejam auditáveis
* o backend permaneça coerente mesmo sob pressão

**Se este checklist não foi seguido,
o tempo no sistema NÃO é confiável.**

---

**FIM DO DOCUMENTO**
