# 🏗️ ANÁLISE ARQUITETURAL E ESTRATÉGIA DE VALIDAÇÃO — UNIFICARD

**Data:** 01/01/2026  
**Escopo:** Arquitetura, Modelo de Actors, Validação Anti-Fraude

---

## 1️⃣ LEITURA ARQUITETURAL

### O que DEVE ficar em `core/`

| Módulo | Justificativa |
|--------|---------------|
| **identity** | Autenticação, global_user_id, sessão — TODO módulo depende |
| **economy** | Contas, transações, split engine — infraestrutura financeira |
| **companies** | Pessoa Jurídica é ACTOR base, não feature opcional |
| **categories** | Taxonomia global, usada por todos os módulos |
| **tenants** | Multi-cidade, isolamento de dados |
| **feed** | Hub central, agrega tudo |
| **profile** | Dados do usuário, base para qualquer ação |

### O que DEVE ficar em `modules/`

| Módulo | Justificativa |
|--------|---------------|
| **events** | Feature plugável, pode existir cidade sem eventos |
| **groups** | Feature social, opcional |
| **social** | Posts, likes, comentários — feature |
| **work** | Serviços, contratações — feature |
| **rides** | 🔒 LATENTE — feature futura |
| **votes** | Votações comunitárias — feature |

### Companies no core: ✅ DECISÃO CORRETA

**Justificativa:**
1. Empresa é um **tipo de Actor** (como User)
2. Qualquer módulo pode precisar de "quem está agindo" (user OU company)
3. Economia precisa saber se pagador/recebedor é PF ou PJ
4. Não é feature opcional — é estrutura do sistema

---

## 2️⃣ MODELO DE ACTORS

### Diagrama Mental

```
                     ┌─────────────────────────────────────┐
                     │           ACTOR (abstração)         │
                     │  • Pode postar                      │
                     │  • Pode receber/enviar dinheiro     │
                     │  • Tem reputação                    │
                     │  • Aparece no feed                  │
                     └─────────────────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
            ▼                         ▼                         ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │     USER      │       │    COMPANY    │       │     GROUP     │
    │   (CPF/PF)    │       │   (CNPJ/PJ)   │       │  (Comunidade) │
    │               │       │               │       │               │
    │ actor_type:   │       │ actor_type:   │       │ actor_type:   │
    │   'user'      │       │   'page'      │       │   'group'     │
    └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
            │                       │                       │
            │                       │                       │
    ┌───────┴───────┐       ┌───────┴───────┐       ┌───────┴───────┐
    │  Precisa de   │       │  Precisa de   │       │  Precisa de   │
    │  validação?   │       │  validação?   │       │  validação?   │
    │               │       │               │       │               │
    │  SIM - para   │       │  SIM - para   │       │  SIM - se     │
    │  receber $$$  │       │  receber $$$  │       │  receber $$$  │
    └───────────────┘       └───────────────┘       └───────────────┘
```

### Respostas objetivas:

**Pessoa Física (CPF) → actor base**
- Tipo: `actor_type = 'user'`
- Cria automaticamente ao fazer cadastro
- Status inicial: **ACTIVE** (pode usar tudo)
- Validação: **Só para receber dinheiro de terceiros**

**Empresa (CNPJ) → actor derivado**
- Tipo: `actor_type = 'page'`
- Criado quando usuário cadastra empresa
- Status inicial: **PROVISIONAL** (pode postar, não pode receber $$$)
- Validação: **Obrigatória para receber dinheiro**

**Grupo / Comunidade → actor SIM**
- Tipo: `actor_type = 'group'`
- Criado quando usuário cria grupo
- Status inicial: **ACTIVE** (pode postar)
- Validação: **Só se tiver conta bancária própria**

**Banda / Artista → precisa de CNPJ?**
- **Com CNPJ:** Usa empresa normalmente
- **Sem CNPJ (MEI não formalizado):** Pode criar como **Grupo** com representante PF
- **Regra:** Quem RECEBE o dinheiro precisa estar validado (pode ser o PF representante)

**Um CPF pode controlar vários actors?**
- ✅ **SIM**
- 1 CPF pode ter: perfil pessoal + N empresas + N grupos que administra
- No seletor de contexto, usuário escolhe "quem está agindo"

---

## 3️⃣ ESTRATÉGIA DE VALIDAÇÃO (ANTI-FRAUDE)

### Pergunta: Validar PF resolve 80% do problema?

**RESPOSTA: SIM, mas com nuance.**

| Cenário | Risco sem validação | Solução |
|---------|---------------------|---------|
| PF vende serviço e some | ALTO | Validar PF antes de receber |
| PJ vende ingresso e some | ALTO | Validar PJ antes de receber |
| Grupo recebe doação | MÉDIO | Validar representante PF |
| PF compra ingresso | BAIXO | Não precisa validar |
| PF posta no feed | ZERO | Não precisa validar |

### Regra de ouro proposta:

```
QUEM RECEBE DINHEIRO DE TERCEIROS = PRECISA ESTAR VALIDADO
QUEM GASTA SEU PRÓPRIO DINHEIRO = NÃO PRECISA VALIDAR
```

### Empresas herdam validação da pessoa?

**RESPOSTA: NÃO diretamente, mas SIMPLIFICA.**

Se a PF já está validada:
- Empresa criada por ela pode ter **validação simplificada** (online, não presencial)
- Risco reduzido: já sabemos quem é o responsável

Se a PF NÃO está validada:
- Empresa precisa de **validação completa** (presencial)

### Grupos que recebem dinheiro precisam de validação?

**RESPOSTA: DEPENDE do modelo.**

| Modelo | Validação necessária |
|--------|---------------------|
| Grupo só posta/organiza | ❌ Não precisa |
| Grupo recebe doações | ✅ Validar representante PF |
| Grupo tem conta própria | ✅ Validar como PJ (precisa CNPJ) |
| Grupo cobra mensalidade | ✅ Validar representante PF |

### O que validar: CPF, CNPJ ou ambos?

**RESPOSTA: AMBOS, mas em momentos diferentes.**

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE VALIDAÇÃO                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CADASTRO        USAR SOCIAL      RECEBER DINHEIRO         │
│     │                │                    │                 │
│     ▼                ▼                    ▼                 │
│  PF: OK          PF: OK              PF: VALIDAR           │
│  PJ: PROVISIONAL PJ: PROVISIONAL     PJ: VALIDAR           │
│  Grupo: OK       Grupo: OK           Grupo: VALIDAR REP.   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4️⃣ ESTRATÉGIA INICIAL SIMPLES

### Fase 1: Lançamento (MVP)

```
┌────────────────────────────────────────────────────────────┐
│  REGRA SIMPLES PARA LANÇAMENTO                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ✅ TODO MUNDO pode:                                       │
│     • Criar conta                                          │
│     • Postar no feed                                       │
│     • Criar empresa (PROVISIONAL)                          │
│     • Criar grupo                                          │
│     • COMPRAR ingressos/serviços                           │
│                                                            │
│  ⚠️ PARA RECEBER DINHEIRO:                                 │
│     • PF: Validar identidade (selfie + doc)                │
│     • PJ: Validar presencialmente OU online com PF válida  │
│     • Grupo: Representante PF validado                     │
│                                                            │
│  🔒 LIMITES SEM VALIDAÇÃO:                                 │
│     • Não pode sacar                                       │
│     • Não pode vender serviços                             │
│     • Não pode criar evento pago                           │
│     • Não pode receber doações                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Por que essa estratégia é boa:

1. **Não mata adoção:** Qualquer um cria conta e usa em 2 minutos
2. **Protege o dinheiro:** Só quem vai RECEBER precisa validar
3. **Escalável:** Validação online para PF, presencial para PJ
4. **Simples de explicar:** "Quer receber? Valide."

---

## 5️⃣ DASHBOARD ADMINISTRATIVO

### Primeiro dashboard (MVP):

```
┌────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD — VALIDAÇÕES                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📊 MÉTRICAS                                               │
│  ├── Empresas PROVISIONAL: 47                              │
│  ├── Empresas VERIFIED: 12                                 │
│  ├── Validações hoje: 3                                    │
│  └── Validações pendentes: 8                               │
│                                                            │
│  📋 FILA DE VALIDAÇÃO                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Empresa          │ CNPJ           │ Status │ Ação    │  │
│  ├──────────────────┼────────────────┼────────┼─────────┤  │
│  │ Padaria do João  │ 12.345.678/... │ PROV.  │ [Val]   │  │
│  │ Tech Solutions   │ 98.765.432/... │ PROV.  │ [Val]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  🔍 BUSCAR EMPRESA                                         │
│  [________________________] [Buscar]                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Fluxo de validação manual:

```
1. Admin vê empresa na fila
2. Clica em [Validar]
3. Sistema mostra: CNPJ, Razão Social, Responsável (CPF)
4. Admin verifica documentação (upload ou presencial)
5. Admin clica [Aprovar] ou [Rejeitar + motivo]
6. Sistema: company_status = 'VERIFIED'
7. Empresa pode receber dinheiro
```

### Quem pode validar:

| Validador | Pode validar | Onde |
|-----------|--------------|------|
| Admin interno | Tudo | Dashboard |
| Parceiro (loja) | Presencial com QR | App do parceiro |
| Sistema automático | PF com selfie | Online |

### Restrição por cidade:

```sql
-- Validadores só veem empresas da sua cidade
SELECT * FROM companies c
JOIN users u ON c.global_user_id = u.global_user_id
WHERE u.tenant_id = 'curitiba-tenant-id'
  AND c.company_status = 'PROVISIONAL';
```

---

## 6️⃣ PRÓXIMOS PASSOS (PRÁTICOS)

### ✅ DESENVOLVER AGORA

1. **Corrigir bug de validação** (body vazio + tenant_id)
2. **Endpoint admin para listar empresas PROVISIONAL**
3. **Endpoint admin para aprovar/rejeitar empresa**
4. **Tela simples de dashboard admin**
5. **Validação online de PF** (selfie + documento)

### ❌ NÃO DESENVOLVER AGORA

1. ~~Sistema completo de validação de grupos~~
2. ~~Validação automática com IA~~
3. ~~Rede de parceiros validadores~~
4. ~~Níveis de validação (bronze, prata, ouro)~~
5. ~~Validação internacional~~

### 🔜 DEIXAR PREPARADO PARA O FUTURO

1. **Tabela company_validations** já existe ✅
2. **Campo company_status** já tem APPROVED/SUSPENDED ✅
3. **Estrutura de actors** permite novos tipos ✅
4. **Split engine** pode ter regras por status de validação ✅

---

## 📋 CHECKLIST IMEDIATO

| Tarefa | Prioridade | Esforço |
|--------|------------|---------|
| Corrigir bug body vazio | 🔴 CRÍTICO | 5 min |
| Corrigir bug tenant_id | 🔴 CRÍTICO | 15 min |
| Testar validação presencial | 🔴 CRÍTICO | 10 min |
| Dashboard admin básico | 🟡 ALTA | 2h |
| Endpoint listar PROVISIONAL | 🟡 ALTA | 30 min |
| Endpoint aprovar empresa | 🟡 ALTA | 30 min |

---

*Análise concluída. Correções técnicas prontas para execução.*
