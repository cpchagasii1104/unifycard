# PROPOSTA: FEED COMO FACILITADOR
## Unificação de Fluxos de Criação — UnifiCard

**Data:** 29/12/2025  
**Status:** 📋 Proposta para validação  
**Participantes:** Claude + ChatGPT + Clayton

---

## 🎯 PROBLEMA IDENTIFICADO

Hoje existem **dois fluxos diferentes** para criar eventos:

### Fluxo 1: Página /eventos → Wizard (CORRETO ✅)
```
Botão "Criar evento"
    └─► /events/new
        └─► EventCreationWizard
            ├─► Step 1: Actor
            ├─► Step 2: Tipo (intenção)
            ├─► Step 3: Contexto
            ├─► Step 4: Economia
            └─► Step 5: Revisão
```

### Fluxo 2: Feed Social → IntentComposer (INCORRETO ❌)
```
Textarea "Diga o que você quer que aconteça..."
    └─► IA classifica texto
        └─► Cria direto pelo backend
            └─► NÃO passa pelo Wizard
            └─► NÃO valida regras de Actor
            └─► NÃO segue o mesmo motor
```

---

## 📐 REGRA DE OURO PROPOSTA

> **O Feed NUNCA cria entidades. Ele apenas FACILITA o início de fluxos do core.**

Isso significa:
- Feed não cria eventos
- Feed não cria serviços
- Feed não cria produtos
- Feed **redireciona** para os wizards corretos

---

## 🔧 SOLUÇÃO PROPOSTA

### Opção A: Redirecionamento Simples (Recomendada)

```
Feed
 └─► "Criar evento" (botão)
     └─► redirect → /events/new
 └─► "Criar serviço" (botão)
     └─► redirect → /services/new (futuro)
```

**Vantagens:**
- Zero complexidade
- Usa o que já existe
- Governança garantida

---

### Opção B: Redirecionamento com Pré-preenchimento

```
Feed
 └─► Textarea (opcional)
 └─► "Criar evento"
     └─► redirect → /events/new?draft=texto_digitado
```

**Vantagens:**
- UX mais fluida
- Texto vira pré-preenchimento do título/descrição
- Wizard continua soberano

---

### Opção C: Modal do Wizard no Feed (Mais Complexa)

```
Feed
 └─► "Criar evento"
     └─► Modal com EventCreationWizard embedded
```

**Desvantagens:**
- Mais complexo
- Duplicação de código
- Manutenção difícil

---

## 👤 REGRAS DE ACTOR (PROPOSTA)

O tipo de Actor deve limitar o que pode ser criado:

### Pessoa Física (user)
| Ação | Permitido | Limite |
|------|-----------|--------|
| Criar evento pessoal | ✅ | max 50 pessoas |
| Criar evento comercial | ❌ | Precisa ser PJ |
| Criar serviço | ✅ | Autônomo |
| Vender ingresso | ❌ | Precisa ser PJ |

### Pessoa Jurídica (page)
| Ação | Permitido | Limite |
|------|-----------|--------|
| Criar evento comercial | ✅ | Conforme alvará |
| Vender ingresso | ✅ | Com escrow |
| Criar serviço | ✅ | Profissional |
| Evento grande (+1000) | ✅ | Com verificação |

### Grupo (group)
| Ação | Permitido | Limite |
|------|-----------|--------|
| Criar evento de grupo | ✅ | Membros apenas |
| Receber split | ✅ | Conforme regra |
| Criar serviço | ❌ | Precisa ser PF/PJ |

---

## 📝 IMPLEMENTAÇÃO NO WIZARD

### Step 2 (Tipo) deve ser dinâmico baseado no Actor

**Se Actor = Pessoa Física:**
```
Opções visíveis:
- Reunir pessoas (max 50)
- Ensinar algo (workshop pequeno)
- Celebrar algo (festa privada)
```

**Se Actor = Pessoa Jurídica:**
```
Opções visíveis (todas):
- Apresentar algo (shows, exposições)
- Reunir pessoas (networking, eventos)
- Ensinar algo (workshops, cursos)
- Celebrar algo (aniversários, formaturas)
- Competir/Desafiar (campeonatos)
- Inspirar/Conectar (retiros, cultos)
- Experiência (gastronomia)
- Promover/Divulgar (comercial)
```

---

## 🏗️ MUDANÇAS NECESSÁRIAS

### Frontend

| Arquivo | Mudança |
|---------|---------|
| SmartEmptyState.tsx | Botões redirecionam para /events/new |
| IntentComposer.tsx | Remover criação direta, apenas redirect |
| EventCreationWizard.tsx | Step 2 dinâmico por Actor |

### Backend

| Arquivo | Mudança |
|---------|---------|
| event.service.ts | Validar limites por actor_type |
| event.routes.ts | Endpoint de validação de permissão |

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Resolver Blockers (AGORA)
- [ ] Remover p.visibility com programação defensiva
- [ ] Testar /eventos funcionando

### Fase 2: Unificar Fluxo (PRÓXIMO)
- [ ] SmartEmptyState → redirect para /events/new
- [ ] IntentComposer → modo simplificado ou removido
- [ ] Testar fluxo unificado

### Fase 3: Regras de Actor (DEPOIS)
- [ ] Step 2 dinâmico por actor_type
- [ ] Validação de limites no backend
- [ ] Mensagens de erro amigáveis

---

## ❓ PERGUNTAS PARA VALIDAÇÃO

1. **Opção A, B ou C?** Qual abordagem de redirecionamento?
2. **IntentComposer**: Manter simplificado ou remover?
3. **Limites de Actor**: Os limites propostos fazem sentido?
4. **Pessoa Física pode vender ingresso?** (Com PIX direto, sem escrow)

---

*Documento gerado em 29/12/2025*
*Fase: Proposta de Unificação*
*Aguardando validação de Clayton + ChatGPT*
