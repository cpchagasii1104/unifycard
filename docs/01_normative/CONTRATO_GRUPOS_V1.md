Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# CONTRATO DE GRUPOS — UnifiCard v1.0

> **Este documento é LEI.**
> Qualquer implementação que contradiga este contrato é BUG por definição.

**Data:** 30/12/2025
**Status:** APROVADO
**Versão:** 1.0

---

## 📜 DECLARAÇÃO DE PROPÓSITO

Grupos são **atores econômicos coletivos** com camada social por cima.

Grupos NÃO são:
- Clubinhos sem impacto
- Cooperativas informais sem auditoria
- Módulo social isolado

Grupos SÃO:
- Entidades que recebem % do split de seus membros
- Atores que podem agir no ecossistema (postar, criar eventos, apoiar projetos)
- Peças fundamentais para expansão orgânica do UnifiCard

---

## 🏗️ ARQUITETURA

### Grupo como Actor

```
┌─────────────────────────────────────────────────────────────┐
│                         ACTORS                              │
├─────────────────────────────────────────────────────────────┤
│  actor_type = 'user'   │  Pessoa física                     │
│  actor_type = 'page'   │  Empresa (PJ)                      │
│  actor_type = 'group'  │  Grupo (coletivo)        ◄── NOVO  │
│  actor_type = 'channel'│  Canal (futuro)                    │
└─────────────────────────────────────────────────────────────┘
```

### Grupo no CORE

```
┌─────────────────────────────────────────────────────────────┐
│                      CORE/ECONOMY                           │
├─────────────────────────────────────────────────────────────┤
│  Grupo TEM account própria (owner_type = 'group')           │
│  Grupo recebe split via Split Engine                        │
│  Grupo gasta dentro do ecossistema                          │
│  Grupo NÃO saca para fora (v1)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 💰 ECONOMIA DOS GRUPOS

### 1. Split Comunitário (5% do total)

O split comunitário de 5% é dividido entre:
- **Grupos do usuário** (até 3%)
- **Fundo Regional** (mínimo 2%)

### 2. Regra de Divisão (v1 — Defaults Iniciais)

| Grupos Ativos | % Grupos | % Fundo Regional |
|---------------|----------|------------------|
| 0 grupos      | 0%       | 5%               |
| 1 grupo       | 1%       | 4%               |
| 2 grupos      | 2%       | 3%               |
| 3 grupos      | 3%       | 2%               |

**Regra:** 1% fixo por grupo ativo, máximo 3 grupos.

### 3. Configuração Administrativa (Futuro)

> ⚠️ **IMPORTANTE:** Os valores acima são defaults iniciais.
> O sistema DEVE ser arquitetado para permitir configuração futura via painel admin.

```typescript
// Estrutura de configuração (a ser implementada)
interface SplitConfiguration {
  community_total_percent: number;      // Default: 5%
  per_group_percent: number;            // Default: 1%
  max_groups_per_user: number;          // Default: 3
  regional_fund_minimum_percent: number; // Default: 2%
  referral_percent: number;             // Default: 0% (futuro)
}
```

**Configurações futuras previstas:**
- % por código de indicação (referral)
- % para fundo regional
- % para grupos
- Máximo de grupos por usuário

### 4. Quando Grupo Recebe Split

Grupo **SÓ recebe split** se:
- ✅ Tem ≥ 5 membros
- ✅ Status ≠ `DORMANT`
- ✅ Está ativo (1 post/mês OU 1 evento/trimestre)

Grupo que não cumpre critérios:
- Split do usuário vai para **Fundo Regional**

### 5. Como Grupo Gasta

Grupo PODE:
- ✅ Financiar eventos (próprios ou de terceiros)
- ✅ Subsidiar ingressos para membros
- ✅ Contratar serviços de prestadores **externos ao grupo**
- ✅ Apoiar projetos comunitários
- ✅ Doar para fundo regional

Grupo NÃO PODE:
- ❌ Sacar para conta bancária externa (v1)
- ❌ Contratar/pagar membros do próprio grupo
- ❌ Transferir para conta pessoal de admin

---

## 🏛️ GOVERNANÇA

### 1. Status do Grupo

```
┌─────────────┐     5 membros     ┌─────────────┐
│   DRAFT     │ ────────────────► │  INFORMAL   │
│ (criação)   │                   │  (ativo)    │
└─────────────┘                   └──────┬──────┘
                                         │
                         ┌───────────────┼───────────────┐
                         │               │               │
                         ▼               ▼               ▼
                  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                  │  VERIFIED   │ │   DORMANT   │ │   BANNED    │
                  │ (validado)  │ │ (inativo)   │ │ (banido)    │
                  └─────────────┘ └─────────────┘ └─────────────┘
```

### 2. Regras de Transição

| De | Para | Condição |
|----|------|----------|
| DRAFT | INFORMAL | ≥ 5 membros |
| INFORMAL | VERIFIED | Solicitação + validação manual |
| INFORMAL | DORMANT | 90 dias sem atividade |
| DORMANT | INFORMAL | Nova atividade (post/evento) |
| Qualquer | BANNED | Violação grave / fraude |

### 3. Criação de Grupo

- **Quem pode criar:** Qualquer usuário autenticado
- **Status inicial:** `DRAFT`
- **Limite de membros inicial:** 200
- **Limite de membros verificado:** 1.000 (expandível)

### 4. Visibilidade

| Status | Aparece em busca | Aparece em sugestões | Recebe split |
|--------|------------------|----------------------|--------------|
| DRAFT | ❌ | ❌ | ❌ |
| INFORMAL | ✅ | ✅ | ✅ |
| VERIFIED | ✅ | ✅ (prioridade) | ✅ |
| DORMANT | ❌ | ❌ | ❌ |
| BANNED | ❌ | ❌ | ❌ |

### 5. Administração do Grupo

- **Criador:** Automaticamente `ADMIN`
- **Admins:** Podem adicionar outros admins (máx. 5)
- **Moderadores:** Podem aprovar/remover membros
- **Membros:** Participam, postam, recebem benefícios

```typescript
type GroupRole = 'admin' | 'moderator' | 'member';
```

---

## 📂 TIPOS DE GRUPO

### 1. Categorias Pré-definidas

```typescript
type GroupCategory =
  | 'neighborhood'  // Bairro / Comunidade local
  | 'faith'         // Igreja / Religião / Espiritualidade
  | 'cause'         // Causa social (animais, idosos, meio ambiente)
  | 'sport'         // Esporte / Torcida / Clube
  | 'culture'       // Arte / Música / Teatro
  | 'professional'  // Profissional / Networking
  | 'hobby'         // Hobby / Interesse comum
  | 'education'     // Educação / Estudo
  | 'other';        // Outro (requer descrição)
```

### 2. Subtipo Livre

```typescript
interface Group {
  category: GroupCategory;      // Obrigatório
  subtype: string | null;       // Livre (ex: "Motoclube Curitiba")
}
```

### 3. Regra de Ouro

> **Todos os grupos usam a mesma engine.**
> Diferenças de comportamento vêm por **policy**, não por código novo.
> Igreja e Motoclube = mesmo motor, mesmas regras.

---

## 🎭 GRUPO COMO ACTOR SOCIAL

### 1. O que Grupo PODE fazer (sempre)

- ✅ Postar no feed (aparece como actor_type = 'group')
- ✅ Ter página própria com bio, avatar, capa
- ✅ Receber seguidores (não-membros podem seguir)
- ✅ Criar eventos **gratuitos**
- ✅ Apoiar eventos de terceiros (financeiramente)

### 2. O que Grupo PODE fazer (após qualificação)

**Requisitos para ações econômicas:**
- ≥ 20 membros
- ≥ 3 meses de existência
- ≥ 1 evento gratuito realizado

Após qualificação:
- ✅ Criar eventos **pagos**
- ✅ Vender ingressos
- ✅ Oferecer serviços (como actor)

### 3. O que Grupo NÃO PODE fazer

- ❌ Vender produtos (v1 — marketplace é futuro)
- ❌ Emitir nota fiscal (grupo não é PJ)
- ❌ Ter funcionários

---

## 👥 MEMBROS E PARTICIPAÇÃO

### 1. Limite de Grupos por Usuário

- **Máximo:** 3 grupos ativos
- **Mínimo:** 0 (não obrigatório)

### 2. Entrada em Grupo

| Tipo de Grupo | Entrada |
|---------------|---------|
| Aberto | Automática (usuário clica "Participar") |
| Aprovação | Admin/Moderador aprova solicitação |
| Convite | Apenas por convite de membro |

### 3. Saída e Troca de Grupo

**Período de teste (primeiros 7 dias):**
- Troca livre, sem restrições
- Usuário pode entrar/sair à vontade

**Após 7 dias:**
- Cooldown de **30 dias** para nova troca
- Saída imediata é permitida
- Nova entrada em outro grupo respeita cooldown

### 4. Remoção de Membro

- Admin pode remover membro a qualquer momento
- Membro removido entra em cooldown de 30 dias para aquele grupo
- Split é recalculado imediatamente

---

## 🛡️ ANTI-PATTERNS E MITIGAÇÕES

### ❌ Anti-Pattern 1: Grupo Lavanderia

**Risco:** Grupo fake criado para concentrar split e "lavar" dinheiro em serviços próprios.

**Mitigação:**
```
Grupo NÃO PODE contratar/pagar membros do próprio grupo.
Verificação: prestador.actor_id NOT IN (grupo.membros)
```

### ❌ Anti-Pattern 2: Grupo Zumbi

**Risco:** Grupo inativo que acumula dinheiro sem comunidade real.

**Mitigação:**
```
Split só para grupos com atividade mínima:
- 1 post/mês OU
- 1 evento/trimestre
Sem atividade → status DORMANT → split vai para fundo
```

### ❌ Anti-Pattern 3: Pressão de Exclusividade

**Risco:** Grupo pressionando membros a não participar de outros grupos.

**Mitigação:**
```
Split fixo de 1% por grupo (não 3% para grupo único).
Incentivo econômico para exclusividade = ZERO.
```

### ❌ Anti-Pattern 4: Spam de Grupos

**Risco:** Usuários criando dezenas de grupos vazios.

**Mitigação:**
```
Grupo só aparece em busca/sugestões após 5 membros.
Grupo só recebe split após 5 membros.
```

### ❌ Anti-Pattern 5: Grupo Predatório

**Risco:** Grupo usando economia para benefício de poucos admins.

**Mitigação:**
```
Ledger público de gastos do grupo.
Qualquer membro pode ver para onde foi o dinheiro.
Transparência = auditoria coletiva.
```

---

## 📊 MODELO DE DADOS

### Tabela: groups

```sql
CREATE TABLE groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Identificação
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  description TEXT,
  
  -- Categorização
  category VARCHAR(50) NOT NULL,
  subtype VARCHAR(100),
  
  -- Configuração
  join_type VARCHAR(20) DEFAULT 'open', -- open, approval, invite
  max_members INTEGER DEFAULT 200,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, informal, verified, dormant, banned
  
  -- Mídia
  avatar_url TEXT,
  cover_url TEXT,
  
  -- Economia
  account_id UUID REFERENCES accounts(account_id),
  
  -- Qualificação econômica
  can_sell BOOLEAN DEFAULT false,
  qualified_at TIMESTAMPTZ,
  
  -- Atividade
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Criador
  created_by UUID NOT NULL REFERENCES users(user_id)
);
```

### Tabela: group_members

```sql
CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Papel
  role VARCHAR(20) DEFAULT 'member', -- admin, moderator, member
  
  -- Datas
  joined_at TIMESTAMPTZ DEFAULT now(),
  cooldown_until TIMESTAMPTZ, -- Para controle de troca
  
  PRIMARY KEY (group_id, user_id)
);
```

### Tabela: user_active_groups

```sql
-- Grupos ativos do usuário (máx 3) para cálculo de split
CREATE TABLE user_active_groups (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  
  -- Ordem de prioridade (1, 2, 3)
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 3),
  
  -- Quando ativou
  activated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Cooldown para troca
  can_change_after TIMESTAMPTZ,
  
  PRIMARY KEY (user_id, group_id),
  UNIQUE (user_id, priority)
);
```

---

## 🔄 INTEGRAÇÃO COM SPLIT ENGINE

### Fluxo de Split com Grupos

```
Transação (R$ 100,00)
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                    SPLIT ENGINE                           │
├───────────────────────────────────────────────────────────┤
│  70% → Prestador                         = R$ 70,00       │
│  15% → Cidade (tenant)                   = R$ 15,00       │
│  10% → Região                            = R$ 10,00       │
│   5% → Comunitário                       = R$  5,00       │
│         │                                                 │
│         ├── Usuário em 3 grupos ativos?                   │
│         │   └── 1% cada grupo (R$ 1,00 x 3)               │
│         │   └── 2% fundo regional (R$ 2,00)               │
│         │                                                 │
│         └── Usuário em 0 grupos?                          │
│             └── 5% fundo regional (R$ 5,00)               │
└───────────────────────────────────────────────────────────┘
```

### Código de Referência

```typescript
function calculateGroupSplit(
  userId: string,
  communityAmount: number,
  config: SplitConfiguration
): GroupSplitResult {
  const activeGroups = await getActiveGroupsForUser(userId);
  const validGroups = activeGroups.filter(g => 
    g.status === 'informal' || g.status === 'verified'
  );
  
  const perGroupAmount = communityAmount * (config.per_group_percent / 100);
  const groupCount = Math.min(validGroups.length, config.max_groups_per_user);
  const totalToGroups = perGroupAmount * groupCount;
  const toRegionalFund = communityAmount - totalToGroups;
  
  return {
    groups: validGroups.slice(0, groupCount).map(g => ({
      groupId: g.group_id,
      amount: perGroupAmount
    })),
    regionalFund: toRegionalFund
  };
}
```

---

## 📱 UX / FRONTEND

### 1. Onboarding

- Sugerir grupos por:
  - Localização (bairro)
  - Interesses declarados
  - Grupos com maior impacto real (ledger)
- **NÃO usar:** ranking, "grupo do momento", FOMO

### 2. Tela de Grupos do Usuário

```
┌─────────────────────────────────────────┐
│ Meus Grupos (2/3)                       │
├─────────────────────────────────────────┤
│ 🏠 Vizinhos do Batel         [Ativo]   │
│    152 membros • R$ 234 gerados         │
│                                         │
│ ⛪ Igreja Nova Vida          [Ativo]   │
│    89 membros • R$ 156 gerados          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │  + Participar de mais um grupo     │ │
│ │    (1 vaga disponível)             │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 3. Página do Grupo

```
┌─────────────────────────────────────────┐
│ [Capa do Grupo]                         │
├─────────────────────────────────────────┤
│ 🐕 Protetores de Animais CWB            │
│ 234 membros • Causa                     │
│                                         │
│ "Cuidamos dos animais de rua..."        │
│                                         │
│ [Participar]  [Seguir]                  │
├─────────────────────────────────────────┤
│ 💰 Impacto do Grupo                     │
│ ├── Recebido: R$ 1.234,00               │
│ ├── Gasto: R$ 890,00                    │
│ └── Saldo: R$ 344,00                    │
│                                         │
│ [Ver Ledger Completo]                   │
├─────────────────────────────────────────┤
│ 📰 Feed do Grupo                        │
│ [Posts recentes...]                     │
└─────────────────────────────────────────┘
```

---

## 🚫 ESCOPO FECHADO (v1)

### NÃO implementar em v1:

- ❌ DAO / Votação para decisões econômicas
- ❌ Saque para conta bancária externa
- ❌ Marketplace de produtos do grupo
- ❌ Hierarquia complexa de cargos
- ❌ Grupos aninhados (grupo dentro de grupo)
- ❌ Federação de grupos
- ❌ Tokenização / NFT de participação

### Adiado para v2+:

- 🔜 Código de indicação (referral) com split configurável
- 🔜 Painel admin para configurar percentuais
- 🔜 Saque controlado (após validação legal)
- 🔜 Integração com PIX para pagamentos

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Backend

- [ ] Migration: tabelas groups, group_members, user_active_groups
- [ ] Service: GroupService (CRUD, membership, status)
- [ ] Service: GroupEconomyService (split calculation)
- [ ] Routes: /groups/* (REST API)
- [ ] Integration: Split Engine recebe grupos do usuário
- [ ] Cron: Verificar grupos dormentes (90 dias)
- [ ] Cron: Verificar qualificação econômica

### Frontend

- [ ] Página: /grupos (lista de grupos)
- [ ] Página: /grupos/:slug (página do grupo)
- [ ] Página: /grupos/novo (criar grupo)
- [ ] Componente: GroupCard
- [ ] Componente: GroupMembersList
- [ ] Componente: GroupLedger
- [ ] Componente: MyGroupsWidget (sidebar)

### Integração

- [ ] Actor: Grupo aparece no feed
- [ ] Actor: Grupo pode criar eventos
- [ ] Economy: Split para grupos funciona
- [ ] Ledger: Gastos do grupo são públicos

---

## 📝 HISTÓRICO DE DECISÕES

| Data | Decisão | Justificativa |
|------|---------|---------------|
| 30/12/2025 | Split 1% fixo por grupo | Evita incentivo de exclusividade |
| 30/12/2025 | Mínimo 5 membros para existir | Anti-spam |
| 30/12/2025 | 7 dias de teste + 30 dias cooldown | UX humana |
| 30/12/2025 | Grupo não contrata membros | Anti-lavanderia |
| 30/12/2025 | 20 membros + 3 meses para vender | Prova realidade |

---

## 🔐 ASSINATURAS

**Aprovado por:**
- Clayton Pereira Chagas (Product Owner)
- ChatGPT (Arquitetura Estratégica)
- Claude (Validação Técnica)

**Data de aprovação:** 30/12/2025

---

*Este documento é a ÚNICA fonte de verdade para o módulo de Grupos.*
*Qualquer alteração requer nova versão do contrato.*

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
<!-- AUTO-GENERATED-END -->