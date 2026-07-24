// src/core/errors/postgres-schema-error.ts
//
// PROPOSITO: traduzir um erro ESTRUTURAL do Postgres (coluna/tabela inexistente) em uma resposta
// HONESTA, em vez de um 500 generico que esconde a causa real.
//
// MOTIVACAO (incidente real): o backend rodando contra um banco SEM as migrations desta
// funcionalidade devolvia "Failed to update event" (500 INTERNAL_ERROR). O Postgres tinha dito
// exatamente o que faltava — 42703 coluna "funding_deadline_at" nao existe — e essa informacao
// era descartada pelo catch-all da rota. Custou depuracao real.
//
// LIMITE DE HONESTIDADE (deliberado): este modulo NAO afirma qual banco e o "certo" nem qual
// migration falta. Ele reporta apenas o que o proprio Postgres declarou (SQLSTATE + identificador
// ausente) e aponta as DUAS saidas possiveis (rodar as migrations OU apontar para o banco correto).
// Nao infere, nao adivinha, nao nomeia ambiente.
//
// Helper PURO (sem I/O, sem dependencia de Fastify): serve qualquer catch-all que queira ser
// honesto sobre desalinhamento de schema.

/** SQLSTATE 42703 — undefined_column. */
const PG_UNDEFINED_COLUMN = '42703';
/** SQLSTATE 42P01 — undefined_table. */
const PG_UNDEFINED_TABLE = '42P01';

/**
 * Codigo de erro de fio (wire) para desalinhamento entre o codigo e o schema do banco conectado.
 * Espelha ErrorCode.SCHEMA_OUT_OF_DATE (catalogo canonico em ./error-codes).
 */
export const SCHEMA_OUT_OF_DATE_CODE = 'SCHEMA_OUT_OF_DATE';

/** Que tipo de objeto de schema o Postgres declarou ausente. */
export type MissingSchemaObjectKind = 'column' | 'table';

export interface SchemaOutOfDateDescriptor {
  /** 503: a requisicao esta correta; a INSTALACAO conectada e que nao atende esta funcionalidade. */
  httpStatus: 503;
  code: typeof SCHEMA_OUT_OF_DATE_CODE;
  /** Mensagem pronta para o operador humano (PT-BR). */
  message: string;
  details: {
    /** SQLSTATE cru devolvido pelo Postgres. */
    pg_code: string;
    missing_kind: MissingSchemaObjectKind;
    /** Identificador ausente, quando o Postgres o expos. `null` quando nao foi possivel extrair. */
    missing_object: string | null;
    /** Mensagem original do Postgres (ja e texto de servidor, nao de usuario final). */
    pg_message: string | null;
  };
}

/**
 * Extrai o identificador entre aspas duplas da mensagem do Postgres.
 * O Postgres nao preenche os campos estruturados `column`/`table` para 42703/42P01 (esses campos
 * existem para violacao de constraint), entao o identificador so aparece dentro da mensagem —
 * em qualquer idioma do servidor: `column "x" does not exist` / `coluna "x" nao existe`.
 * Se nada casar, devolve null (preferimos omitir a afirmar errado).
 */
function extractQuotedIdentifier(message: string | null): string | null {
  if (!message) return null;
  const match = /"([^"]+)"/.exec(message);
  return match ? match[1] : null;
}

function readStringField(source: Record<string, unknown>, key: string): string | null {
  const raw = source[key];
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/**
 * Detecta erro ESTRUTURAL de schema do Postgres e descreve a resposta honesta correspondente.
 *
 * NARROW por construcao: reconhece SOMENTE 42703 (undefined_column) e 42P01 (undefined_table).
 * Qualquer outro erro devolve `null` — o chamador segue com o tratamento que ja tinha.
 *
 * @returns descritor pronto para virar resposta HTTP, ou `null` se nao for erro de schema.
 */
export function describePostgresSchemaError(
  error: unknown
): SchemaOutOfDateDescriptor | null {
  if (error === null || typeof error !== 'object') return null;

  const candidate = error as Record<string, unknown>;
  const pgCode = readStringField(candidate, 'code');
  if (pgCode !== PG_UNDEFINED_COLUMN && pgCode !== PG_UNDEFINED_TABLE) return null;

  const missingKind: MissingSchemaObjectKind =
    pgCode === PG_UNDEFINED_COLUMN ? 'column' : 'table';

  const pgMessage = readStringField(candidate, 'message');
  // Campos estruturados primeiro (quando o driver os preencher); mensagem como fonte secundaria.
  const structured =
    missingKind === 'column'
      ? readStringField(candidate, 'column')
      : readStringField(candidate, 'table');
  const missingObject = structured ?? extractQuotedIdentifier(pgMessage);

  const detailLabel = missingObject
    ? `${missingKind === 'column' ? 'coluna' : 'tabela'} "${missingObject}"`
    : `${missingKind === 'column' ? 'coluna' : 'tabela'} nao identificada (SQLSTATE ${pgCode})`;

  return {
    httpStatus: 503,
    code: SCHEMA_OUT_OF_DATE_CODE,
    message:
      `SCHEMA_OUT_OF_DATE: o banco conectado nao tem as migrations desta funcionalidade ` +
      `(coluna/tabela ausente: ${detailLabel}). ` +
      `Rode as migrations ou aponte o backend para o banco correto.`,
    details: {
      pg_code: pgCode,
      missing_kind: missingKind,
      missing_object: missingObject,
      pg_message: pgMessage,
    },
  };
}
