# Human MVP — Plano de Execução em Commits

## Regra de Execução
- Cada item é um commit isolado
- Um commit não depende de outro não listado
- Nenhum commit mistura responsabilidades

## Sequência de Commits — Backend

### Commit 1
- Criar endpoint: criar Skill
- Valida categoria + context + tenant
- Gera evento SKILL_CREATED

### Commit 2
- Criar endpoint: criar ServiceOffer
- Valida Skill existente
- Gera evento SERVICE_OFFER_CREATED

### Commit 3
- Criar endpoint: publicar Opportunity
- Valida categoria + permissão
- Gera evento OPPORTUNITY_PUBLISHED

### Commit 4
- Criar lógica de matching por categoria
- Dispara evento MATCH_FOUND

### Commit 5
- Criar geração automática de EventInstance
- Dispara evento EVENT_SCHEDULED

### Commit 6
- Registrar execução de atividade
- Dispara evento ACTIVITY_EXECUTED

## Sequência de Commits — Frontend

### Commit 7
- Tela declarar habilidade
- Usa categorias existentes

### Commit 8
- Tela criar serviço
- Usa Skills existentes

### Commit 9
- Tela listar oportunidades
- Apenas leitura

## Sequência de Commits — Eventos e Auditoria

### Commit 10
- Persistir todos os eventos do MVP
- Garantir rastreabilidade completa

## Proibições
- Não criar commits extras
- Não alterar ordem
- Não agrupar commits
- Não implementar nada fora do MVP

## Critério de Aceite
- Todos os commits aplicados em ordem
- Checklist do MVP 100% atendido
- Nenhum código fora do escopo


