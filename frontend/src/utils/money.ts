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

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ENTRADA DO USUÁRIO → CENTAVOS (o caminho que faltava neste arquivo)
//
// 🔴 O DEFEITO QUE ORIGINOU ISTO (achado por Clayton, 2026-08-03): ele perguntou se digitar "50"
// virava cinquenta reais "e se isto está certo na relação de valores dentro do bank". NÃO estava.
// Este arquivo só cobria centavos→exibição, então cada tela improvisou a sua conversão de ENTRADA,
// e as duas divergiam no MESMO fluxo de criação de evento:
//
//   EventCreationGuidedFlow:294  parseFloat("1.500".replace(',','.')) = 1.5
//     digita 1.500  →  150 cents  =  R$ 1,50                    ❌ 1000× MENOS
//   SectorBuilder (local)        "50.00" → remove pontos → "5000"
//     digita 50.00  →  500.000 cents = R$ 5.000,00              ❌ 100× MAIS
//
// Hoje é valor ANUNCIADO (Δbank=0) — mas é a classe de defeito que suma com zeros quando o Bank
// ligar. ⚠️ NÃO escrever parseFloat/replace de dinheiro solto em componente: use estas funções.
//
// REGRA (pt-BR, com a ambiguidade resolvida À VISTA em vez de adivinhada):
// vírgula é SEMPRE decimal; ponto é milhar — EXCETO se for o único ponto, sem vírgula, com 1–2
// dígitos depois ("50.00", "1.50"): aí o usuário quis decimal no formato americano. Com 3 dígitos
// ("1.500") segue sendo milhar. É heurística ASSUMIDA e testada, não silenciosa.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** "50" · "50,00" · "1.500" · "1.500,50" · "50.00" · "R$ 50" → centavos inteiros. null se inválido. */
export function reaisToCents(input: string): number | null {
  const raw = input.trim().replace(/^R\$/i, '').replace(/\s/g, '');
  if (!raw || !/^[\d.,]+$/.test(raw)) return null;

  let normalized: string;
  if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = raw.split('.');
    const isDecimalDot = parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2;
    normalized = isDecimalDot ? raw : raw.replace(/\./g, '');
  }

  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  // Arredonda no CENTAVO: float não fecha soma decimal, e dinheiro não tolera resíduo.
  return Math.round(n * 100);
}

/** Centavos → "1.500,50" (sem prefixo; quem exibe decide se põe "R$"). */
export function centsToReaisString(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const milhar = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}${milhar},${(abs % 100).toString().padStart(2, '0')}`;
}

/**
 * Normaliza o que foi digitado, para uso no onBlur do campo: "50" → "50,00".
 * Entrada inválida VOLTA COMO VEIO — não apagamos o que a pessoa escreveu; ela precisa ver para
 * corrigir. Apagar seria o sistema decidir por ela e esconder o erro.
 */
export function formatReaisOnBlur(input: string): string {
  const cents = reaisToCents(input);
  return cents == null ? input : centsToReaisString(cents);
}
