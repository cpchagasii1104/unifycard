# FASE 5 — EVENTSPEC v1 · FESTA DE ANIVERSÁRIO

**Status:** FASE 5 (Snapshot declarativo de intenção)  
**Autoridade:** NÃO CANÔNICO · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

Este documento define o **EventSpec v1** para eventos do tipo **Festa de Aniversário**.

Ele descreve **como a intenção do usuário é persistida**,  
não como o sistema executa ações.

---

## PRINCÍPIOS FUNDAMENTAIS

- EventSpec é um **snapshot declarativo**
- Nenhum campo aqui:
  - cria contrato
  - cria obrigação
  - cria transação
  - dispara execução automática
- O EventSpec **não decide nada**
- O EventSpec **não substitui julgamento humano**

---

## LOCAL DE PERSISTÊNCIA

Tabela:
- `event_specs`

Coluna:
- `answers` (JSONB)

Este documento descreve **exclusivamente** a estrutura esperada dentro de:

event_specs.answers

yaml
Copiar código

---

## CAMPOS RAIZ (OBRIGATÓRIOS)

### project_name
```ts
project_name: string
Nome humano do evento

Definido pelo usuário

Editável

Usado para listagem em “Meus eventos”

event_ticket
ts
Copiar código
event_ticket: string
Gerado automaticamente pelo sistema

Identificador técnico estável

Não editável pelo usuário

Âncora para:

orçamentos

propostas

carrinho

transações futuras

⚠️ O ticket NÃO é transação.

PERFIL DO ANIVERSÁRIO (VOCABULÁRIO FECHADO)
ts
Copiar código
birthday_profile?: "INFANTIL" | "JOVEM" | "ADULTO" | "TERCEIRA_IDADE" | "NEUTRO"
Controla ramificação do formulário

Não cria necessidade

Não cria serviço

Não cria fornecedor

DADOS DO ANIVERSARIANTE (CONTEXTO)
ts
Copiar código
birthday_person?: {
  name?: string
  birth_date?: string // ISO-8601
  gender?: "MASCULINO" | "FEMININO" | "NAO_INFORMADO"
}
Informações puramente contextuais

Nunca usadas para decisão automática

Nunca obrigatórias

PARTICIPANTES (ESTIMATIVA DECLARADA)
ts
Copiar código
attendance?: {
  total?: number
  adults?: number
  children?: number
  elderly?: number
}
Valores estimados

Podem ser incompletos

Base para orçamento e logística

LOCAL DO EVENTO
ts
Copiar código
location?: {
  has_venue?: boolean
  address?: {
    cep?: string
    number?: string
    complement?: string
  }
  region?: {
    city?: string
    area?: string
  }
  desired_venue_types?: VenueType[]
  provided_items?: ProvidedItem[]
}
⚠️ Regras duras

provided_items não elimina necessidades futuras

Adequação é sempre considerada DESCONHECIDA

ESTILO E TEMA
ts
Copiar código
style?: {
  general?: "SIMPLES" | "ANIMADA" | "SOFISTICADA" | "TEMATICA" | "INDEFINIDA"
  theme?: string
}
⚠️ Tema:

Não cria serviço

Apenas classifica contexto

ATIVIDADES DECLARADAS
ts
Copiar código
activities?: {
  entertainment?: EntertainmentType[]
  food_focus?: boolean
  special_outfit?: {
    required?: boolean
    mode?: "COMPRA" | "ALUGUEL" | "INDEFINIDO"
  }
}
Lista de intenções

Não implica contratação

Não implica disponibilidade

MÚSICA E AUDIOVISUAL
ts
Copiar código
music?: {
  present?: boolean
  types?: MusicType[]
  styles?: MusicStyle[]
  formation_size?: "PEQUENO" | "MEDIO" | "GRANDE" | "INDEFINIDO"
  equipment_needs?: EquipmentType[]
  equipment_source_hypothesis?: "LOCAL" | "ARTISTA" | "ALUGUEL" | "COMBINADO" | "INDEFINIDO"
  volume?: "BAIXO" | "MEDIO" | "ALTO" | "INDEFINIDO"
}

audiovisual?: {
  photography?: boolean
  filming?: boolean
}
Nenhum campo escolhe fornecedor

Nenhum campo cria booking

SERVIÇOS DE APOIO
ts
Copiar código
support_services?: SupportService[]
DATA E JANELA DE TEMPO
ts
Copiar código
time_window?: {
  date?: string
  range?: string
  start_time?: string
  end_time?: string
  flexible?: boolean
}
⚠️ Sempre janela desejada
❌ Nunca agenda fixa
❌ Nunca executável

RESPONSIBLE ACTOR (GOVERNANÇA)
ts
Copiar código
responsible_actor_id: string
responsible_actor_type: string
Obrigatórios no EventSpec

Obtidos do contexto autenticado

Nunca inferidos por sessão, tenant ou heurística

Nunca definidos pelo formulário

RELAÇÃO EVENTSPEC ↔ EVENTDECLARATION
event_specs.answers representa o EventSpec

EventSpec é snapshot imutável do questionário (FASE 5)

EventSpec NÃO é EventDeclaration

EventDeclaration:

pertence ao aggregate Event

usa vocabulário fechado

pode ser derivado do EventSpec

não é criado nem inferido na FASE 5

VOCABULÁRIOS FECHADOS
EntertainmentType
BRINQUEDOS

RECREADOR

PERSONAGENS

DJ

BANDA

COREOGRAFIA

MUSICA_AMBIENTE

OUTRO

VenueType
SALAO

CHACARA

CLUBE

ESPACO_INFANTIL

CASA_EVENTOS

ProvidedItem
MESAS

CADEIRAS

COZINHA

SOM

ILUMINACAO

ESPACO_INFANTIL

AREA_EXTERNA

ACESSIBILIDADE

MusicType
DJ

BANDA

PLAYLIST

MusicStyle
POP

ROCK

SERTANEJO

REGGAE

ELETRONICA

VARIADO

EquipmentType
SOM

LUZ

PALCO

TELAO

SupportService
LIMPEZA

GARCONS

SEGURANCA

DECORACAO

REGRA FINAL DO EVENTSPEC
O EventSpec é um documento vivo de intenção.
Ele organiza contexto, mas não executa realidade.