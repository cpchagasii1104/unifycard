
Objetivo:
- evitar duplicação de dados
- evitar divergência entre front-end e back-end
- impedir criação de fontes paralelas de verdade
- eliminar dedução futura por IA ou desenvolvedor

---

## PRINCÍPIOS DE MAPEAMENTO

- Cada pergunta gera **apenas um campo**
- Nenhuma pergunta gera decisão
- Nenhum campo executa lógica
- Campos podem ser nulos / indefinidos
- Ausência de dado ≠ resposta negativa

---

## ETAPA 0 — IDENTIFICAÇÃO DO EVENTO

| Pergunta | Campo EventSpec | Observações |
|--------|----------------|-------------|
| Nome do evento | `project_name` | Identificação humana |
| Ticket do evento | `event_ticket` | Gerado pelo sistema |

---

## ETAPA 1 — PERFIL DO ANIVERSÁRIO

| Pergunta | Campo EventSpec | Observações |
|--------|----------------|-------------|
| Faixa etária | `birthday_profile` | Vocabulário fechado |
| Nome do aniversariante | `birthday_person.name` | Opcional |
| Data de nascimento | `birthday_person.birth_date` | ISO-8601 |
| Sexo / gênero | `birthday_person.gender` | Nunca decisório |

⚠️ Observação  
A informação “o aniversariante é você?” é **contextual de UX**  
e **não é persistida** no EventSpec.

---

## ETAPA 2 — PARTICIPANTES

| Pergunta | Campo EventSpec | Observações |
|--------|----------------|-------------|
| Total de convidados | `attendance.total` | Estimativa |
| Adultos | `attendance.adults` | Opcional |
| Crianças | `attendance.children` | Opcional |
| Idosos | `attendance.elderly` | Opcional |

---

## ETAPA 3 — LOCAL DO EVENTO

### Existência de local

| Pergunta | Campo EventSpec |
|--------|----------------|
| Já tem local? | `location.has_venue` |

---

### Endereço (se houver local)

| Pergunta | Campo EventSpec |
|--------|----------------|
| CEP | `location.address.cep` |
| Número | `location.address.number` |
| Complemento | `location.address.complement` |

---

### Estrutura existente no local

| Opção marcada | Campo EventSpec |
|--------------|----------------|
| MESAS | `location.provided_items[]` |
| CADEIRAS | `location.provided_items[]` |
| COZINHA | `location.provided_items[]` |
| SOM | `location.provided_items[]` |
| ILUMINACAO | `location.provided_items[]` |
| ESPACO_INFANTIL | `location.provided_items[]` |
| AREA_EXTERNA | `location.provided_items[]` |
| ACESSIBILIDADE | `location.provided_items[]` |

⚠️ Regra  
`provided_items` **NÃO elimina** necessidades futuras.

---

### Região e tipo de espaço (se não houver local)

| Pergunta | Campo EventSpec |
|--------|----------------|
| Cidade desejada | `location.region.city` |
| Bairro / região | `location.region.area` |
| Tipo de espaço | `location.desired_venue_types[]` |

---

## ETAPA 4 — ESTILO E TEMA

| Pergunta | Campo EventSpec | Observações |
|--------|----------------|-------------|
| Estilo geral | `style.general` | Contextual |
| Tema | `style.theme` | Nunca cria serviço |

---

## ETAPA 5 — ATIVIDADES

### Infantil

| Opção | Campo EventSpec |
|-----|----------------|
| BRINQUEDOS | `activities.entertainment[]` |
| RECREADOR | `activities.entertainment[]` |
| PERSONAGENS | `activities.entertainment[]` |

---

### Adolescente / 15 anos

| Opção | Campo EventSpec |
|-----|----------------|
| DJ | `activities.entertainment[]` |
| BANDA | `activities.entertainment[]` |
| COREOGRAFIA | `activities.entertainment[]` |
| ROUPA_ESPECIAL | `activities.special_outfit.required` |

Modo:

| Opção | Campo |
|-----|-------|
| COMPRA | `activities.special_outfit.mode` |
| ALUGUEL | `activities.special_outfit.mode` |

---

### Adulto / Terceira idade

| Opção | Campo EventSpec |
|-----|----------------|
| MUSICA_AMBIENTE | `activities.entertainment[]` |
| EVENTO_TRANQUILO | `activities.entertainment[]` |
| ALIMENTACAO_LEVE | `activities.food_focus` |

---

## ETAPA 6 — MÚSICA E AUDIOVISUAL

| Pergunta | Campo EventSpec |
|--------|----------------|
| Terá música | `music.present` |
| Tipo | `music.types[]` |
| Estilo musical | `music.styles[]` |
| Porte | `music.formation_size` |
| Equipamentos | `music.equipment_needs[]` |
| Origem equipamento | `music.equipment_source_hypothesis` |
| Volume | `music.volume` |
| Fotografia | `audiovisual.photography` |
| Filmagem | `audiovisual.filming` |

---

## ETAPA 7 — SERVIÇOS DE APOIO

| Opção | Campo EventSpec |
|-----|----------------|
| LIMPEZA | `support_services[]` |
| GARCONS | `support_services[]` |
| SEGURANCA | `support_services[]` |
| DECORACAO | `support_services[]` |

---

## ETAPA 8 — DATA E HORÁRIO

| Pergunta | Campo EventSpec |
|--------|----------------|
| Data | `time_window.date` |
| Janela | `time_window.range` |
| Horário início | `time_window.start_time` |
| Horário fim | `time_window.end_time` |
| Flexível | `time_window.flexible` |

---

## GOVERNANÇA — RESPONSIBLE ACTOR

| Origem | Campo |
|------|-------|
| Contexto autenticado | `responsible_actor_id` |
| Contexto autenticado | `responsible_actor_type` |

⚠️ Estes campos:
- não vêm do formulário
- não são inferidos
- são obrigatórios no EventSpec

---

## REGRA FINAL

> Este mapeamento existe para **eliminar interpretação**.  
> Se algo não estiver aqui, **não deve ser inferido**.
