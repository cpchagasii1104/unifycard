# GUIDELINE OPERACIONAL — METADATA DE CONTEXTO NA AGENDA UNIVERSAL

## STATUS
OPERACIONAL · NÃO-CANÔNICO · VINCULANTE POR GOVERNANÇA

---

## OBJETIVO

Definir **como usar metadata de contexto** (`WORK`, `LEISURE`, `STUDY`) na **Agenda Universal**, **sem violar o Core Temporal**.

Este documento existe para:
- Evitar decisões automáticas indevidas
- Evitar criação de agendas paralelas
- Padronizar UX e leitura de dados
- Servir de referência para frontend, backend e IA executora

---

## PRINCÍPIO FUNDAMENTAL

> **Tempo é Core. Contexto é descrição.**

- A Agenda Universal continua sendo **UMA só**
- `start_datetime` e `end_datetime` são a **única verdade temporal**
- Metadata **NUNCA decide**, **NUNCA bloqueia**, **NUNCA resolve conflito**

---

## ESTRUTURA DE METADATA AUTORIZADA

```json
{
  "context": "WORK" | "LEISURE" | "STUDY" | null,
  "notes": "string opcional",
  "tags": ["string"]
}
```

### Regras
- `context` é **opcional**
- `context` é **descritivo**
- `context` não altera comportamento do sistema

---

## USOS PERMITIDOS

### UX / Frontend
- Seletor de contexto **APENAS na tela de PERFIL**
- Exibição visual diferenciada (cores, ícones, labels)
- Filtros visuais (read-model)
- Sugestões **não vinculantes** (ex: "você tem muito WORK esta semana")

### Backend / Read-models
- Relatórios
- Analytics
- Agrupamentos estatísticos

---

## USOS PROIBIDOS (ABSOLUTOS)

🚫 Decidir comportamento
```ts
if (context === 'WORK') bloquear('LEISURE') // PROIBIDO
```

🚫 Bloquear agenda automaticamente

🚫 Criar exceções temporais

🚫 Criar agendas paralelas

🚫 Resolver conflitos automaticamente

🚫 Alterar `start_datetime` / `end_datetime`

---

## BOTÃO "DISPONÍVEL AGORA"

Classificação: **ESTADO EFÊMERO**

Regras:
- Afeta apenas o momento atual
- Não altera agenda futura
- Não altera metadata persistida
- Não cancela contextos existentes

---

## TELAS E RESPONSABILIDADES

### PERFIL (NÚCLEO DA AGENDA)
- Define horários
- Define contexto
- Cria Agenda Universal

### EVENTOS / SERVIÇOS / OFERTAS
- Selecionam data e hora
- NÃO definem contexto
- NÃO alteram agenda base

---

## CHECKLIST DE CONFORMIDADE

Antes de qualquer implementação:
- [ ] Metadata é apenas descritiva
- [ ] Nenhuma decisão automática
- [ ] Nenhum bloqueio automático
- [ ] Nenhuma agenda paralela
- [ ] UX orienta, não decide

---

## FRASE DE GUARDA

> **Metadata descreve. Core decide.**

Se qualquer regra violar isso → IMPLEMENTAÇÃO BLOQUEADA.

