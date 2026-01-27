# Fluxo Canônico Completo: Festa de Aniversário

**Macro-intenção:** Celebrar algo  
**Subtipo:** Aniversário  
**Versão:** 1.0  
**Data:** 17/01/2026  
**Status:** CANÔNICO

---

## Princípios Fundamentais

1. **Data e horário primeiro** - Necessário para todas as decisões subsequentes
2. **Atributos do EVENTO apenas** - NÃO perguntar sobre pessoas (idade, sexo, perfil)
3. **Lógica sequencial** - Cada pergunta direciona a próxima
4. **EventSpec declarativo** - Snapshot imutável, sem decisões implícitas
5. **Respeito aos contratos** - CONTRATO DE EVENTOS v1, GOVERNANÇA CANÔNICA

---

## Estrutura do Fluxo

### STEP 1: Contexto Temporal e Local
**Justificativa:** Data/horário e local são fundamentais para todas as decisões subsequentes. Sem isso, não podemos dimensionar serviços, fornecedores ou infraestrutura.

### STEP 2: Dimensão do Evento
**Justificativa:** Número de pessoas determina escala de tudo (local, serviços, orçamento).

### STEP 3: Local e Infraestrutura
**Justificativa:** Saber se já tem local e o que ele oferece evita contratar o que já existe.

### STEP 4: Estilo e Estética do Evento
**Justificativa:** Estilo/estética direcionam decoração, música, ambiente. Atributos do EVENTO, não de pessoas.

### STEP 5: Serviços e Alimentação
**Justificativa:** Com base no estilo e dimensão, perguntar sobre serviços específicos.

### STEP 6: Economia Declarativa
**Justificativa:** Orçamento e prioridade são declarações do usuário, não decisões do sistema.

---

## STEP 1: Contexto Temporal e Local

### Pergunta 1.1: Data do evento
- **Tipo:** `date_or_window`
- **Label:** "Quando será o evento?"
- **Help text:** "Informe a data exata ou uma janela de datas possíveis"
- **Obrigatória:** Sim
- **Validação:**
  - Mínimo: hoje
  - Máximo: +2 anos
- **Justificativa:** Data é necessária para verificar disponibilidade de fornecedores e locais.

**Resposta no EventSpec:**
```json
{
  "event_date": "2026-03-15" | { "start": "2026-03-15", "end": "2026-03-20" }
}
```

### Pergunta 1.2: Horário do evento
- **Tipo:** `time_range`
- **Label:** "Qual o horário do evento?"
- **Help text:** "Horário de início e término estimado"
- **Obrigatória:** Sim
- **Opções:**
  - Manhã (08:00 - 12:00)
  - Tarde (12:00 - 18:00)
  - Noite (18:00 - 23:00)
  - Madrugada (23:00 - 06:00)
  - Personalizado (especificar início e fim)
- **Justificativa:** Horário determina tipo de alimentação, serviços e ambiente.

**Resposta no EventSpec:**
```json
{
  "event_time_range": "afternoon" | { "start": "14:00", "end": "18:00" }
}
```

### Pergunta 1.3: Cidade/Região
- **Tipo:** `text`
- **Label:** "Onde será realizado o evento?"
- **Help text:** "Cidade e região (ex: São Paulo - Zona Sul)"
- **Obrigatória:** Sim
- **Validação:**
  - Mínimo: 2 caracteres
  - Máximo: 100 caracteres
- **Justificativa:** Localização é essencial para buscar fornecedores e locais próximos.

**Resposta no EventSpec:**
```json
{
  "city_region": "São Paulo - Zona Sul"
}
```

---

## STEP 2: Dimensão do Evento

### Pergunta 2.1: Número estimado de pessoas
- **Tipo:** `range`
- **Label:** "Quantas pessoas você espera no evento?"
- **Help text:** "Isso nos ajuda a dimensionar local, serviços e alimentação"
- **Obrigatória:** Sim
- **Opções:**
  - 1-20 pessoas
  - 21-50 pessoas
  - 51-100 pessoas
  - 101-200 pessoas
  - 201-500 pessoas
  - Mais de 500 pessoas
- **Justificativa:** Dimensão determina escala de tudo (local, buffet, som, decoração).

**Resposta no EventSpec:**
```json
{
  "estimated_attendance": "51-100"
}
```

---

## STEP 3: Local e Infraestrutura

### Pergunta 3.1: Já possui local?
- **Tipo:** `yes_no`
- **Label:** "Você já tem um local definido para o evento?"
- **Help text:** "Se você já sabe onde será o evento, podemos perguntar sobre a infraestrutura disponível"
- **Obrigatória:** Sim
- **Justificativa:** Se já tem local, perguntamos sobre infraestrutura. Se não, perguntamos sobre tipo de local desejado.

**Resposta no EventSpec:**
```json
{
  "has_venue": true | false
}
```

### Pergunta 3.2a: Infraestrutura do local (SE has_venue = true)
- **Tipo:** `multiple_choice` (checkboxes)
- **Label:** "O que o local já possui disponível?"
- **Help text:** "Selecione todos os itens que o local já tem. Isso evita contratar o que já existe."
- **Obrigatória:** Não
- **Opções:**
  - PA (Sistema de som)
  - Monitor de retorno
  - Backline (instrumentos)
  - Iluminação
  - Palco
  - Som básico
  - Energia elétrica adequada
  - Internet/WiFi
  - Estacionamento
  - Camarim
  - Área de carga/descarga
  - Elevador
- **Justificativa:** Evita contratar serviços que o local já oferece.

**Resposta no EventSpec:**
```json
{
  "venue_infrastructure": ["PA", "iluminação", "estacionamento"]
}
```

### Pergunta 3.2b: Tipo de local desejado (SE has_venue = false)
- **Tipo:** `multiple_choice` (checkboxes)
- **Label:** "Que tipo de local você procura?"
- **Help text:** "Selecione os tipos de local que interessam"
- **Obrigatória:** Não
- **Opções:**
  - Salão de festas
  - Chácara
  - Clube
  - Restaurante
  - Espaço ao ar livre
  - Galpão/Espaço industrial
  - Hotel
  - Outro
- **Justificativa:** Direciona busca de locais adequados ao estilo do evento.

**Resposta no EventSpec:**
```json
{
  "desired_venue_types": ["salão de festas", "chácara"]
}
```

### Pergunta 3.3: Raio de distância (SE has_venue = false)
- **Tipo:** `single_choice`
- **Label:** "Até que distância você está disposto a ir?"
- **Help text:** "Raio máximo de distância do local de referência"
- **Obrigatória:** Não
- **Opções:**
  - Até 5 km
  - Até 10 km
  - Até 20 km
  - Até 50 km
  - Qualquer distância
- **Justificativa:** Limita busca de locais a uma área geográfica.

**Resposta no EventSpec:**
```json
{
  "distance_radius": "10km"
}
```

---

## STEP 4: Estilo e Estética do Evento

⚠️ **ATENÇÃO:** Este step pergunta sobre ATRIBUTOS DO EVENTO (estilo, ambiente, estética, tema), NÃO sobre pessoas.

### Pergunta 4.1: Estilo do evento
- **Tipo:** `single_choice`
- **Label:** "Qual o estilo do evento?"
- **Help text:** "O estilo define o ambiente e a estética geral"
- **Obrigatória:** Sim
- **Opções:**
  - Casual/Descontraído
  - Elegante/Formal
  - Temático/Fantasia
  - Rústico/Natural
  - Moderno/Minimalista
  - Festivo/Colorido
- **Justificativa:** Estilo direciona decoração, música, alimentação e serviços.

**Resposta no EventSpec:**
```json
{
  "event_style": "casual"
}
```

### Pergunta 4.2: Ambiente desejado
- **Tipo:** `multiple_choice` (checkboxes)
- **Label:** "Que tipo de ambiente você quer criar?"
- **Help text:** "Selecione os aspectos do ambiente que são importantes"
- **Obrigatória:** Não
- **Opções:**
  - Intimista/Acolhedor
  - Animado/Festivo
  - Sofisticado/Refinado
  - Descontraído/Relaxado
  - Interativo/Participativo
  - Tranquilo/Sereno
- **Justificativa:** Ambiente direciona música, iluminação e decoração.

**Resposta no EventSpec:**
```json
{
  "desired_atmosphere": ["animado", "interativo"]
}
```

### Pergunta 4.3: Tema ou estética específica
- **Tipo:** `text` (com sugestões)
- **Label:** "Há algum tema ou estética específica?"
- **Help text:** "Ex: cores específicas, tema de filme, época, etc. (opcional)"
- **Obrigatória:** Não
- **Sugestões (opcionais):**
  - Cores específicas (ex: rosa e dourado)
  - Tema de filme/série
  - Época/Estilo (anos 80, vintage, etc.)
  - Natureza/Flores
  - Industrial/Urbano
  - Nenhum tema específico
- **Justificativa:** Tema direciona decoração e visual do evento.

**Resposta no EventSpec:**
```json
{
  "event_theme": "rosa e dourado" | null
}
```

### Pergunta 4.4: Tipo de aniversário (DESCRITIVO)
- **Tipo:** `single_choice`
- **Label:** "Tipo de aniversário"
- **Help text:** "Apenas para descrição do evento (não usado para decisões)"
- **Obrigatória:** Sim
- **Opções:**
  - Infantil
  - 15 anos
  - Adulto
- **Justificativa:** Categoria DESCRITIVA apenas. Usado para organizar perguntas, não para decisão de negócio.

**Resposta no EventSpec:**
```json
{
  "birthday_category": "adulto"
}
```

**⚠️ REGRA INSTITUCIONAL:** Esta categoria é apenas DESCRITIVA. NÃO pode ser usada para:
- Decidir preços
- Decidir visibilidade
- Decidir ranking
- Decidir busca de fornecedores
- Qualquer lógica de negócio

---

## STEP 5: Serviços e Alimentação

### Pergunta 5.1: Serviços operacionais necessários
- **Tipo:** `multiple_choice` (checkboxes)
- **Label:** "Quais serviços operacionais você precisa?"
- **Help text:** "Selecione todos os serviços que você precisa contratar"
- **Obrigatória:** Não
- **Opções:**
  - Limpeza
  - Segurança
  - Recepcionista
  - Garçom/Garçonete
  - Equipe de cozinha
  - Equipe de bar
  - Fotografia
  - Filmagem
- **Justificativa:** Com base no estilo e dimensão, identificar serviços necessários.

**Resposta no EventSpec:**
```json
{
  "operational_services": ["limpeza", "segurança", "fotografia"]
}
```

### Pergunta 5.2: Música e entretenimento
- **Tipo:** `multiple_choice` (checkboxes)
- **Label:** "O que você deseja para música e entretenimento?"
- **Help text:** "Selecione as opções que interessam"
- **Obrigatória:** Não
- **Opções:**
  - DJ
  - Banda ao vivo
  - Música ambiente (playlist)
  - Karaokê
  - Animação/Recreação
  - Show/Performance
  - Nenhum
- **Justificativa:** Música e entretenimento dependem do estilo e ambiente desejados.

**Resposta no EventSpec:**
```json
{
  "music_entertainment": ["DJ", "música ambiente"]
}
```

### Pergunta 5.3: Comidas e bebidas
- **Tipo:** `multiple_choice` (checkboxes)
- **Label:** "O que você deseja servir de comidas e bebidas?"
- **Help text:** "Selecione todos os itens que você precisa"
- **Obrigatória:** Não
- **Opções:**
  - Bolo
  - Salgados
  - Doces
  - Bebidas alcoólicas
  - Bebidas não alcoólicas
  - Buffet completo
  - Coffee break
  - Brunch
  - Petiscos
  - Finger food
- **Justificativa:** Alimentação depende do horário, estilo e dimensão do evento.

**Resposta no EventSpec:**
```json
{
  "food_and_beverages": ["bolo", "salgados", "bebidas alcoólicas", "bebidas não alcoólicas"]
}
```

### Pergunta 5.4: Decoração
- **Tipo:** `multiple_choice` (checkboxes)
- **Label:** "O que você precisa para decoração?"
- **Help text:** "Selecione os itens de decoração necessários"
- **Obrigatória:** Não
- **Opções:**
  - Decoração temática
  - Arranjos de flores
  - Balões
  - Iluminação decorativa
  - Mesa de doces
  - Cenário/Fundo
  - Nenhuma decoração específica
- **Justificativa:** Decoração depende do estilo, tema e ambiente desejados.

**Resposta no EventSpec:**
```json
{
  "decoration_items": ["decoração temática", "iluminação decorativa"]
}
```

---

## STEP 6: Economia Declarativa

⚠️ **ATENÇÃO:** Este step é DECLARATIVO. NÃO usado para ranking, score ou decisões automáticas.

### Pergunta 6.1: Faixa de orçamento
- **Tipo:** `range`
- **Label:** "Qual sua faixa de orçamento estimada?"
- **Help text:** "Isso nos ajuda a sugerir opções adequadas (declarativo apenas)"
- **Obrigatória:** Não
- **Opções:**
  - Até R$ 1.000
  - R$ 1.000 a R$ 3.000
  - R$ 3.000 a R$ 5.000
  - R$ 5.000 a R$ 10.000
  - R$ 10.000 a R$ 20.000
  - Acima de R$ 20.000
- **Justificativa:** Orçamento é declaração do usuário, não decisão do sistema.

**Resposta no EventSpec:**
```json
{
  "budget_range": "3000-5000"
}
```

**⚠️ REGRA INSTITUCIONAL:** Este valor é DECLARATIVO. NÃO pode ser usado para:
- Ranking de fornecedores
- Score de relevância
- Decisão automática de mostrar/ocultar opções
- Qualquer lógica de negócio

### Pergunta 6.2: Prioridade declarada
- **Tipo:** `single_choice`
- **Label:** "Qual sua prioridade para este evento?"
- **Help text:** "Declaração de preferência (não usado para decisões automáticas)"
- **Obrigatória:** Não
- **Opções:**
  - Economizar
  - Equilibrar custo/qualidade
  - Caprichar/Investir mais
- **Justificativa:** Prioridade é declaração do usuário, não decisão do sistema.

**Resposta no EventSpec:**
```json
{
  "priority_declared": "equilibrar"
}
```

**⚠️ REGRA INSTITUCIONAL:** Esta prioridade é DECLARATIVA. NÃO pode ser usada para:
- Ranking automático
- Score implícito
- Decisão de mostrar/ocultar opções
- Qualquer lógica de negócio

---

## Dependências Condicionais

### Árvore de Dependências

```
STEP 1 (Sempre)
  └─> STEP 2 (Sempre)
      └─> STEP 3 (Sempre)
          ├─> 3.2a: Infraestrutura (SE has_venue = true)
          └─> 3.2b + 3.3: Tipo de local + Raio (SE has_venue = false)
          └─> STEP 4 (Sempre)
              └─> STEP 5 (Sempre)
                  └─> STEP 6 (Sempre)
```

### Regras de Dependência

1. **STEP 1 → STEP 2:** Sempre após STEP 1
2. **STEP 2 → STEP 3:** Sempre após STEP 2
3. **STEP 3 → STEP 4:** Sempre após STEP 3
4. **STEP 4 → STEP 5:** Sempre após STEP 4
5. **STEP 5 → STEP 6:** Sempre após STEP 5

**Condicionais dentro de steps:**
- **3.2a** aparece apenas se `has_venue = true`
- **3.2b + 3.3** aparecem apenas se `has_venue = false`

---

## Exemplo de EventSpec Final Gerado

```json
{
  "spec_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_id": null,
  "tenant_id": "tenant-123",
  "actor_id": "actor-456",
  "actor_type": "user",
  "spec_version": 1,
  "macro_intention": "celebrate",
  "subflow": "birthday_party",
  "answers": {
    "event_date": "2026-03-15",
    "event_time_range": "afternoon",
    "city_region": "São Paulo - Zona Sul",
    "estimated_attendance": "51-100",
    "has_venue": true,
    "venue_infrastructure": ["PA", "iluminação", "estacionamento"],
    "event_style": "casual",
    "desired_atmosphere": ["animado", "interativo"],
    "event_theme": "rosa e dourado",
    "birthday_category": "adulto",
    "operational_services": ["limpeza", "segurança", "fotografia"],
    "music_entertainment": ["DJ", "música ambiente"],
    "food_and_beverages": ["bolo", "salgados", "bebidas alcoólicas", "bebidas não alcoólicas"],
    "decoration_items": ["decoração temática", "iluminação decorativa"],
    "budget_range": "3000-5000",
    "priority_declared": "equilibrar"
  },
  "metadata": {
    "questionnaire_version": 1,
    "completed_steps": ["step_1", "step_2", "step_3", "step_4", "step_5", "step_6"],
    "created_by_user_id": "user-789"
  },
  "created_at": "2026-01-17T10:30:00Z",
  "created_by": "user-789"
}
```

---

## Observações de UX

### O que perguntar CEDO (Steps 1-3)

**Justificativa:** Essas informações são fundamentais para todas as decisões subsequentes.

1. **Data e horário (STEP 1)**
   - Necessário para verificar disponibilidade
   - Determina tipo de alimentação (manhã = café, tarde = almoço, noite = jantar)
   - Determina ambiente (manhã = mais claro, noite = mais escuro)

2. **Localização (STEP 1)**
   - Essencial para buscar fornecedores próximos
   - Determina logística e custos de deslocamento

3. **Dimensão (STEP 2)**
   - Determina escala de tudo (local, serviços, alimentação)
   - Não pode ser perguntado depois, pois afeta todas as escolhas

4. **Local e infraestrutura (STEP 3)**
   - Se já tem local, saber o que ele oferece evita contratar duplicado
   - Se não tem, precisa saber o tipo de local desejado antes de buscar serviços

### O que perguntar TARDE (Steps 4-6)

**Justificativa:** Essas informações dependem das anteriores e são mais específicas.

1. **Estilo e estética (STEP 4)**
   - Depende de ter dimensão e local definidos
   - Direciona decoração, música e serviços específicos

2. **Serviços e alimentação (STEP 5)**
   - Depende de estilo, dimensão e infraestrutura
   - Mais específico, então vem depois das decisões gerais

3. **Economia (STEP 6)**
   - Último step porque é declarativo
   - Não afeta as perguntas anteriores
   - Apenas declaração do usuário

### Princípios de Ordem

1. **Geral → Específico**
   - Primeiro: dimensão, local, estilo
   - Depois: serviços específicos, decoração específica

2. **Fundamental → Opcional**
   - Primeiro: data, local, dimensão (obrigatórios)
   - Depois: estilo, serviços, economia (opcionais)

3. **Independente → Dependente**
   - Primeiro: informações que não dependem de outras
   - Depois: informações que dependem das anteriores

4. **Decisivo → Declarativo**
   - Primeiro: informações que direcionam o fluxo
   - Depois: declarações que não afetam o fluxo

---

## Regras Institucionais Respeitadas

✅ **Data e horário no início** - STEP 1  
✅ **NÃO perguntar idade, sexo ou perfil de pessoas** - Apenas atributos do evento  
✅ **Atributos do EVENTO apenas** - Estilo, ambiente, estética, tema  
✅ **Lógica sequencial** - Cada pergunta direciona a próxima  
✅ **EventSpec declarativo** - Snapshot imutável, sem decisões implícitas  
✅ **Categorias descritivas** - `birthday_category` é apenas descritiva  
✅ **Economia declarativa** - Orçamento e prioridade não são usados para decisões  

---

## Referências

- **Contrato de Eventos:** `docs/contracts/CONTRATO_EVENTOS_V1.md`
- **Governança Canônica:** `treinamento/GOVERNANCA_CANONICA.md`
- **EventSpec Types:** `backend/src/core/events/specs/event-spec.types.ts`
- **EventSpec Service:** `backend/src/core/events/specs/event-spec.service.ts`

---

**Última atualização:** 17/01/2026



