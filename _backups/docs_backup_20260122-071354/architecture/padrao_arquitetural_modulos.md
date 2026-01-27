# 📐 PADRÃO ARQUITETURAL — MÓDULOS UNIFICARD

> **Este documento define o padrão arquitetural para todos os módulos do UnifiCard.**  
> **O módulo Eventos foi o primeiro a seguir este padrão e serve como referência.**

---

## 🎯 PRINCÍPIO FUNDAMENTAL

**Módulos NÃO são isolados. Módulos são extensões do CORE.**

```
┌─────────────────────────────────────┐
│         CORE (Núcleo)              │
│  - Identity, Economy, Feed, Actors │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Eventos│ │ Social │ │  Work  │
└────────┘ └────────┘ └────────┘
```

---

## 📋 CHECKLIST OBRIGATÓRIO PARA NOVOS MÓDULOS

### 1️⃣ INTEGRAÇÃO COM CORE

- [ ] **Identity**: Usa `actor_id` e `actor_type` (não cria sistema próprio)
- [ ] **Economy**: Passa pelo Split Engine (70/15/10/5)
- [ ] **Feed**: Aparece no feed social (não cria feed paralelo)
- [ ] **Actors**: Respeita multi-actor (user, page, group)

### 2️⃣ FLUXO ÚNICO DE CRIAÇÃO

- [ ] Existe **UM ÚNICO** fluxo de criação (wizard ou formulário guiado)
- [ ] Não existe criação via modal independente
- [ ] Não existe criação via API direta sem validação

### 3️⃣ UX BASEADA EM INTENÇÃO (QUANDO APLICÁVEL)

- [ ] Se o módulo tem categorias, usa **intenção** na UX
- [ ] Intenção **NÃO é persistida** no banco
- [ ] Backend recebe apenas valores canônicos (ex: `event_type`)
- [ ] Mapeamento intenção → valor canônico é feito no frontend

### 4️⃣ FEED COMO MOTOR ÚNICO

- [ ] Conteúdo do módulo aparece no feed social
- [ ] Página dedicada (ex: `/eventos`) usa **mesma fonte** do feed
- [ ] Não existe fetch paralelo de dados
- [ ] Feed e página são **visões diferentes do mesmo motor**

### 5️⃣ PROGRAMAÇÃO DEFENSIVA

- [ ] Queries não assumem existência de colunas novas
- [ ] Verifica schema antes de usar colunas (ex: `hasEventIdColumn()`)
- [ ] Degradação graciosa se migration não aplicada
- [ ] Sistema funciona mesmo sem features opcionais

### 6️⃣ GOVERNANÇA

- [ ] Respeita `REGULAMENTO_EXECUCAO.md`
- [ ] Respeita `GOLDEN_PATH.md`
- [ ] Respeita `ANTI_PATTERNS.md`
- [ ] Não cria entidades novas sem necessidade
- [ ] Não viola contratos existentes

### 7️⃣ DOCUMENTAÇÃO

- [ ] `ESTADO_ATUAL_MODULO_[NOME].md` na raiz
- [ ] `VALIDACAO_POS_IMPLEMENTACAO.md` (checklist)
- [ ] Documentação de decisões arquiteturais
- [ ] Mapeamento de intenções (se aplicável)

---

## 🎨 PADRÃO DE UX (MÓDULO EVENTOS COMO REFERÊNCIA)

### Step 2: Intenção

**Pergunta:** "O que você quer que aconteça?"

**Cards de intenção:**
- Ícone + Label + Descrição
- Mapeamento para valor canônico
- Filtro por `actor_type` (permissões)

**Regras:**
- Intenção é apenas UX
- Backend recebe valor canônico
- Nenhum campo `intention` no banco

---

## 🗄️ PADRÃO DE BANCO DE DADOS

### Migrations

- [ ] Migrations incrementais (não destrutivas)
- [ ] `IF NOT EXISTS` para colunas novas
- [ ] Validação de schema antes de usar
- [ ] Programação defensiva no código

### Schema

- [ ] Usa campos canônicos do CORE
- [ ] Não duplica dados do CORE
- [ ] Foreign keys para entidades do CORE
- [ ] RLS (Row Level Security) quando aplicável

---

## 🧪 VALIDAÇÃO OBRIGATÓRIA

Antes de considerar módulo "FECHADO":

1. [ ] Migration aplicada e validada
2. [ ] Checklist de validação executado
3. [ ] Feed funciona sem erros
4. [ ] Página dedicada funciona
5. [ ] Criação via wizard funciona
6. [ ] Nenhum erro de console
7. [ ] Nenhum erro de banco

---

## ❌ ANTI-PATTERNS (NUNCA FAZER)

- ❌ Criar motor paralelo de feed
- ❌ Criar sistema próprio de autenticação
- ❌ Criar sistema próprio de economia
- ❌ Duplicar lógica de criação
- ❌ Persistir campos de UX (intenção, etc)
- ❌ Assumir existência de colunas novas
- ❌ Quebrar contratos existentes
- ❌ Criar abstrações desnecessárias

---

## 📚 REFERÊNCIAS

### Módulo Eventos (Referência Completa)

- `ESTADO_ATUAL_MODULO_EVENTOS.md`
- `VALIDACAO_POS_IMPLEMENTACAO.md`
- `PROPOSTA_STEP2_INTENCAO_FINAL.md`

### Documentos de Governança

- `REGULAMENTO_EXECUCAO.md`
- `GOLDEN_PATH.md`
- `ANTI_PATTERNS.md`

---

## 🔜 PRÓXIMOS MÓDULOS

Ao criar novos módulos, seguir este padrão:

1. **Planejamento**: Definir integração com CORE
2. **Implementação**: Seguir checklist acima
3. **Validação**: Executar checklist de validação
4. **Documentação**: Criar `ESTADO_ATUAL_MODULO_[NOME].md`
5. **Fechamento**: Marcar módulo como FECHADO

---

*Padrão estabelecido em 2025-01-07*  
*Baseado no módulo Eventos como referência*






