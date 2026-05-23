# F3 — Domain Foundations: Location Core — Evidências

Esta pasta consolida as evidências externas (Codex e ChatGPT) que suportaram a abertura da Frente F3 e a aprovação da DECISION-0020 em 2026-05-08.

## Contexto

Sessão F2-S2 (auditoria de runtime smoke test, item A5 — `coluna c.cep não existe`) escalou para decisão arquitetural fundacional após aplicação da §4-B do `opus.md` revelar que feature de endereço de empresa estava 80% implementada no código e só faltava schema. Investigação subsequente descobriu que o plano canônico de Location Core já existia em migrations arquivadas e foi recuado durante a reconstrução pós-genesis.

## Estrutura

| Arquivo | Sessão | Origem | Conteúdo |
|---|---|---|---|
| `F3-S1-codex-auditoria-geografica.md` | F3-S1 | Codex | Auditoria do estado atual: 3 realidades geográficas convivendo, banco vivo sem tabelas canônicas, 9 módulos contornando ausência de Location Core |
| `F3-S1-chatgpt-ontologia.md` | F3-S1 | ChatGPT | Análise ontológica: território já é entidade econômica real, hierarquia implícita emergente, conflito entre região administrativa e econômica |
| `F3-S2-codex-arqueologia-arquitetural.md` | F3-S2 | Codex | Arqueologia: migrations `0360-0363` em `migrations_archive/`, plano canônico recuado, peças maduras reaproveitáveis identificadas |
| `F3-S2-chatgpt-reconciliacao.md` | F3-S2 | ChatGPT | Releitura do diagnóstico: não é "inventar arquitetura", é "reconciliar arquitetura com runtime" |
| `F3-S3-chatgpt-validacao-schema.md` | F3-S3 | ChatGPT | Validação do schema proposto + 4 ajustes técnicos (NUMERIC para coords, address_assignments, owner_type CHECK, source rastreável) + 5 observações finais |

## Conclusão

Convergência total entre Codex (verdade material no disco) e ChatGPT (análise ontológica e validação de design) nas 6 dimensões fundacionais decididas em DECISION-0020.

## Vinculação institucional

- DECISION-0020 (`REMEDIATION_DECISIONS_LOG.md`)
- §4-B do `opus.md` (lei sobre regressão de genesis vs código morto)
- F3-S4+ no `STATUS_EXECUCAO_GLOBAL.md` (próximas sessões executam o resgate)
