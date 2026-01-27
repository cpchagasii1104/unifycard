# 🧪 Teste Completo de Migrations e Servidor

## 📋 Instruções para Teste em Banco Limpo

### 1. Preparar Banco de Dados Limpo

```sql
-- Opção 1: Criar novo banco
CREATE DATABASE unificard_test;

-- Opção 2: Dropar e recriar (CUIDADO: apaga todos os dados!)
DROP DATABASE IF EXISTS unificard_test;
CREATE DATABASE unificard_test;
```

### 2. Configurar .env

Crie ou atualize o arquivo `.env`:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/unificard_test
PORT=3000
HOST=0.0.0.0
JWT_SECRET=seu-secret-aqui
```

### 3. Executar Migrations

```bash
npm run migrate
```

### 4. Validar Estrutura

Execute o script de validação:

```bash
node validate-migrations.js
```

## 📊 Resultado Esperado

### Migrations Executadas (37 total)

1. ✅ 001_initial_schema.sql
2. ✅ 002_rbac.sql
3. ✅ 003_config_system.sql
4. ✅ 004_notify_system.sql
5. ✅ 005_unifywork.sql
6. ✅ 006_reviews_and_reputation.sql
7. ✅ 009_rides_part1_geography.sql
8. ✅ 010_rides_part2_drivers_vehicles.sql
9. ✅ 011_rides_part3_ride_lifecycle.sql
10. ✅ 012_rides_part4_pricing.sql
11. ✅ 013_rides_part5_distribution.sql
12. ✅ 014_rides_part6_security_analytics.sql
13. ✅ 015_rides_patch_enhanced.sql
14. ✅ 016_rides_patch_requirements.sql
15. ✅ 017_rides_driver_vehicle_compliance.sql
16. ✅ 018_fix_user_has_permission_rls.sql
17. ✅ 019_world_geography.sql
18. ✅ 020_root_config.sql
19. ✅ 021_tenants_add_city_id.sql
20. ✅ 022_global_identity.sql
21. ✅ 023_reviews_reputation_global_identity.sql
22. ✅ 024_economy_global_identity.sql
23. ✅ 025_global_user_residence.sql
24. ✅ 026_events_core.sql
25. ✅ 027_event_organizers.sql
26. ✅ 028_categories_system.sql
27. ✅ 029_social_core.sql
28. ✅ 030_social_actions.sql
29. ✅ 031_social_chat_intelligence.sql
30. ✅ 032_schedule_universal.sql
31. ✅ 033_care_engine.sql
32. ✅ 034_memory_engine.sql
33. ✅ 035_seed_demo_city_nova_beauty.sql
34. ✅ 036_rides_patch_clayton_requirements.sql (renumerada)
35. ✅ 037_groups_system.sql (renumerada)
36. ✅ 038_groups_rbac_permissions.sql (renumerada)
37. ✅ 039_social_groups_integration.sql (renumerada)

## 🚀 Teste do Servidor

### 1. Iniciar Servidor

```bash
npm run dev
```

### 2. Verificar Logs de Inicialização

O servidor deve mostrar:
- ✅ AI Kernel carregado com sucesso
- ✅ Todos os módulos registrados
- ✅ Servidor ouvindo na porta 3000

### 3. Testar Rotas Críticas

#### Rotas Públicas

```bash
# Health Check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics
```

#### Rotas Protegidas (requerem autenticação)

```bash
# Groups
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/groups

# Social Feed
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/social/feed

# Work Instant (deve retornar 404 para rota inexistente, mas confirma que está registrado)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/work-instant/test
```

## ✅ Checklist de Validação

### Migrations
- [ ] Todas as 37 migrations executam sem erro
- [ ] Nenhuma duplicata de número
- [ ] Migrations renumeradas (036-039) estão na ordem correta
- [ ] Todas as tabelas essenciais foram criadas

### Servidor
- [ ] Servidor inicia sem erros
- [ ] AI Kernel carrega corretamente
- [ ] Todos os módulos são registrados
- [ ] Rotas públicas respondem
- [ ] Rotas protegidas retornam 401 (não autenticado) ou 200 (com token)

### Módulos
- [ ] Work Instant está registrado em `/work-instant`
- [ ] Groups está registrado em `/groups`
- [ ] Social está registrado em `/social`
- [ ] Work está registrado em `/work`

## 📝 Logs Esperados

### Migrations
```
🚀 Iniciando processo de migração...
✔ Conexão com banco de dados estabelecida
📋 Encontradas 37 migração(ões) para executar:
[1/37] 📦 Executando migração: 001_initial_schema.sql
✅ Migração concluída: 001_initial_schema.sql
...
✨ Todas as migrações foram aplicadas com sucesso!
```

### Servidor
```
AI Kernel carregado com sucesso
Server listening on http://0.0.0.0:3000
```

## 🐛 Troubleshooting

### Erro: "relação já existe"
- O banco não está limpo
- Solução: Dropar e recriar o banco ou usar um banco diferente

### Erro: "módulo não encontrado"
- Dependências não instaladas
- Solução: `npm install`

### Erro: "DATABASE_URL não configurada"
- Arquivo .env não existe ou está incorreto
- Solução: Criar/atualizar .env com DATABASE_URL

### Servidor não inicia
- Verificar logs de erro
- Verificar se a porta 3000 está livre
- Verificar se todas as dependências estão instaladas
















