# 🗄️ UnifyCard – Database Migrations

Este diretório contém **todas as migrations SQL** do projeto **UnifyCard**.  
As migrations representam a **evolução histórica e auditável do schema**, não apenas a criação de tabelas.

Este documento define **como numerar**, **como executar** e, principalmente, **como NÃO executar** migrations.

---

## 📋 Estrutura Geral

- Cada migration é um arquivo `.sql`
- Os arquivos são executados **em ordem numérica crescente**
- A ordem é **contratual**: não pode ser quebrada, reordenada ou “pular por conveniência”

Exemplo:
001_initial_schema.sql
002_rbac.sql
003_config_system.sql
...
028a_catalog_canonical.sql
028b_categories_system.sql


---

## 🔢 Sistema de Numeração

As migrations seguem numeração sequencial:

- `001`, `002`, `003`, ...
- A numeração **define a ordem de execução**
- O número **nunca deve ser reutilizado**

### ➕ Sufixos Alfabéticos

Quando múltiplas migrations precisam existir na **mesma posição lógica**, usam-se sufixos:

- `028a_*`
- `028b_*`
- `028c_*`

Isso permite:
- correções pontuais
- desdobramentos de uma mesma fase
- evitar renumeração destrutiva

---

## ⚠️ Gaps Intencionais na Numeração

Existem **gaps propositalmente reservados** na sequência numérica  
(ex: `007`, `008`, `018`, `040`, `041`, etc.).

👉 **Isso NÃO é erro.**

### Por que os gaps existem?

1. **Reserva para features futuras**
2. **Redução de conflitos de merge**
3. **Agrupamento lógico de fases**
4. **Flexibilidade para patches corretivos**

### Regras importantes
- ❌ Nunca “preencher” um gap antigo
- ❌ Nunca reutilizar um número removido
- ✅ Sempre criar novas migrations em números novos ou sufixados

---

## 🧠 Governança de Execução de Migrations (CRÍTICO)

### 📌 Controle de Estado

O sistema de migrations do UnifyCard **NÃO depende de `IF NOT EXISTS` para governança**.

Existe uma tabela de controle chamada:

```sql
schema_migrations


Ela registra:

o nome do arquivo da migration

a data/hora em que foi aplicada

👉 Uma migration só pode ser executada UMA vez.

O runner:

Lê schema_migrations

Executa apenas migrations não registradas

Registra a migration após sucesso

⚠️ Regra de Ouro

Migration não é “criação de schema”.
Migration é transição entre estados conhecidos.

Por isso:

Migrations iniciais (001, 002, …) NÃO precisam ser idempotentes

Elas assumem banco vazio

O que impede reexecução não é IF NOT EXISTS

O que impede reexecução é controle de versão

🧱 Bootstrap de Bancos Existentes

Em bancos que já possuem schema criado
(ex: ambiente legado, dev antigo, staging):

❌ O que NÃO fazer

NÃO reexecutar migrations iniciais

NÃO adicionar IF NOT EXISTS cegamente

NÃO dropar schema em ambiente com histórico

✅ Procedimento correto (Bootstrap Lógico)

Criar a tabela de controle:

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


Registrar manualmente as migrations já existentes no banco

A partir desse ponto, o runner executará apenas migrations novas

📌 Isso preserva:

histórico

auditoria

integridade do schema

sanidade mental da equipe

🧪 Idempotência (quando usar)
✔️ Usar IF NOT EXISTS quando:

adicionar colunas

criar índices

criar políticas RLS

criar extensões

aplicar patches evolutivos

❌ NÃO usar IF NOT EXISTS para:

migrations fundacionais

criação de tabelas-base iniciais

estruturas que não deveriam existir duas vezes

Idempotência é ferramenta, não desculpa para falta de controle de estado.

🚀 Execução de Migrations
Execução padrão
npm run migrate


O runner:

detecta migrations pendentes

executa em ordem

registra em schema_migrations

Execução manual (casos excepcionais)
psql -d unificard -f migrations/XXX_nome_da_migration.sql


⚠️ Execução manual exige atualização de schema_migrations.

📐 Boas Práticas Obrigatórias

✔️ Cada migration deve ter cabeçalho explicativo

✔️ Nunca sobrescrever schema sem necessidade

✔️ Preferir ADD / ALTER / PATCH

✔️ Governança explícita:

o que o banco faz

o que a aplicação faz

✔️ Evitar lógica de domínio no banco

❌ Evitar CHECKs rígidos de negócio

❌ Evitar triggers decisórias

🧾 Princípio Final

O banco não esquece.
A migration também não pode esquecer.

Migrations são contrato histórico, não script descartável.

Status: Consolidação Técnica
Fase: Auditoria Final de Migrations
Projeto: UnifyCard