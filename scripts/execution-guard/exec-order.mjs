/**
 * Ordem canónica — alinhar a EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md → EXECUTION ENTRYPOINT.
 */
export const EXEC_ORDER = [
  'EXEC-INFRA-1-WORKER',
  'EXEC-INFRA-1-MIGRATE',
  'EXEC-INFRA-4-SAGA',
  'EXEC-PROD-6-SNAPSHOT',
  'EXEC-INFRA-3-JOB',
  'EXEC-INFRA-6',
  'EXEC-ORCH-1',
];

/** Início da secção obrigatória em STATUS_EXECUCAO.md (linha ##). */
export const REGISTRY_SECTION_PREFIX = '## Registo de tasks EXEC';
