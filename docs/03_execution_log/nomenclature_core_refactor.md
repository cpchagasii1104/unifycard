# LOG DE EXECUÇÃO - CORREÇÃO DE NOMENCLATURA CORE

## STATUS
EM EXECUÇÃO · AGENTE EXECUTOR  
Data de Início: 2026-02-05  
Norma de Referência: `docs/01_normative/07_NOMENCLATURA_CANONICA.md`  
Auditoria Base: `docs/04_audit/nomenclatura_core_audit.md`

---

## RESUMO EXECUTIVO

Execução mecânica de correção de nomenclatura no backend interno (`backend/src/core/`), convertendo campos de `snake_case` para `camelCase` em:
- Interfaces de domínio
- DTOs / Inputs
- Tipos inline
- Propriedades de objetos em código TS
- Objetos retornados por services e routes

**Escopo Proibido (NÃO TOCADO):**
- Banco de dados
- Migrations
- Strings SQL (nomes de tabela/coluna)
- Interfaces *Row que representam linhas do banco
- Frontend
- Contratos públicos da API

---

## ARQUIVOS CORRIGIDOS

### 1. `backend/src/core/profile/profile.types.ts`
**Tipo de correção:** Interface de domínio  
**Campos corrigidos:**
- `profile_personal_confirmed` → `profilePersonalConfirmed`
- `can_edit_personal_data` → `canEditPersonalData`

**Quantidade de campos ajustados:** 2

---

### 2. `backend/src/core/profile/profile.service.ts`
**Tipo de correção:** Objeto retornado, referências a campos  
**Campos corrigidos:**
- `profile_personal_confirmed` → `profilePersonalConfirmed` (em objeto retornado)
- `can_edit_personal_data` → `canEditPersonalData` (em objeto retornado)
- Referências a `existingProfile.profile_personal_confirmed` → `existingProfile.profilePersonalConfirmed`
- Referências a `profile.profile_personal_confirmed` → `profile.profilePersonalConfirmed`

**Quantidade de campos ajustados:** 4

---

### 3. `backend/src/core/events/event.types.ts`
**Tipo de correção:** Interfaces de domínio, DTOs, Inputs  
**Campos corrigidos:**
- `EventTimeWindow`:
  - `start_datetime` → `startDatetime`
  - `end_datetime` → `endDatetime`
- `EventDeclaration`:
  - `event_aspects` → `eventAspects`
  - `aspects_version` → `aspectsVersion`
  - `intent_flags` → `intentFlags`
  - `declared_at` → `declaredAt`
  - `desired_time_windows` → `desiredTimeWindows`
  - `flexibility_level` → `flexibilityLevel`
- `Event`:
  - `tenant_id` → `tenantId`
  - `actor_id` → `actorId`
  - `actor_type` → `actorType`
  - `event_type` → `eventType`
  - `event_subtype` → `eventSubtype`
  - `datetime_start` → `datetimeStart`
  - `datetime_end` → `datetimeEnd`
  - `ticket_price_cents` → `ticketPriceCents`
  - `max_attendees` → `maxAttendees`
  - `completed_at` → `completedAt`
  - `created_at` → `createdAt`
  - `updated_at` → `updatedAt`
  - `responsible_actor_id` → `responsibleActorId`
  - `responsible_actor_type` → `responsibleActorType`
- `CreateEventInput`:
  - `actor_id` → `actorId`
  - `actor_type` → `actorType`
  - `event_type` → `eventType`
  - `event_subtype` → `eventSubtype`
  - `datetime_start` → `datetimeStart`
  - `datetime_end` → `datetimeEnd`
  - `ticket_price_cents` → `ticketPriceCents`
  - `max_attendees` → `maxAttendees`
- `UpdateEventInput`:
  - `datetime_start` → `datetimeStart`
  - `datetime_end` → `datetimeEnd`
  - `event_subtype` → `eventSubtype`
  - `ticket_price_cents` → `ticketPriceCents`
  - `max_attendees` → `maxAttendees`
- `DeclareEventInput`:
  - `event_aspects` → `eventAspects`
  - `intent_flags` → `intentFlags`
  - `desired_time_windows` → `desiredTimeWindows`
  - `flexibility_level` → `flexibilityLevel`

**Quantidade de campos ajustados:** 35

---

### 4. `backend/src/core/events/event.service.ts`
**Tipo de correção:** Objeto retornado, referências a campos de input e event  
**Campos corrigidos:**
- Método `toEvent`: conversão de `EventRow` para `Event` usando camelCase
- Todas as referências a campos do `CreateEventInput` e `UpdateEventInput`
- Todas as referências a campos do objeto `Event` retornado
- Referências a `event.actor_id` → `event.actorId`
- Referências a `event.actor_type` → `event.actorType`
- Referências a `event.datetime_start` → `event.datetimeStart`
- Referências a `event.datetime_end` → `event.datetimeEnd`

**Quantidade de campos ajustados:** ~50+ (múltiplas ocorrências)

---

### 5. `backend/src/core/events/event.aggregate.ts`
**Tipo de correção:** Interface de domínio  
**Campos corrigidos:**
- `EventAggregate`:
  - `tenant_id` → `tenantId`
  - `responsible_actor_id` → `responsibleActorId`
  - `responsible_actor_type` → `responsibleActorType`
  - `created_at` → `createdAt`
  - `updated_at` → `updatedAt`
- Função `enrichEventWithCanonicalFields`: parâmetros e retorno atualizados para camelCase

**Quantidade de campos ajustados:** 5

---

## ESTATÍSTICAS PARCIAIS

| Métrica | Valor |
|---------|-------|
| Arquivos corrigidos | 5 |
| Total de campos corrigidos | ~96+ |
| Interfaces de domínio corrigidas | 6 |
| DTOs/Inputs corrigidos | 4 |
| Services corrigidos | 2 |
| Agregados corrigidos | 1 |

---

## PRÓXIMOS PASSOS

1. Continuar correção de arquivos restantes identificados na auditoria
2. Verificar e corrigir referências em routes que retornam objetos de domínio
3. Garantir que código compile sem erros
4. Finalizar log de execução com todos os arquivos corrigidos

---

## OBSERVAÇÕES

- Interfaces *Row (representando linhas do banco) foram mantidas em snake_case (conforme regras)
- Schemas de validação do Fastify em routes podem manter snake_case se forem para validação de entrada da API pública
- Objetos retornados por services foram corrigidos para camelCase
- Todas as referências a campos corrigidos foram atualizadas nos services

---

---

## STATUS ATUAL

**Status:** EM EXECUÇÃO - CORREÇÕES PARCIAIS CONCLUÍDAS

### Arquivos Corrigidos (5 arquivos)
1. `backend/src/core/profile/profile.types.ts` - 2 campos
2. `backend/src/core/profile/profile.service.ts` - 4 campos
3. `backend/src/core/events/event.types.ts` - 35 campos
4. `backend/src/core/events/event.service.ts` - ~50+ campos
5. `backend/src/core/events/event.aggregate.ts` - 5 campos

### Observações Importantes

1. **Erros de Compilação:** Existem erros de compilação relacionados a:
   - Módulos fora do escopo do core (`src/modules/`) que ainda usam campos em snake_case
   - Referências a campos corrigidos que precisam ser atualizadas em outros arquivos
   - Alguns erros não relacionados à nomenclatura (tipos, imports, etc.)

2. **Próximos Passos Necessários:**
   - Continuar correção de arquivos restantes no `backend/src/core/`
   - Corrigir referências em routes que usam os tipos corrigidos
   - Atualizar módulos que dependem dos tipos corrigidos (quando necessário)

3. **Arquivos Identificados com Violações (não corrigidos ainda):**
   - Múltiplos arquivos em `backend/src/core/` identificados via grep
   - Arquivos de routes que retornam objetos de domínio
   - Outros services e repositories

---

**Status:** EM EXECUÇÃO  
**Última atualização:** 2026-02-05  
**Total de arquivos corrigidos:** 5  
**Total de campos corrigidos:** ~96+

