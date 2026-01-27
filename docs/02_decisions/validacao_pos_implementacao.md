# ✅ VALIDAÇÃO PÓS-IMPLEMENTAÇÃO — MÓDULO EVENTOS

> **Status**: PRONTO PARA VALIDAÇÃO  
> **Data**: 28/12/2024  
> **Versão**: 1.0

---

## 📋 PRÉ-REQUISITOS

### 1. Migration 070 Aplicada

```sql
-- Verificar se colunas existem:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'posts' 
  AND column_name IN ('event_id', 'type', 'visibility');

-- Deve retornar 3 linhas:
-- event_id
-- type
-- visibility
```

**Se não retornar 3 linhas:**
```bash
psql $DATABASE_URL < backend/migrations/070_posts_event_link.sql
```

---

## 🧪 CHECKLIST DE VALIDAÇÃO

### ✅ FASE 1: Estrutura de Arquivos

- [ ] `frontend/src/components/events/wizard/intentionMapping.ts` existe
- [ ] `frontend/src/components/events/wizard/Step2EventType.tsx` usa `intentionMapping`
- [ ] `frontend/src/pages/EventosPage.tsx` não tem modal de criação
- [ ] Rota `/events/new` está registrada em `App.tsx`

**Verificação:**
```bash
# Verificar arquivos existem
ls frontend/src/components/events/wizard/intentionMapping.ts
ls frontend/src/components/events/wizard/Step2EventType.tsx
ls frontend/src/pages/EventosPage.tsx

# Verificar rota
grep -n "events/new" frontend/src/App.tsx
```

---

### ✅ FASE 2: Funcionalidade Básica

#### Teste 2.1: Página /eventos Carrega

1. Acessar `http://localhost:5173/eventos`
2. Verificar que **NÃO** aparece erro "coluna p.event_id não existe"
3. Verificar que lista de eventos carrega (mesmo se vazia)

**Resultado esperado:**
- ✅ Página carrega sem erros
- ✅ Lista de eventos exibida (pode estar vazia)
- ✅ Botão "+ Criar evento" visível

---

#### Teste 2.2: Botão Criar Redireciona

1. Na página `/eventos`, clicar em "+ Criar evento"
2. Verificar que redireciona para `/events/new` (wizard)
3. Verificar que **NÃO** abre modal inline

**Resultado esperado:**
- ✅ Redirecionamento para `/events/new`
- ✅ Wizard abre (Step 1)
- ✅ Modal antigo não aparece

---

#### Teste 2.3: Step 2 Mostra Intenções

1. No wizard, avançar para Step 2
2. Verificar título: **"O que você quer que aconteça?"**
3. Verificar que aparecem cards de intenções:
   - 🎭 Apresentar algo
   - 🤝 Reunir pessoas
   - 🎓 Ensinar algo
   - 🎉 Celebrar algo
   - 🏆 Competir / Desafiar
   - 🙏 Inspirar / Conectar
   - 🍽️ Experiência gastronômica
   - 📣 Promover / Divulgar

**Resultado esperado:**
- ✅ Título correto: "O que você quer que aconteça?"
- ✅ 8 cards aparecem (se actor_type = 'user')
- ✅ Cards têm ícone, label e descrição

---

#### Teste 2.4: Seleção de Intenção Funciona

1. Selecionar "🎭 Apresentar algo"
2. Clicar em "Próximo"
3. Verificar que avança para Step 3
4. (Debug) No console do navegador, verificar que `event_type = 'cultural'`

**Resultado esperado:**
- ✅ Seleção marca card como selecionado
- ✅ Avança para Step 3
- ✅ `event_type` correto é enviado ao backend

**Verificação no console:**
```javascript
// No Step 3, verificar dados do wizard
// event_type deve ser 'cultural' quando selecionado "Apresentar algo"
```

---

#### Teste 2.5: Permissões de Actor

1. Alternar para Page/Empresa (se disponível)
2. Voltar ao wizard Step 2
3. Verificar que "Reunir pessoas" e "Celebrar algo" **NÃO** aparecem

**Resultado esperado:**
- ✅ User vê 8 intenções
- ✅ Page vê 6 intenções (sem 'gather' e 'celebrate')
- ✅ Matriz de permissão funcionando

---

### ✅ FASE 3: Integração com Feed

#### Teste 3.1: Feed e /eventos Usam Mesmo Motor

1. Criar um evento via wizard
2. Publicar o evento
3. Verificar que aparece em `/eventos`
4. Verificar que aparece no feed social (`/social`)

**Resultado esperado:**
- ✅ Evento aparece em ambos os lugares
- ✅ Mesma fonte de dados (feed)
- ✅ Dados consistentes

---

#### Teste 3.2: Evento Criado Aparece no Feed

1. Criar evento como DRAFT
2. Publicar evento
3. Acessar `/social`
4. Verificar que evento aparece no feed

**Resultado esperado:**
- ✅ Evento publicado aparece no feed
- ✅ Card de evento renderiza corretamente
- ✅ Dados do evento estão corretos

---

### ✅ FASE 4: Validação de Governança

#### Teste 4.1: Nenhum Novo event_type Criado

```sql
-- Verificar tipos permitidos no banco
SELECT DISTINCT event_type FROM events;

-- Deve retornar apenas:
-- cultural, gastronomic, social, professional, 
-- community, spiritual, sports, private
```

**Resultado esperado:**
- ✅ Apenas 8 tipos oficiais existem
- ✅ Nenhum tipo novo foi criado

---

#### Teste 4.2: Wizard é Único Fluxo de Criação

```bash
# Verificar que createEvent só é chamado no wizard
grep -r "createEvent" frontend/src --exclude-dir=node_modules

# Deve aparecer apenas em:
# - frontend/src/components/events/EventCreationWizard.tsx
# - frontend/src/api/events.ts (definição da função)
```

**Resultado esperado:**
- ✅ `createEvent()` só chamado em `EventCreationWizard.tsx`
- ✅ Nenhum modal ou formulário independente chama `createEvent()`

---

#### Teste 4.3: Intenção NÃO é Persistida

```sql
-- Verificar que não existe coluna 'intention' em events
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'intention';

-- Deve retornar 0 linhas
```

**Resultado esperado:**
- ✅ Coluna `intention` não existe
- ✅ Apenas `event_type` é persistido

---

## 🔴 PROBLEMAS CONHECIDOS E SOLUÇÕES

### Erro: "coluna p.event_id não existe"

**Causa:** Migration 070 não foi aplicada.

**Solução:**
```bash
psql $DATABASE_URL < backend/migrations/070_posts_event_link.sql
```

---

### Erro: "intentionMapping not found"

**Causa:** Arquivo não foi criado.

**Solução:**
```bash
# Verificar se arquivo existe
ls frontend/src/components/events/wizard/intentionMapping.ts

# Se não existir, criar conforme PROPOSTA_STEP2_INTENCAO_FINAL.md
```

---

### Erro: Step 2 mostra tipos antigos (Cultural, Gastronômico...)

**Causa:** `Step2EventType.tsx` não foi substituído.

**Solução:**
1. Verificar que arquivo usa `intentionMapping.ts`
2. Verificar que título é "O que você quer que aconteça?"
3. Se necessário, substituir arquivo conforme `PROPOSTA_STEP2_INTENCAO_FINAL.md`

---

### Erro: Modal ainda aparece em /eventos

**Causa:** `EventosPage.tsx` não foi substituído.

**Solução:**
1. Verificar que botão "Criar evento" chama `navigate('/events/new')`
2. Verificar que não existe JSX de modal no arquivo
3. Se necessário, substituir arquivo conforme instruções

---

## 📊 RESUMO DE VALIDAÇÃO

| Fase | Teste | Status | Observações |
|------|-------|--------|-------------|
| 1 | Estrutura de Arquivos | ⬜ | |
| 2.1 | Página /eventos carrega | ⬜ | |
| 2.2 | Botão criar redireciona | ⬜ | |
| 2.3 | Step 2 mostra intenções | ⬜ | |
| 2.4 | Seleção funciona | ⬜ | |
| 2.5 | Permissões de actor | ⬜ | |
| 3.1 | Feed e /eventos unificados | ⬜ | |
| 3.2 | Evento aparece no feed | ⬜ | |
| 4.1 | Nenhum novo event_type | ⬜ | |
| 4.2 | Wizard único fluxo | ⬜ | |
| 4.3 | Intenção não persistida | ⬜ | |

---

## ✅ CRITÉRIO DE APROVAÇÃO

A implementação está **APROVADA** quando:

- [x] Migration 070 aplicada
- [ ] Todos os testes da Fase 2 passam
- [ ] Todos os testes da Fase 3 passam
- [ ] Todos os testes da Fase 4 passam
- [ ] Nenhum erro de console
- [ ] Nenhum erro de lint

---

## 📝 OBSERVAÇÕES FINAIS

- **Intenção é apenas UX:** Não é persistida, apenas mapeia para `event_type`
- **Wizard é obrigatório:** Não existe criação fora do wizard
- **Feed é o motor:** `/eventos` e feed social usam mesma fonte
- **Governança preservada:** Nenhum contrato foi quebrado

---

*Documento criado em 28/12/2024*  
*Para uso em validação pós-implementação*






