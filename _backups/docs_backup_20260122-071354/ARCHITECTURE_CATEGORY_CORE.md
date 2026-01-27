# Category Core — Arquitetura Canônica

- Fonte única de verdade: categories
- Seeds usam (slug, country_code) como identidade
- Nenhuma FK prematura em seeds
- Relacionamentos complexos são adicionados após o core
- Migrations são sempre resetáveis

Última validação:
- Reset completo OK
- 100 migrations aplicadas
- Seed executado com sucesso
