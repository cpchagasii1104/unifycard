
As páginas abaixo são carregadas **exclusivamente**
por meio do Page Registry da FASE 5.

---

## 4. DESCRIÇÃO DAS PÁGINAS

---

### 4.1 CommonProjectNamePage

**Objetivo**  
Capturar o nome humano do evento.

**Campos EventSpec permitidos**
- `project_name`

**Restrições**
- Campo obrigatório
- Texto livre
- Nunca gera regra
- Pode ser alterado antes do fechamento

---

### 4.2 BirthdayProfilePage

**Objetivo**  
Coletar o perfil geral do aniversário e dados contextuais do aniversariante.

**Campos EventSpec permitidos**
- `birthday_profile`
- `birthday_person.name`
- `birthday_person.birth_date`
- `birthday_person.gender`

**Campos explicitamente proibidos**
- qualquer campo fora de `birthday_*`

**Observações**
- Dados puramente contextuais
- Nunca decisórios
- Controlam apenas visibilidade de páginas subsequentes (via Registry, não via lógica)

---

### 4.3 BirthdayAttendancePage

**Objetivo**  
Coletar estimativa de participantes.

**Campos EventSpec permitidos**
- `attendance.total`
- `attendance.adults`
- `attendance.children`
- `attendance.elderly`

**Restrições**
- Todos os campos são opcionais
- Valores são estimativos
- Ausência de valor ≠ resposta negativa

---

### 4.4 BirthdayLocationPage

**Objetivo**  
Declarar situação e intenção de local do evento.

**Campos EventSpec permitidos**
- `location.has_venue`
- `location.address.cep`
- `location.address.number`
- `location.address.complement`
- `location.region.city`
- `location.region.area`
- `location.desired_venue_types[]`
- `location.provided_items[]`

**Regras duras**
- `provided_items` não elimina necessidade futura
- Adequação é sempre considerada desconhecida

---

### 4.5 BirthdayStyleThemePage

**Objetivo**  
Coletar estilo geral e eventual tema da festa.

**Campos EventSpec permitidos**
- `style.general`
- `style.theme`

**Regras duras**
- Tema nunca cria serviço
- Tema nunca cria fornecedor
- Tema apenas classifica contexto

---

### 4.6 BirthdayActivitiesPage

**Objetivo**  
Registrar atividades e intenções associadas ao tipo de aniversário.

**Campos EventSpec permitidos**
- `activities.entertainment[]`
- `activities.food_focus`
- `activities.special_outfit.required`
- `activities.special_outfit.mode`

**Observações**
- Vocabulário fechado conforme EventSpec
- Nenhuma atividade implica contratação
- Nenhuma atividade cria obrigação

---

### 4.7 BirthdayMusicAVPage

**Objetivo**  
Registrar intenção relacionada a música e audiovisual.

**Campos EventSpec permitidos**
- `music.present`
- `music.types[]`
- `music.styles[]`
- `music.formation_size`
- `music.equipment_needs[]`
- `music.equipment_source_hypothesis`
- `music.volume`
- `audiovisual.photography`
- `audiovisual.filming`

**Regras**
- Nenhum campo escolhe fornecedor
- Nenhum campo cria booking
- Tudo é intenção declarada

---

### 4.8 BirthdaySupportServicesPage

**Objetivo**  
Registrar intenção de serviços de apoio.

**Campos EventSpec permitidos**
- `support_services[]`

**Observações**
- Lista declarativa
- Pode conter valores múltiplos
- Não implica execução

---

### 4.9 BirthdayTimeWindowPage

**Objetivo**  
Declarar data e janela de tempo desejada.

**Campos EventSpec permitidos**
- `time_window.date`
- `time_window.range`
- `time_window.start_time`
- `time_window.end_time`
- `time_window.flexible`

**Regras duras**
- Sempre janela desejada
- Nunca agenda fixa
- Nunca executável

---

### 4.10 CommonFinalizePage

**Objetivo**  
Executar o fechamento explícito do EventSpec.

**Responsabilidades**
- Solicitar confirmação humana
- Acionar persistência final
- Encerrar edição do snapshot

**Efeito institucional**
- EventSpec torna-se imutável
- Qualquer alteração futura exige novo snapshot

---

## 5. RELAÇÃO COM O WIZARD

- O Wizard:
  - controla navegação
  - controla progresso
  - controla persistência
- As páginas:
  - declaram dados
  - não controlam fluxo

Essa separação é obrigatória.

---

## 6. FUNDAMENTO INSTITUCIONAL

Este Page Set está alinhado com:

- FASE_5_WIZARD_ORQUESTRATOR_CONTRACT.md  
- FASE_5_WIZARD_PAGE_REGISTRY.md  
- 02_birthday_eventspec_v1.md  
- 03_birthday_data_mapping.md  
- CORE_IMUTAVEL.md  

---

## 7. REGRA FINAL

> Se uma página decidir algo,
> o sistema perdeu governança.
>
> Páginas declaram.
> Wizard orquestra.
> Backend valida.
