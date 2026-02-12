# 🌱 Seeds de Demonstração

## Visão Geral

Este diretório contém **seeds de demonstração** que não devem ser executados automaticamente em produção.

Seeds são scripts SQL que populam o banco com dados de exemplo para desenvolvimento, staging e QA.

---

## ⚠️ Regras Importantes

1. **NÃO executar em produção**: Seeds contêm dados de demonstração
2. **Execução controlada**: Seeds só rodam com flag explícita `RUN_SEEDS=true`
3. **Idempotência**: Seeds devem ser idempotentes (podem rodar múltiplas vezes)

---

## 🚀 Como Executar

### Executar Seeds

```bash
# Definir flag no .env
RUN_SEEDS=true

# Ou via linha de comando
RUN_SEEDS=true pnpm migrate
```

### Não Executar Seeds (Padrão)

```bash
# Seeds não são executados por padrão
pnpm migrate
```

---

## 📁 Arquivos

### `035_seed_demo_city_nova_beauty.sql`

**Descrição**: Seed de demonstração completo - Cidade Nova Beauty / Manicure

**Cria**:
- Tenant de demonstração
- Empresa (salão de beleza)
- Usuária global + local (Maria Manicure)
- Vínculo profissional (worker)
- Categorias (Beleza > Manicure)
- Agenda e horários disponíveis

**Dependências**:
- Migration 047 (companies) deve estar executada

**Idempotente**: ✅ Sim

---

## 🔍 Verificação

### Verificar se Seeds Foram Executados

```sql
-- Verificar tenant demo
SELECT * FROM tenants WHERE slug = 'cidade-nova-demo';

-- Verificar usuária demo
SELECT * FROM users WHERE email = 'maria.manicure@cidadenova.demo';
```

---

## 📝 Notas

- Seeds são **separados** de migrations para evitar execução automática
- Seeds podem ser executados **independentemente** das migrations
- Seeds devem ser **idempotentes** (podem rodar múltiplas vezes sem duplicar dados)

---

**Status**: Implementado  
**Última atualização**: 2024














