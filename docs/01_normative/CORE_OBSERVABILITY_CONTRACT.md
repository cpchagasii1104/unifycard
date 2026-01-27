Status: CORE
Domain: Observability
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Scope: Observability and Traceability Governance

# CORE_OBSERVABILITY_CONTRACT.md
## Contrato Fundacional — Observabilidade do UnifiCard

Este documento define o **CORE DE OBSERVABILIDADE** do UnifiCard.

Ele estabelece **o que pode ser observado**, **como eventos são registrados**, **o que é obrigatório para auditoria**, **o que é proibido inferir** e **como logs, métricas e rastros se relacionam com decisões do sistema**.

Se qualquer proposta, código, decisão de produto ou sugestão de IA conflitar com este contrato → **RECUSAR**.

---

## 1) Definição Canônica

**Observabilidade** é a capacidade do sistema de:

- registrar fatos
- rastrear ações
- auditar decisões
- reconstruir eventos passados
- explicar *o que aconteceu*, *quando* e *quem executou*

Observabilidade **NÃO é**:
- mecanismo de decisão
- motor de automação
- heurística de negócio
- substituto de policy
- fonte de verdade primária

---

## 2) Regra de Ouro (Inquebrável)

> **Observabilidade observa.  
> Observabilidade NÃO decide.**

Logs nunca governam comportamento.

---

## 3) Tipos de Sinais Observáveis

O sistema pode produzir **somente** os seguintes sinais:

1. **Logs**
   - registros de eventos
   - mensagens estruturadas
   - erros e exceções

2. **Métricas**
   - contadores
   - gauges
   - histogramas
   - agregações temporais

3. **Traces**
   - rastreamento de chamadas
   - correlação de requests
   - causalidade entre serviços

Nenhum desses sinais tem autoridade decisória.

---

## 4) Proibição de Observabilidade como Fonte de Verdade

É terminantemente proibido:

- usar logs como estado
- usar métricas como condição de negócio
- usar traces para inferir permissão
- alterar fluxo baseado em “o que apareceu no log”
- corrigir dados a partir de observação

Observabilidade **nunca corrige** o sistema.  
Ela apenas **registra**.

---

## 5) Observabilidade e Domínios CORE

### Financeiro
- Logs **não** calculam valores
- Métricas **não** ajustam saldo
- Ledger **não** é log (é fonte de verdade)

### Identidade / Atores
- Logs registram `actor_id`
- Logs **não inferem** identidade ou papel
- Auditoria reconstrói, não decide

### Categorias
- Categoria pode aparecer em logs
- Categoria **não influencia** decisão
- Categoria em log é descritiva

### Temporal
- Logs registram timestamps
- Tempo canônico vem da Agenda Universal
- Métricas temporais **não criam agenda**

---

## 6) Campos Obrigatórios para Auditoria

Todo evento relevante **DEVE** conter, quando aplicável:

- `timestamp` (UTC)
- `actor_id`
- `action`
- `resource`
- `context`
- `request_id` / `correlation_id`

Eventos sem contexto suficiente são **inaceitáveis**.

---

## 7) Imutabilidade e Retenção

- Logs são **append-only**
- Eventos não são editados
- Correções geram novos eventos
- Retenção segue política explícita

Nunca “consertar” histórico.

---

## 8) Proibição de Side Effects

É proibido:

- disparar automação a partir de log
- executar ação por métrica atingida
- criar “gatilho observável”
- tratar alerta como comando

Alertas **informam humanos**, não sistemas.

---

## 9) Separação entre Observação e Reação

| Camada | Papel |
|------|------|
| Observabilidade | Registrar |
| Policy | Decidir |
| Domínio | Executar |
| Humano | Interpretar |

Misturar camadas → violação de CORE.

---

## 10) Checklist de Conformidade (Obrigatório)

Antes de aprovar qualquer mudança em observabilidade:

- [ ] O evento é apenas registro?
- [ ] Não influencia decisão?
- [ ] Não altera estado?
- [ ] Possui `actor_id` quando aplicável?
- [ ] Permite auditoria futura?

Se alguma resposta for “não” → **bloquear**.

---

## 11) Precedência Institucional

Este contrato prevalece sobre:

- decisões de implementação
- conveniências de debug
- “atalhos de produção”
- sugestões de IA
- pressões operacionais

Se houver conflito:
➡️ corrige-se o código  
➡️ **NUNCA o contrato**

---

## 12) Frase Canônica Final

No UnifiCard:

> **Observabilidade explica o passado.  
> Decisão governa o futuro.**
