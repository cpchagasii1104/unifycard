/**
 * Sugestões de matching canónico (GTIN exato, fase 1).
 * SSOT de schema: migrations 20260406120000 / 20260406130000 (ver backend/README.md).
 */
import { HttpError } from '@core/errors/http-error';

export const canonicalMatchSuggestionService = {
  async recordGtinExactSuggestion(
    _tenantId: string,
    _input: { inputGtin: string; inputName?: string | null }
  ): Promise<{ suggestionId: string; matchType: string; status: string }> {
    throw HttpError.badRequest(
      'Persistência de match-suggestions requer migrations 20260406120000_canonical_match_suggestions.sql e 20260406130000_canonical_match_suggestions_hardening.sql (README).'
    );
  },

  async listRecent(_tenantId: string, _limit: number): Promise<readonly unknown[]> {
    return [];
  },
};