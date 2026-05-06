Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
ARQUIVO NOVO 3/3 — MATRIZ_FONTES_DE_VERDADE.md

# Matriz de Fontes de Verdade — UnifiCard

## Objetivo
Evitar duplicação estrutural (“dois lugares mandando no mesmo assunto”).

## Regras
- Para cada domínio abaixo, existe UMA fonte canônica.
- Outras tabelas/campos podem existir como read-model (espelho), mas nunca como “verdade”.

## Domínios e Fontes Canônicas

### Tempo / Agenda
- Fonte canônica: Unified Availability (migration 144, `unified-availability.service.ts`)
- Unified Calendar = READ-MODEL (não usar para decisão temporal)
- Eventos: referenciam/sincronizam; não criam "calendário paralelo".
- Profissionais/serviços: disponibilidade consulta Unified Availability.

### Identidade e Ação
- Fonte canônica: Actor (quem faz)
- Entidades (empresa/grupo): devem ter actor válido ou não podem operar.

### Visibilidade / Publicação / Convites
- Fonte canônica: Publication Engine (metadados + auditoria)
- Regras: visibilidade ≠ publicação ≠ convite (separados).

### Especificação declarativa do evento
- Fonte canônica: EventSpec (snapshot imutável)
- Não decide nada. Serve para declarar e reconstruir intenção do usuário.

### RFQ e Oportunidades
- Fonte canônica: Event RFQ (no modelo existente do evento) + Dispatch + Inbox
- Matching: apenas sugestão (sem ranking/score/auto-escolha).

### Auditoria
- Fonte canônica: append-only logs
- Nunca reescrever história; apenas anexar.

### Categorias
- Fonte canônica: `core/categories/categories.service.ts`
- `core/category/category.service.ts` = LEGADO (uso proibido em novo código)

### Trust / Reputation
- Trust / Reputation = READ-MODEL OBSERVACIONAL
- NÃO decide comportamento
- NÃO bloqueia ações
- NÃO substitui decisão humana

## Anti-patterns proibidos
- Criar um “segundo calendário”
- Usar categoria/subtipo para decisão de negócio
- Transformar reação/métrica em ranking automático
- Criar fluxo paralelo que replica RFQ/dispatch/inbox

## Checklist de pré-merge (mínimo)
1) Qual é a fonte canônica do domínio tocado?
2) Existe algo equivalente no código/banco/migrations?
3) Isso cria um caminho paralelo?
4) Está autorizado por contrato?
Se qualquer resposta for “não sei”, bloquear.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- CATEGORY_SCOPES_SEMANTICS.md
- CORE_IMUTAVEL.md
- CORE_SPLIT_PAGAMENTO_CANONICO.md
<!-- AUTO-GENERATED-END -->