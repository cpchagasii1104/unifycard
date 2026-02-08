# FASE 5 — DATABASE GUIDANCE · FESTA DE ANIVERSÁRIO

**Status:** FASE 5 (Exploração estruturada)  
**Autoridade:** NÃO CANÔNICO · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

Este documento define **como o banco de dados deve ser utilizado**
para armazenar a **intenção declarada** de eventos de Festa de Aniversário,
sem violar os contratos da pasta `treinamento`.

---

## PRINCÍPIO FUNDAMENTAL

> **Banco de dados armazena estado declarado.  
> Banco de dados NÃO armazena decisão, regra ou execução.**

Qualquer uso fora disso é violação de governança.

---

## TABELA AUTORIZADA

### `event_specs`

Esta é a **única tabela** autorizada para persistir os dados do formulário
nesta fase.

Campos relevantes:

- `spec_id`
- `event_id`
- `answers` (JSONB)
- `created_at`

⚠️ **Nenhuma tabela nova deve ser criada na FASE 5.**

---

## COLUNA CANÔNICA

### `event_specs.answers` (JSONB)

Todo o conteúdo do formulário de Festa de Aniversário
deve ser persistido **exclusivamente** dentro deste campo.

Exemplo de estrutura esperada:

```json
{
  "project_name": "Festa de Aniversário do João",
  "event_ticket": "EVT-2026-000183",
  "birthday_profile": "INFANTIL",
  "birthday_person": {
    "name": "João",
    "birth_date": "2018-05-12",
    "gender": "MASCULINO"
  },
  "attendance": {
    "total": 35,
    "adults": 20,
    "children": 15
  },
  "location": {
    "has_venue": false,
    "region": {
      "city": "Curitiba",
      "area": "Zona Norte"
    },
    "desired_venue_types": ["ESPACO_INFANTIL"]
  },
  "style": {
    "general": "TEMATICA",
    "theme": "Super Heróis"
  },
  "activities": {
    "entertainment": ["BRINQUEDOS", "RECREADOR"]
  },
  "music": {
    "present": true,
    "types": ["DJ"],
    "styles": ["INFANTIL"],
    "equipment_needs": ["SOM"],
    "volume": "MEDIO"
  },
  "audiovisual": {
    "photography": true,
    "filming": false
  },
  "support_services": ["LIMPEZA"],
  "time_window": {
    "range": "FIM_DE_SEMANA",
    "flexible": true
  }
}
REGRAS DE MODELAGEM (OBRIGATÓRIAS)
REGRA 1 — Nada fora do JSONB
Não criar coluna paralela

Não duplicar campo em events

Não “normalizar” intenção nesta fase

REGRA 2 — Ausência ≠ Negação
Campo ausente significa:

“não informado”

Nunca assumir como:

“não precisa”

REGRA 3 — Dados são mutáveis
O usuário pode alterar:

quantidade

local

atividades

música

O sistema deve aceitar múltiplas versões do EventSpec

REGRA 4 — Ticket é contexto, não chave de execução
event_ticket:

identifica planejamento

conecta orçamentos e propostas

não executa transação

O QUE É EXPLICITAMENTE PROIBIDO
❌ Criar tabela birthday_events
❌ Criar tabela event_needs
❌ Criar coluna needs_* em events
❌ Usar JSONB como regra de decisão
❌ Inferir fornecedor a partir de campo declarativo

REGRA FINAL
Se virar regra, não é banco.
Se virar decisão, não é EventSpec.