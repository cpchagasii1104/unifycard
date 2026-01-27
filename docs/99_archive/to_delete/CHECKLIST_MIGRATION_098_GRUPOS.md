# CHECKLIST: Migration 098_groups_upgrade_v1

## 📋 O QUE A MIGRATION FAZ

### FASE 1: Upgrade tabela `groups`
| Coluna | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| slug | VARCHAR(100) | NULL | URLs amigáveis |
| category | VARCHAR(50) | 'other' | Categorização |
| subtype | VARCHAR(100) | NULL | Subtipo livre |
| status | VARCHAR(20) | 'draft' | Status do grupo |
| join_type | VARCHAR(20) | 'open' | Tipo de entrada |
| max_members | INTEGER | 200 | Limite de membros |
| avatar_url | TEXT | NULL | Avatar do grupo |
| cover_url | TEXT | NULL | Capa do grupo |
| account_id | UUID | NULL | Ref. direta à conta |
| can_sell | BOOLEAN | false | Qualificação econômica |
| qualified_at | TIMESTAMPTZ | NULL | Data de qualificação |
| last_activity_at | TIMESTAMPTZ | now() | Última atividade |
| member_count | INTEGER | 0 | Cache de contagem |

### FASE 2: Upgrade tabela `group_members`
| Coluna | Tipo | Default | Propósito |
|--------|------|---------|-----------|
| cooldown_until | TIMESTAMPTZ | NULL | Controle de troca |
| trial_ends_at | TIMESTAMPTZ | NULL | Período de teste |

### FASE 3: Nova tabela `user_active_groups`
Controla quais grupos recebem split do usuário (máx 3).

### FASE 4: Nova tabela `split_configuration`
Configurações do Split Engine por tenant (defaults iniciais, admin futuro).

### FASE 5: Integração com `actors`
Verifica se coluna `group_id` existe em actors.

### FASE 6: Functions e Triggers
- `update_group_member_count()` — atualiza contagem
- `update_group_status_on_member_change()` — draft → informal ao atingir 5 membros
- `update_group_last_activity()` — atualiza quando grupo posta
- `check_group_economic_qualification()` — verifica qualificação (20 membros + 3 meses + evento)

---

## 🔄 IMPACTO NO SISTEMA

### Split Engine
- [ ] **DEVE** ler `split_configuration` ao invés de valores hardcoded
- [ ] **DEVE** consultar `user_active_groups` para saber grupos do usuário
- [ ] **DEVE** verificar `status` do grupo (só `informal` ou `verified` recebem)
- [ ] **DEVE** verificar `last_activity_at` (grupo dormante não recebe)

### Actor System
- [ ] Grupo **PODE** ser actor (`actor_type = 'group'`)
- [ ] Ao criar grupo, **DEVE** criar actor correspondente
- [ ] Actor do grupo **DEVE** ter `group_id` preenchido

### Feed
- [ ] Posts de grupos **DEVEM** aparecer no feed
- [ ] Grupos `DRAFT` **NÃO DEVEM** aparecer em sugestões
- [ ] Grupos `DORMANT` **NÃO DEVEM** aparecer em sugestões

### Ledger
- [ ] Transações para grupos **DEVEM** usar account do grupo
- [ ] Ledger do grupo **DEVE** ser público para membros

---

## ✅ CHECKLIST PÓS-MIGRATION

### Backend
- [ ] Migration aplicada sem erros
- [ ] Tabela `user_active_groups` existe
- [ ] Tabela `split_configuration` existe e tem defaults
- [ ] Colunas novas em `groups` existem
- [ ] Triggers funcionando (testar inserção de membro)

### Services a atualizar
- [ ] `GroupService` — usar novos campos
- [ ] `SplitEngineService` — ler configuração da tabela
- [ ] `ActorService` — criar actor para grupo

### Verificação de dados
```sql
-- Verificar se split_configuration tem defaults
SELECT * FROM split_configuration;

-- Verificar contagem de membros sincronizada
SELECT g.group_id, g.name, g.member_count, 
       (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id) as real_count
FROM groups g;

-- Verificar status dos grupos existentes
SELECT status, COUNT(*) FROM groups GROUP BY status;
```

---

## 🚨 ROLLBACK (se necessário)

```sql
-- CUIDADO: Só executar se migration falhou parcialmente

-- Remover tabelas novas
DROP TABLE IF EXISTS user_active_groups CASCADE;
DROP TABLE IF EXISTS split_configuration CASCADE;

-- Remover colunas de groups (executar uma por vez)
ALTER TABLE groups DROP COLUMN IF EXISTS slug;
ALTER TABLE groups DROP COLUMN IF EXISTS category;
ALTER TABLE groups DROP COLUMN IF EXISTS subtype;
ALTER TABLE groups DROP COLUMN IF EXISTS status;
ALTER TABLE groups DROP COLUMN IF EXISTS join_type;
ALTER TABLE groups DROP COLUMN IF EXISTS max_members;
ALTER TABLE groups DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE groups DROP COLUMN IF EXISTS cover_url;
ALTER TABLE groups DROP COLUMN IF EXISTS account_id;
ALTER TABLE groups DROP COLUMN IF EXISTS can_sell;
ALTER TABLE groups DROP COLUMN IF EXISTS qualified_at;
ALTER TABLE groups DROP COLUMN IF EXISTS last_activity_at;
ALTER TABLE groups DROP COLUMN IF EXISTS member_count;

-- Remover colunas de group_members
ALTER TABLE group_members DROP COLUMN IF EXISTS cooldown_until;
ALTER TABLE group_members DROP COLUMN IF EXISTS trial_ends_at;

-- Remover triggers
DROP TRIGGER IF EXISTS trg_update_group_member_count ON group_members;
DROP TRIGGER IF EXISTS trg_update_group_status ON group_members;
DROP TRIGGER IF EXISTS trg_update_group_activity_on_post ON posts;
DROP TRIGGER IF EXISTS trg_check_group_qualification ON groups;

-- Remover functions
DROP FUNCTION IF EXISTS update_group_member_count();
DROP FUNCTION IF EXISTS update_group_status_on_member_change();
DROP FUNCTION IF EXISTS update_group_last_activity();
DROP FUNCTION IF EXISTS check_group_economic_qualification();
```

---

## 📝 PRÓXIMOS PASSOS APÓS MIGRATION

1. **Atualizar GroupService** para usar novos campos
2. **Atualizar SplitEngineService** para ler `split_configuration`
3. **Criar actor** para grupos existentes (se houver)
4. **Implementar endpoint** de ativação de grupo (user_active_groups)
5. **Criar cron** para marcar grupos dormentes (90 dias)

---

*Checklist gerado em 30/12/2025*
*Referência: CONTRATO_GRUPOS_V1.md*
