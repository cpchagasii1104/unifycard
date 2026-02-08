# FASE 5 — GUARDRAILS · FESTA DE ANIVERSÁRIO

**Status:** FASE 5 (Exploração estruturada)  
**Autoridade:** NÃO CANÔNICO · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

Este documento define as **guardrails institucionais obrigatórias**
para qualquer uso, leitura, interpretação ou evolução do fluxo de
**Festa de Aniversário**.

Estas regras existem para:
- evitar inferência automática
- evitar decisões implícitas
- evitar duplicação estrutural
- proteger o core do sistema no futuro

---

## PRINCÍPIO MESTRE

> **O sistema escuta intenções.  
> O sistema não decide, não contrata e não executa.**

Tudo abaixo deriva desse princípio.

---

## 1️⃣ SOBRE TEMA

### REGRA 1.1 — Tema não cria serviço

- Tema **NUNCA** cria:
  - fornecedor
  - necessidade
  - orçamento
  - sugestão automática

Tema serve apenas para:
- classificar contexto
- melhorar comunicação
- compatibilizar escolhas **já declaradas**

❌ Proibido:
> “Tema X → contratar Y”

---

## 2️⃣ SOBRE FAIXA ETÁRIA

### REGRA 2.1 — Faixa etária controla perguntas, não decisões

- Infantil, Jovem, Adulto, Terceira idade:
  - controlam **ramificação do formulário**
  - NÃO ativam serviços automaticamente

❌ Proibido:
> “Infantil → precisa de brinquedo”

---

## 3️⃣ SOBRE LOCAL DO EVENTO

### REGRA 3.1 — Existência ≠ Suficiência

Quando o usuário marca que o local possui:
- mesas
- cadeiras
- som
- iluminação
- cozinha

Isso significa apenas:
> “Existe algo”

Nunca significa:
> “Não precisa contratar”

Adequação é sempre considerada **DESCONHECIDA**.

---

### REGRA 3.2 — Local nunca elimina fornecedor

- Marcar estrutura existente
- Nunca remove necessidade futura
- Nunca impede orçamento
- Nunca impede proposta

---

## 4️⃣ SOBRE MÚSICA E APRESENTAÇÕES

### REGRA 4.1 — Estilo musical não escolhe fornecedor

- Pop, rock, sertanejo, etc.:
  - NÃO escolhem banda
  - NÃO escolhem DJ
  - NÃO escolhem artista

Servem apenas para **compatibilidade futura**.

---

### REGRA 4.2 — Música não é obrigatória

- Evento pode existir sem música
- Música declarada não implica booking
- Música recusada não bloqueia outras contratações

---

## 5️⃣ SOBRE EQUIPAMENTOS

### REGRA 5.1 — Equipamento desejado ≠ equipamento incluso

- Marcar:
  - som
  - luz
  - palco
  - telão

Significa:
> “Pode ser necessário”

Nunca significa:
> “Já está incluso”

---

### REGRA 5.2 — Origem do equipamento é hipótese

- Local
- Artista
- Aluguel
- Combinação

Tudo isso é **hipótese declarada**, não decisão.

---

## 6️⃣ SOBRE QUANTIDADES

### REGRA 6.1 — Quantidade é estimativa

- Número de convidados
- Adultos / crianças / idosos

São sempre:
- estimativas
- sujeitas a mudança
- não vinculantes

❌ Proibido tratar como verdade absoluta.

---

## 7️⃣ SOBRE ORÇAMENTOS E CONTRATAÇÃO

### REGRA 7.1 — Ticket não é transação

- Ticket identifica o planejamento
- Ticket conecta contexto
- Ticket **não** executa nada

---

### REGRA 7.2 — Proposta é a menor unidade contratável

- Cada fornecedor envia propostas próprias
- Propostas podem ser aceitas ou recusadas individualmente
- Evento pode gerar múltiplas propostas e múltiplas transações

---

## 8️⃣ SOBRE CARRINHO

### REGRA 8.1 — Carrinho agrega propostas, não eventos

- Carrinho contém:
  - propostas aceitas
- Carrinho referencia:
  - event_ticket

Carrinho **não** representa:
- evento inteiro
- obrigação total
- contratação global

---

## 9️⃣ REGRA FINAL (INQUEBRÁVEL)

> Se uma regra **não estiver explicitamente escrita**,  
> **ela NÃO EXISTE**.

Inferência implícita é considerada **violação de sistema**.