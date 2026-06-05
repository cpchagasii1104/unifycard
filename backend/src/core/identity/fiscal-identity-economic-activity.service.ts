/**
 * F-PJ-CNAE-EVIDENCE-WRITER (DECISION-0103 D2/D3/D7/D8): persiste CNAE/atividade econômica como
 * EVIDÊNCIA fiscal auditável da PJ, ancorada em `fiscal_identities` (casa fiscal) via a satélite
 * `fiscal_identity_economic_activities` (migration 20260604150000).
 *
 * CNAE é EVIDÊNCIA, NÃO identidade semântica: não substitui CONCEPT nem o par
 * (primary_company_type_id, primary_concept_id) e NÃO autoriza publicação/domínio por si só (D1/D10/D11).
 * NÃO persiste QSA/sócios/CPF/payload bruto (LGPD, D5). `source`/`fetched_at` obrigatórios (D7).
 * 1 principal + N secundários (D3). Idempotente: ON CONFLICT (fiscal_identity_id, cnae_code).
 * NÃO faz fetch externo (recebe o resultado de companiesService.fetchCNPJFromRevenue), NÃO mapeia
 * CNAE→concept, NÃO deriva elegibilidade, NÃO toca companies/Bank/marketplace/publication/KYB.
 */
import { pool } from '@core/database/pool';

/** Atividade no shape do provider (ReceitaWS/BrasilAPI): `code`+`text`. */
export interface RevenueActivity {
  code: string;
  text: string;
}

export interface PersistEconomicActivitiesInput {
  fiscalIdentityId: string;
  /** Atividade(s) principal(is) do provider. O 1º vira `is_primary`; demais viram secundários. */
  atividadePrincipal?: RevenueActivity[] | null;
  /** Atividades secundárias do provider. */
  atividadesSecundarias?: RevenueActivity[] | null;
  /** Provider/origem da evidência (obrigatório, D7). Ex.: 'receita_federal'. */
  source: string;
  /** Quando a evidência foi obtida do provider fiscal (obrigatório, D7). */
  fetchedAt: Date;
}

export interface FiscalEconomicActivity {
  cnaeCode: string;
  cnaeDescription: string;
  isPrimary: boolean;
  source: string;
  fetchedAt: string;
}

class FiscalIdentityEconomicActivityService {
  /**
   * persistEconomicActivities: grava a evidência CNAE de uma identidade fiscal (idempotente).
   *
   * Normaliza o retorno do provider → lista canônica: o 1º CNAE principal vira `is_primary=true`
   * (no máx. um, garantido por `uq_fiea_one_primary`); principais excedentes e secundários viram
   * `is_primary=false`. Dedup por `cnae_code` (primeira ocorrência vence; principal precede secundário).
   * Entradas com code/description vazios são DESCARTADAS (não satisfazem os CHECKs; fail-open silencioso).
   * NÃO deleta CNAEs ausentes (reconciliation/refresh é frente futura).
   */
  async persistEconomicActivities(
    input: PersistEconomicActivitiesInput
  ): Promise<{ persisted: number; primaryCode: string | null }> {
    const { fiscalIdentityId, source, fetchedAt } = input;
    if (!fiscalIdentityId || typeof fiscalIdentityId !== 'string') {
      throw new Error('persistEconomicActivities: fiscalIdentityId é obrigatório');
    }
    if (!source || typeof source !== 'string' || source.trim() === '') {
      throw new Error('persistEconomicActivities: source é obrigatório (DECISION-0103 D7)');
    }
    if (!(fetchedAt instanceof Date) || Number.isNaN(fetchedAt.getTime())) {
      throw new Error('persistEconomicActivities: fetchedAt (Date válido) é obrigatório (DECISION-0103 D7)');
    }

    // ── Normalização provider → lista canônica (dedup por cnae_code; 1 primary no máx.) ──
    const seen = new Set<string>();
    const rows: Array<{ code: string; description: string; isPrimary: boolean }> = [];
    let primaryAssigned = false;
    const pushActivity = (a: RevenueActivity | null | undefined, wantPrimary: boolean): void => {
      const code = (a?.code ?? '').toString().trim();
      const description = (a?.text ?? '').toString().trim();
      if (!code || !description) return;     // CHECK exige não-vazios → descarta evidência malformada
      if (seen.has(code)) return;            // dedup: nunca duplicar o mesmo CNAE na mesma identidade
      const isPrimary = wantPrimary && !primaryAssigned;
      if (isPrimary) primaryAssigned = true;
      seen.add(code);
      rows.push({ code, description, isPrimary });
    };
    const principals = (input.atividadePrincipal ?? []).filter(Boolean);
    const secondaries = (input.atividadesSecundarias ?? []).filter(Boolean);
    principals.forEach((a, i) => pushActivity(a, i === 0)); // 1º principal = primary; demais = secundários
    secondaries.forEach((a) => pushActivity(a, false));

    if (rows.length === 0) return { persisted: 0, primaryCode: null };

    // Âncora fiscal explícita (FK também garante; aqui dá erro de domínio claro).
    const fi = await pool.query<{ x: number }>(
      `SELECT 1 AS x FROM fiscal_identities WHERE fiscal_identity_id = $1::uuid LIMIT 1`,
      [fiscalIdentityId]
    );
    if (fi.rows.length === 0) {
      throw new Error(`FISCAL_IDENTITY_NOT_FOUND: identidade fiscal ${fiscalIdentityId} não existe.`);
    }

    let persisted = 0;
    let primaryCode: string | null = null;
    for (const r of rows) {
      // Idempotente: ON CONFLICT (fiscal_identity_id, cnae_code) atualiza a evidência (D7/D8).
      await pool.query(
        `INSERT INTO fiscal_identity_economic_activities
           (fiscal_identity_id, cnae_code, cnae_description, is_primary, source, fetched_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6)
         ON CONFLICT (fiscal_identity_id, cnae_code) DO UPDATE
           SET cnae_description = EXCLUDED.cnae_description,
               is_primary       = EXCLUDED.is_primary,
               source           = EXCLUDED.source,
               fetched_at       = EXCLUDED.fetched_at,
               updated_at       = now()`,
        [fiscalIdentityId, r.code, r.description, r.isPrimary, source, fetchedAt]
      );
      persisted++;
      if (r.isPrimary) primaryCode = r.code;
    }
    return { persisted, primaryCode };
  }

  /**
   * listEconomicActivities: lê a evidência CNAE de uma identidade fiscal (principal primeiro).
   */
  async listEconomicActivities(fiscalIdentityId: string): Promise<FiscalEconomicActivity[]> {
    if (!fiscalIdentityId || typeof fiscalIdentityId !== 'string') {
      throw new Error('listEconomicActivities: fiscalIdentityId é obrigatório');
    }
    const rows = await pool.query(
      `SELECT cnae_code, cnae_description, is_primary, source, fetched_at
         FROM fiscal_identity_economic_activities
        WHERE fiscal_identity_id = $1::uuid
        ORDER BY is_primary DESC, cnae_code ASC`,
      [fiscalIdentityId]
    );
    return rows.rows.map((r: any) => ({
      cnaeCode: r.cnae_code,
      cnaeDescription: r.cnae_description,
      isPrimary: r.is_primary === true,
      source: r.source,
      fetchedAt: r.fetched_at ? new Date(r.fetched_at).toISOString() : '',
    }));
  }
}

export const fiscalIdentityEconomicActivityService = new FiscalIdentityEconomicActivityService();
