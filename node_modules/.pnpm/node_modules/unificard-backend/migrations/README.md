# 🗄️ UnifyCard - Migrations Database

## 📋 Estrutura de Migrations

Este diretório contém todas as migrations SQL do projeto UnifyCard, organizadas numericamente para garantir ordem de execução.

## 🔢 Sistema de Numeração

As migrations são numeradas sequencialmente (001, 002, 003, ...) para garantir ordem de execução. Alguns números podem ter sufixos alfabéticos (a, b) quando múltiplas migrations precisam ser executadas na mesma ordem lógica.

### Exemplos de Sufixos

- `028a_catalog_canonical.sql` - Primeira migration do grupo 028
- `028b_categories_system.sql` - Segunda migration do grupo 028
- `055a_categories_ai_blindage.sql` - Primeira migration do grupo 055
- `055b_categories_ai_validation.sql` - Segunda migration do grupo 055

## ⚠️ Gaps Intencionais na Numeração

**IMPORTANTE:** Os números ausentes na sequência (ex: 007, 008, 018, 040, 041) são **reservados intencionalmente** e **NÃO são erros**.

### Por que existem gaps?

1. **Reserva para futuras features**: Números são reservados para migrations de features planejadas mas ainda não implementadas
2. **Evita conflitos de merge**: Quando múltiplos desenvolvedores trabalham em paralelo, ter números reservados reduz conflitos ao adicionar novas migrations
3. **Organização lógica**: Permite agrupar migrations relacionadas sem quebrar a sequência numérica
4. **Flexibilidade**: Facilita inserção de migrations corretivas ou patches entre migrations existentes

### Números Reservados (exemplos)

- `007`, `008` - Reservados para features futuras
- `018` - Reservado
- `040`, `041` - Reservados
- Outros gaps podem existir conforme necessário

## ✅ Regras de Uso

1. **Nunca reutilize números existentes**: Se uma migration foi removida, o número permanece reservado
2. **Use sufixos para múltiplas migrations**: Se precisar de múltiplas migrations na mesma ordem, use sufixos (a, b, c)
3. **Documente novas migrations**: Ao criar uma nova migration, atualize este README se necessário
4. **Mantenha ordem**: Sempre execute migrations na ordem numérica

## 🚀 Como Executar

As migrations são executadas automaticamente pelo sistema de migração do projeto. Para execução manual:

```bash
# Executar todas as migrations pendentes
npm run migrate

# Executar migration específica
psql -d unificard -f migrations/XXX_nome_da_migration.sql
```

## 📝 Notas Técnicas

- Todas as migrations devem ser **idempotentes** quando possível
- Use `IF NOT EXISTS` para criar estruturas
- Use `IF EXISTS` para remover estruturas
- Sempre teste migrations em ambiente de desenvolvimento antes de produção

---

**Última atualização:** Fase 0 - Consolidação Técnica
