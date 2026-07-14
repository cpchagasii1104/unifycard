// backend/src/modules/bank/regional-fund-city-activation.ts
// B-CITY-1 (DECISION-0177 D7) — ATIVAÇÃO TERRITORIAL Curitiba-only do fundo municipal.
//
// O piloto Bank City aceita EXCLUSIVAMENTE o city_id canônico de Curitiba. A constante é
// SERVER-SIDE e literal: PROIBIDO env, nome textual ("Curitiba"), lista configurável,
// "qualquer cidade com mapping" ou "qualquer cidade com residência". `regional_level='city'`
// numa policy NÃO significa todas as cidades — significa SÓ as ativadas aqui (hoje: uma).
// Schema genérico (regional_fund_accounts multi-nível) permanece intacto; ativação de outra
// cidade = nova decisão soberana (DECISION-0175 nacional permanece trancada).

/** city_id canônico de Curitiba (Location Core). Única cidade habilitada no piloto. */
export const BANK_CITY_ENABLED_CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';

/** A cidade está habilitada para o fundo municipal? (Curitiba-only; comparação por UUID exato.) */
export function isRegionalFundCityEnabled(cityId: string | null | undefined): boolean {
  return cityId === BANK_CITY_ENABLED_CITY_ID;
}
