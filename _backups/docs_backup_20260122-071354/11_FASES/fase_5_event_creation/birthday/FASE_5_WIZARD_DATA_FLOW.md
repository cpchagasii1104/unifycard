# FASE 5 — WIZARD DATA FLOW

**Arquivo:** FASE_5_WIZARD_DATA_FLOW.md  
**Fase:** FASE 5 — Event Creation  
**Status:** ATIVO  
**Autoridade:** GOVERNANÇA DE DADOS · FRONT-END ↔ BACK-END  
**Caráter:** CONTRATUAL · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

---

## 1. OBJETIVO DESTE DOCUMENTO

Este documento define **como os dados fluem** entre:

- Wizard padrão
- Páginas especializadas (Page Set)
- Backend
- Persistência em banco

durante a **FASE 5 — criação e edição de eventos**.

O foco é:
- eliminar inferência
- impedir mutação indevida
- garantir rastreabilidade
- proteger a imutabilidade do EventSpec

---

## 2. PRINCÍPIO FUNDAMENTAL DE DADOS

> Durante a FASE 5, o sistema trabalha com
> **um EventSpec em construção**, associado a um Event em `INTENT_DRAFT`.

Nenhum dado:
- é inferido
- é normalizado
- é executado
- é promovido a regra

---

## 3. CICLO DE VIDA DO DADO NA FASE 5

### 3.1 Estado inicial (entrada na FASE 5)

Ao entrar na edição do evento:

- Event já existe
- EventSpec já existe (mínimo)
- Campos iniciais típicos:
  - `project_name`
  - `event_ticket`

---

### 3.2 Leitura de dados (READ)

Cada página do Wizard:

- recebe o `eventSpec.answers` atual
- lê **apenas** os campos sob sua responsabilidade
- ignora campos desconhecidos

📌 Nenhuma página lê dados de outra página de forma semântica.

---

### 3.3 Escrita incremental (WRITE)

Quando o usuário interage com uma página:

- a página gera um **partialSpec**
- o Wizard recebe esse fragmento
- o Wizard envia o fragmento ao backend
- o backend **mescla** com `event_specs.answers`

Regras:
- merge superficial (sem lógica)
- campos ausentes não são apagados
- ausência ≠ false

---

### 3.4 Persistência (PERSIST)

O backend:

- persiste os dados exclusivamente em:
  - `event_specs.answers` (JSONB)
- não cria novas tabelas
- não cria colunas adicionais
- não deriva EventDeclaration

---

## 4. RESPONSABILIDADES POR CAMADA

### Front-end (Wizard)

- orquestra páginas
- envia partialSpec
- não valida domínio
- não decide obrigatoriedade
- não infere valores

---

### Front-end (Páginas)

- coletam dados
- produzem partialSpec
- não conhecem backend
- não conhecem outras páginas
- não controlam fechamento

---

### Backend

- valida contexto (actor, event_id, lifecycle)
- persiste dados
- gera `event_ticket` (se ausente)
- bloqueia edições fora de `INTENT_DRAFT`

---

## 5. FECHAMENTO DO EVENTSPEC (FREEZE)

### 5.1 Ação de fechamento

O EventSpec é fechado quando:

- o usuário aciona a ação explícita:
  **“Salvar planejamento”**
- o backend confirma a persistência final

---

### 5.2 Efeito do fechamento

Após o fechamento:

- o EventSpec torna-se **imutável**
- nenhuma edição é permitida
- qualquer alteração futura:
  - exige criação de novo EventSpec
  - mantém histórico completo (append-only)

---

## 6. PROIBIÇÕES CRÍTICAS

Durante toda a FASE 5, é proibido:

- sobrescrever EventSpec fechado
- inferir dados ausentes
- completar campos automaticamente
- normalizar intenção
- promover dados a execução
- derivar EventDeclaration

Violação destas regras é considerada **quebra institucional grave**.

---

## 7. RELAÇÃO COM FASES FUTURAS

- A FASE 5:
  - organiza intenção
  - produz snapshot declarativo

- Fases futuras podem:
  - analisar EventSpec fechado
  - propor EventDeclaration
  - gerar propostas e contratos

📌 Nenhuma dessas ações ocorre na FASE 5.

---

## 8. FUNDAMENTO INSTITUCIONAL

Este fluxo está alinhado com:

- MATRIZ_FONTES_DE_VERDADE.md  
- Database_Canonical_Truth_Contract.md  
- Decision_Safety_and_Containment_Contract.md  
- CORE_IMUTAVEL.md  

---

## 9. REGRA FINAL

> O Wizard transporta dados.  
> As páginas declaram intenção.  
> O backend guarda estado.  
>
> Nenhuma camada pensa pelo usuário.
