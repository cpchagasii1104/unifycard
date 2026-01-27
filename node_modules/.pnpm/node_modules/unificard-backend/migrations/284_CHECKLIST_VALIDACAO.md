# Checklist de Validação - Correção de Encoding UTF-8

## ✅ ANTES DA MIGRATION

1. **Verificar encoding do banco:**
   ```sql
   SHOW server_encoding;
   SHOW client_encoding;
   ```
   - Esperado: `UTF8` ou `UTF8`

2. **Executar script de validação:**
   ```bash
   psql $DATABASE_URL -f backend/migrations/284_validate_encoding.sql
   ```

3. **Verificar estado atual dos segments:**
   ```sql
   SELECT slug, name, description 
   FROM categories
   WHERE metadata->>'category_type' = 'segment'
     AND metadata->>'marketplace_domain' = 'market'
     AND country_code = 'BR';
   ```
   - Anotar quais estão com encoding quebrado

## ✅ EXECUTAR MIGRATION

```bash
psql $DATABASE_URL -f backend/migrations/284_fix_marketplace_segments_encoding.sql
```

## ✅ APÓS A MIGRATION

1. **Validar que os nomes estão corretos:**
   ```sql
   SELECT slug, name, description 
   FROM categories
   WHERE metadata->>'category_type' = 'segment'
     AND metadata->>'marketplace_domain' = 'market'
     AND country_code = 'BR'
     AND parent_id IS NULL
   ORDER BY slug;
   ```
   
   **Resultado esperado:**
   - `eletronicos` → **Eletrônicos** (não "EletrÃ´nicos")
   - `farmacias` → **Farmácias** (não "FarmÃ¡cias")
   - `lojas-construcao` → **Lojas de Construção** (não "ConstruÃ§Ã£o")
   - `moda` → **Moda** (correto)
   - `pet-shops` → **Pet Shops** (correto)
   - `supermercados` → **Supermercados** (correto)

2. **Contar segments corrigidos:**
   ```sql
   SELECT COUNT(*) 
   FROM categories
   WHERE metadata->>'category_type' = 'segment'
     AND metadata->>'marketplace_domain' = 'market'
     AND country_code = 'BR'
     AND parent_id IS NULL
     AND name IN ('Supermercados', 'Farmácias', 'Lojas de Construção', 'Pet Shops', 'Moda', 'Eletrônicos');
   ```
   - Esperado: `6`

3. **Testar endpoint:**
   ```bash
   curl http://localhost:3000/marketplace/categories/root?domain=market
   ```
   - Verificar que os nomes aparecem corretamente no JSON
   - Verificar no frontend que não há encoding quebrado

## ✅ VALIDAÇÃO FINAL

- [ ] Todos os 6 segments têm nomes corretos em UTF-8
- [ ] Endpoint retorna JSON com encoding correto
- [ ] Frontend exibe textos corretamente (sem "EletrÃ´nicos")
- [ ] Nenhum segment de outro domínio foi alterado
- [ ] Nenhuma offer_category foi alterada
- [ ] Backend continua configurado com UTF-8 (pool.ts linha 63)

## 🔍 SE AINDA HOUVER PROBLEMAS

1. **Verificar encoding da conexão do Node:**
   - Verificar logs do backend ao iniciar
   - Deve aparecer: `SET client_encoding = 'UTF8'`

2. **Verificar encoding do arquivo SQL:**
   ```bash
   file -bi backend/migrations/284_fix_marketplace_segments_encoding.sql
   ```
   - Esperado: `text/plain; charset=utf-8`

3. **Verificar encoding do terminal/cliente SQL:**
   - Terminal deve estar em UTF-8
   - psql deve estar configurado para UTF-8



