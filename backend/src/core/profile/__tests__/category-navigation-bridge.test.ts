import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { Pool } from 'pg';
import {
  assertStoredProfileCategoryIdsStrict,
  assertWritePayloadCategoryIdsOnly,
  requireCategoriesWithConceptForScope,
  enrichCategoryNavigationByIds,
} from '../category-navigation-bridge';
import { HttpError } from '../../errors/http-error';

const VALID = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

describe('category-navigation-bridge (modo estrito)', () => {
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('assertStoredProfileCategoryIdsStrict aceita array vazio ou ausente', () => {
    expect(assertStoredProfileCategoryIdsStrict(undefined, 'learnings')).toEqual([]);
    expect(assertStoredProfileCategoryIdsStrict(null, 'learnings')).toEqual([]);
    expect(assertStoredProfileCategoryIdsStrict([], 'interests')).toEqual([]);
  });

  it('assertStoredProfileCategoryIdsStrict aceita só UUID strings', () => {
    expect(assertStoredProfileCategoryIdsStrict([VALID], 'learnings')).toEqual([VALID]);
  });

  it('assertStoredProfileCategoryIdsStrict rejeita objeto legado (categoryName/path)', () => {
    expect(() =>
      assertStoredProfileCategoryIdsStrict([{ categoryId: VALID, categoryName: 'X' }], 'learnings'),
    ).toThrow(HttpError);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('assertStoredProfileCategoryIdsStrict rejeita objeto só com nome', () => {
    expect(() => assertStoredProfileCategoryIdsStrict([{ categoryName: 'só nome' }], 'interests')).toThrow(
      HttpError,
    );
  });

  it('assertWritePayloadCategoryIdsOnly rejeita objeto (HARD)', () => {
    expect(() =>
      assertWritePayloadCategoryIdsOnly([{ categoryId: 'x' }] as unknown as string[], 'learnings'),
    ).toThrow(HttpError);
  });

  it('assertWritePayloadCategoryIdsOnly rejeita string não-UUID', () => {
    expect(() => assertWritePayloadCategoryIdsOnly(['não-uuid'], 'interests')).toThrow(HttpError);
  });

  it('requireCategoriesWithConceptForScope falha se faltar linha (HARD)', async () => {
    const mockQuery = jest.fn() as any;
    mockQuery.mockResolvedValue({ rows: [] });
    const pool = { query: mockQuery } as unknown as Pool;
    await expect(
      requireCategoriesWithConceptForScope(pool, [VALID], 'interest'),
    ).rejects.toThrow(HttpError);
  });

  it('requireCategoriesWithConceptForScope falha se concept_id NULL (HARD)', async () => {
    const mockQuery = jest.fn() as any;
    mockQuery.mockResolvedValue({
      rows: [{ category_id: VALID, concept_id: null }],
    });
    const pool = { query: mockQuery } as unknown as Pool;
    await expect(requireCategoriesWithConceptForScope(pool, [VALID], 'learning')).rejects.toThrow(
      HttpError,
    );
  });

  it('enrichCategoryNavigationByIds falha se category sem concept_id', async () => {
    const mockQuery = jest.fn() as any;
    mockQuery.mockResolvedValue({
      rows: [
        {
          category_id: VALID,
          name: 'N',
          path: [],
          level: 1,
          concept_id: null,
        },
      ],
    });
    const pool = { query: mockQuery } as unknown as Pool;
    await expect(enrichCategoryNavigationByIds(pool, [VALID], 'learning')).rejects.toThrow(HttpError);
  });

  it('enrichCategoryNavigationByIds falha se id em falta no resultado', async () => {
    const mockQuery = jest.fn() as any;
    mockQuery.mockResolvedValue({ rows: [] });
    const pool = { query: mockQuery } as unknown as Pool;
    await expect(enrichCategoryNavigationByIds(pool, [VALID], 'interest')).rejects.toThrow(HttpError);
  });
});
