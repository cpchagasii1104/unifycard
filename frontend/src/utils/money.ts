// frontend/src/utils/money.ts
//
// Conversão e formatação monetária canônica para o frontend.
//
// Conformidade §4.7 (07_NOMENCLATURA_CANONICA): toda persistência e contrato
// de API usa centavos (BIGINT no banco; number em TS) com sufixo `_cents`.
// O frontend converte para reais APENAS na camada de exibição.
//
// Regra: nunca exibir centavos diretamente em formatCurrency — sempre passar
// por `centsToReais` antes para evitar bug de unidade (saldo 100x maior).

/**
 * Converte centavos para reais (unidade de exibição).
 *
 * @param cents valor em centavos (BIGINT/number, conforme §4.7)
 * @returns valor em reais (number)
 *
 * @example
 *   centsToReais(100000) // 1000  (R$ 1.000,00)
 *   centsToReais(0)      // 0
 *   centsToReais(99)     // 0.99
 */
export function centsToReais(cents: number | bigint): number {
  return Number(cents) / 100;
}

/**
 * Formata centavos diretamente como string monetária BRL.
 * Conveniência: aplica `centsToReais` + `Intl.NumberFormat` em um passo.
 *
 * @param cents valor em centavos
 * @returns string formatada como "R$ 1.234,56"
 *
 * @example
 *   formatCentsAsBRL(123456) // "R$ 1.234,56"
 *   formatCentsAsBRL(0)      // "R$ 0,00"
 */
export function formatCentsAsBRL(cents: number | bigint): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centsToReais(cents));
}
