Status: NON-NORMATIVE
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
ARQUIVO NOVO 2/3 — GLOSSARIO_CANONICO.md

# Glossário Canônico — UnifiCard

## Core
Conjunto de mecanismos imutáveis que não podem ser duplicados, reescritos ou substituídos sem emenda institucional explícita.
Ver: CORE_IMUTAVEL.md e CORE_TEMPORAL_E_AGENDA_UNIVERSAL.md.

## Read-model
Metadado descritivo para UX/filtragem leve/observabilidade.
NUNCA decide preço, ranking, visibilidade, acesso ou prioridade.

## Policy (Decisão)
Regra que muda comportamento do sistema. Só existe se estiver escrita e autorizada em contrato.
Se não está em contrato, não existe.

## Estado mutável vs Verdade canônica
- Estado mutável: pode ser atualizado (ex: publication_metadata).
- Verdade canônica: fatos/ledger/snapshots auditáveis (append-only).
Ver: DATABASE_CANONICAL_TRUTH_CONTRACT.md.

## Observabilidade passiva
Métricas e logs que NÃO acionam decisões automáticas e NÃO alteram UX/ranking/visibilidade.
Ver: OBSERVABILIDADE_CONSTITUCIONAL.md.

## Actor
Identidade operacional que executa ações (PF, página/empresa, grupo etc). Um “actor sem base” é bug estrutural.

## Agenda Universal
Fonte canônica de tempo do sistema. Tudo que tem data/hora deve convergir para ela.
Eventos coletam input; a agenda é a verdade canônica.
Ver: CORE_TEMPORAL_E_AGENDA_UNIVERSAL.md.

## RFQ (Request for Quotation)
Pedido de cotação disparado de forma explícita. Matching é sugestão; decisão humana.

## “Sugestão” vs “Automação”
Sugestão: o sistema mostra opções; humano escolhe.
Automação: sistema decide/age sem clique explícito. Em geral é proibido fora de contrato.
Ver: DECISION_SAFETY_AND_CONTAINMENT_CONTRACT.md.

