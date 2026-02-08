# PR Checklist — Categories (Frozen Core)

## Aviso Inicial

⚠️ **O módulo de categorias é CORE e está FROZEN**  
⚠️ **Qualquer violação resulta em rejeição automática do PR**

## Checklist Obrigatório

### Guards e SSOT
- [ ] Nenhuma leitura de categorias sem context
- [ ] Nenhuma leitura de categorias sem tenant
- [ ] Nenhum método novo fora do canônico `getCategoriesForTenant`
- [ ] Nenhum acesso direto ao repository a partir de endpoints

### Arquitetura
- [ ] Não cria múltiplas árvores
- [ ] Não cria roots por domínio
- [ ] Não cria tabelas paralelas (`categories_x`)
- [ ] Não adiciona `context?` opcional em nenhum lugar

### Segurança e Governança
- [ ] CountryCode nunca vem do usuário
- [ ] Cache permanece isolado por (tenant, context)
- [ ] Método legado não foi reutilizado

### Testes
- [ ] `npm run test:ssot` passa 100%
- [ ] Nenhum teste SSOT foi removido ou enfraquecido

### Documentação
- [ ] ADR atualizado se houver decisão estrutural
- [ ] Nenhuma decisão estrutural sem ADR aprovado

## Rejeição Automática Se
- Adicionar `context?` opcional
- Criar método de leitura fora do canônico
- Permitir leitura sem tenant
- Criar exceções "temporárias"

## Aprovação
- [ ] Review de arquiteto sênior obrigatório
- [ ] Sem exceções


