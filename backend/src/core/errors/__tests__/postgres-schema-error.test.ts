// src/core/errors/__tests__/postgres-schema-error.test.ts
//
// Prova o contrato do tradutor de erro ESTRUTURAL de schema (42703/42P01).
// Reproduz o INCIDENTE REAL: backend apontado para um banco sem as migrations da funcionalidade
// devolvia "Failed to update event" em vez de dizer qual coluna faltava.
//
// Teste PURO: monta objetos com o formato do erro do driver pg (nao cria erro real no banco,
// nao toca caminho de producao).

import {
  describePostgresSchemaError,
  SCHEMA_OUT_OF_DATE_CODE,
} from '../postgres-schema-error';

/** Reproduz o formato do erro que o driver pg entrega (campos relevantes). */
function pgError(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

describe('describePostgresSchemaError', () => {
  describe('42703 — undefined_column (o erro do incidente)', () => {
    it('traduz a mensagem PT-BR do Postgres em resposta honesta com a coluna ausente', () => {
      const result = describePostgresSchemaError(
        pgError('42703', 'coluna "funding_deadline_at" não existe')
      );

      expect(result).not.toBeNull();
      expect(result!.httpStatus).toBe(503);
      expect(result!.code).toBe(SCHEMA_OUT_OF_DATE_CODE);
      expect(result!.code).toBe('SCHEMA_OUT_OF_DATE');
      expect(result!.details.pg_code).toBe('42703');
      expect(result!.details.missing_kind).toBe('column');
      expect(result!.details.missing_object).toBe('funding_deadline_at');
    });

    it('a mensagem NAO e generica: nomeia o objeto ausente e as duas saidas', () => {
      const result = describePostgresSchemaError(
        pgError('42703', 'coluna "funding_deadline_at" não existe')
      );

      expect(result!.message).toContain('SCHEMA_OUT_OF_DATE');
      expect(result!.message).toContain('funding_deadline_at');
      expect(result!.message).toContain('migrations');
      expect(result!.message).toContain('banco correto');
      // Limite de honestidade: nao afirma QUAL banco e o certo.
      expect(result!.message).not.toContain('unificard_local');
      expect(result!.message).not.toContain('unificard_dev');
    });

    it('extrai o identificador tambem da mensagem em ingles', () => {
      const result = describePostgresSchemaError(
        pgError('42703', 'column "funding_deadline_at" does not exist')
      );

      expect(result!.details.missing_object).toBe('funding_deadline_at');
    });

    it('prefere o campo estruturado `column` quando o driver o preenche', () => {
      const err = pgError('42703', 'coluna "x" não existe') as Error & {
        code: string;
        column?: string;
      };
      err.column = 'coluna_estruturada';

      const result = describePostgresSchemaError(err);

      expect(result!.details.missing_object).toBe('coluna_estruturada');
    });
  });

  describe('42P01 — undefined_table', () => {
    it('traduz tabela ausente e classifica missing_kind como table', () => {
      const result = describePostgresSchemaError(
        pgError('42P01', 'relação "event_sectors" não existe')
      );

      expect(result).not.toBeNull();
      expect(result!.httpStatus).toBe(503);
      expect(result!.details.pg_code).toBe('42P01');
      expect(result!.details.missing_kind).toBe('table');
      expect(result!.details.missing_object).toBe('event_sectors');
      expect(result!.message).toContain('event_sectors');
    });
  });

  describe('honestidade quando o identificador nao aparece', () => {
    it('nao inventa nome: missing_object fica null e a mensagem admite o limite', () => {
      const result = describePostgresSchemaError(
        pgError('42703', 'undefined column in query')
      );

      expect(result).not.toBeNull();
      expect(result!.details.missing_object).toBeNull();
      expect(result!.message).toContain('nao identificada');
      expect(result!.message).toContain('42703');
    });
  });

  describe('NARROW por construcao — nao sequestra outros erros', () => {
    it.each([
      ['23505', 'duplicate key violates unique constraint'],
      ['23503', 'insert violates foreign key constraint'],
      ['42501', 'permission denied for table events'],
      ['08006', 'connection failure'],
    ])('devolve null para SQLSTATE %s', (code, message) => {
      expect(describePostgresSchemaError(pgError(code, message))).toBeNull();
    });

    it('devolve null para erro de aplicacao comum (sem code)', () => {
      expect(describePostgresSchemaError(new Error('Evento não encontrado'))).toBeNull();
    });

    it('devolve null para null, undefined e primitivos', () => {
      expect(describePostgresSchemaError(null)).toBeNull();
      expect(describePostgresSchemaError(undefined)).toBeNull();
      expect(describePostgresSchemaError('42703')).toBeNull();
      expect(describePostgresSchemaError(42703)).toBeNull();
    });
  });
});
