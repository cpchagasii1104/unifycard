# FASE 5 — FORM FLOW · FESTA DE ANIVERSÁRIO

**Status:** FASE 5 (Exploração estruturada)  
**Autoridade:** NÃO CANÔNICO · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

Este documento define **exclusivamente** o fluxo declarativo do formulário de criação de **Festa de Aniversário**.

Nada aqui:
- cria contrato
- cria obrigação
- cria transação
- cria decisão automática

---

## CONTEXTO IMPLÍCITO (NÃO PERGUNTAR)

- `event_type = BIRTHDAY`
- O usuário já escolheu “Festa de Aniversário” antes de entrar neste fluxo.

❌ Proibido perguntar novamente tipo de evento.

---

## ETAPA 0 — IDENTIFICAÇÃO HUMANA DO EVENTO

### Q0. Nome do evento / projeto (OBRIGATÓRIO)

Campo de texto livre.

Exemplos:
- Festa de Aniversário do João
- Aniversário Maria – 30 anos
- Festa da Vó Ana

**Regras**
- Serve apenas para identificação humana
- Pode ser editado no futuro
- Nunca gera regra, serviço ou decisão

---

## ETAPA 1 — PERFIL DO ANIVERSÁRIO (CHAVE DE RAMIFICAÇÃO)

### Q1. Faixa etária do aniversário (VOCABULÁRIO FECHADO)

- ( ) INFANTIL (0–12)
- ( ) JOVEM / 15 ANOS
- ( ) ADULTO (18–59)
- ( ) TERCEIRA_IDADE (60+)
- ( ) NEUTRO (Prefiro não definir agora)

**Regra dura**
- Controla **quais perguntas aparecem depois**
- **NÃO cria necessidades automaticamente**
- **NÃO decide serviços**

---

### Q2. O aniversariante é você?

- ( ) Sim
- ( ) Não

---

### Q3. Dados do aniversariante (OPCIONAIS)

- Nome (opcional)
- Data de nascimento (opcional)
- Sexo / gênero:
  - ( ) Masculino
  - ( ) Feminino
  - ( ) Prefiro não informar

**Regra**
- Dados exclusivamente contextuais
- Nunca geram regra, inferência ou serviço

---

## ETAPA 2 — QUANTIDADE REAL DE PESSOAS

### Q4. Quantidade total de convidados

- Campo numérico livre
- ( ) Ainda não sei

---

### Q5. Composição dos convidados (SE SOUBER)

- Quantos adultos?
- Quantas crianças?
- Quantos idosos?
- ( ) Não sei informar agora

**Observação**
- Tudo aqui é **estimativa declarada**
- Serve como base para orçamento e logística
- Não é verdade absoluta do sistema

---

## ETAPA 3 — LOCAL DO EVENTO (EIXO ESTRUTURAL)

### Q6. Você já tem o local da festa?

- ( ) Sim
- ( ) Não
- ( ) Ainda não sei

---

### SE Q6 = SIM

#### Q6.1 Endereço do local

- CEP (autocomplete)
- Número
- Complemento

---

#### Q6.2 O local possui (marque o que EXISTE)

- Mesas
- Cadeiras
- Cozinha
- Som básico
- Iluminação básica
- Espaço infantil
- Área externa
- Acessibilidade

**Regra dura**
- “Possui” ≠ “é suficiente”
- Nenhuma marcação elimina contratação futura

---

### SE Q6 = NÃO ou AINDA NÃO SEI

#### Q6.3 Região desejada

- Cidade
- Bairro / região

---

#### Q6.4 Tipo de espaço desejado

- Salão
- Chácara
- Clube
- Espaço infantil
- Casa para eventos
- Indiferente
- Não sei ainda

---

## ETAPA 4 — ESTILO E TEMA

### Q7. Como você imagina essa festa?

- Simples / familiar
- Animada
- Sofisticada
- Temática
- Ainda não sei

---

### Q8. Tema da festa (CONDICIONAL)

Aparece apenas se Q7 = Temática.

- Sugestões conforme faixa etária
- Campo “Outro”
- ( ) Ainda não sei

**Regra dura**
- Tema **NUNCA cria serviço**
- Tema apenas classifica contexto

---

## ETAPA 5 — ATIVIDADES (VOCABULÁRIO FECHADO POR PERFIL)

### INFANTIL
- BRINQUEDOS
- PISCINA_DE_BOLINHAS
- RECREADOR
- PERSONAGENS
- APENAS_BOLO_COMIDA
- NAO_SEI

---

### ADOLESCENTE / 15 ANOS
- DJ
- BANDA
- COREOGRAFIA
- ROUPA_ESPECIAL
- DECORACAO_TEMATICA
- ALGO_SIMPLES
- NAO_SEI

**Se marcar “ROUPA_ESPECIAL”**
- ( ) COMPRA
- ( ) ALUGUEL
- ( ) NAO_SEI

---

### ADULTO
- COMIDA_COMO_FOCO
- BEBIDAS
- MUSICA_AMBIENTE
- MUSICA_AO_VIVO
- CONFRATERNIZACAO_SIMPLES
- NAO_SEI

---

### TERCEIRA IDADE
- MUSICA_AMBIENTE
- EVENTO_TRANQUILO
- ACESSIBILIDADE
- ALIMENTACAO_LEVE
- NAO_SEI

---

## ETAPA 6 — MÚSICA E AUDIOVISUAL

(Fluxo validado separadamente)

- Terá música? (Sim / Não / Não sei)
- Tipo (DJ, banda, playlist, etc.)
- Estilo musical (se aplicável)
- Porte da apresentação
- Necessidade de som / luz / palco
- Origem imaginada do equipamento
- Volume
- Fotografia / filmagem

---

## ETAPA 7 — SERVIÇOS DE APOIO

- Limpeza
- Garçons
- Segurança
- Decoração
- Nenhum
- Não sei

---

## ETAPA 8 — DATA E HORÁRIO

- Data específica ou janela
- Horário início / fim
- Flexível ou não

**Regra**
- Sempre janela desejada
- Nunca agenda fixa

---

## ETAPA 9 — FINALIZAÇÃO

Botão final:
**Salvar planejamento da festa**

---

## ESTADO INTERNO GERADO

- `lifecycle_stage = INTENT_DRAFT`
- `execution_state = NON_EXECUTABLE`

---

## GOVERNANÇA — RESPONSIBLE ACTOR

- Todo EventSpec deve estar associado a:
  - `responsible_actor_id`
  - `responsible_actor_type`

- Esses valores:
  - são obtidos do contexto autenticado
  - NÃO são inferidos por sessão, tenant ou heurística
  - NÃO são definidos pelo formulário

- O formulário de Festa de Aniversário:
  - não pergunta sobre responsible actor
  - apenas consome o contexto autenticado validado

---

## REGRA FINAL

> Este formulário **escuta intenções**.  
> Ele **não decide, não contrata e não executa**.
