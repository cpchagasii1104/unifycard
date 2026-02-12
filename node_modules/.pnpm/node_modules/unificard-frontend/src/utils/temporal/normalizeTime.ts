// frontend/src/utils/temporal/normalizeTime.ts
// Normalização inteligente de valores de tempo
// Extraído da lógica canônica da Agenda Universal (AvailabilityScheduleEnhanced)
// ⚠️ REGRA CANÔNICA: Mesma lógica em todo o sistema para consistência UX

/**
 * Normaliza um valor de entrada de tempo para formato HH:MM
 * Suporta múltiplos formatos de entrada para melhor UX:
 * 
 * - HHMM ou HMM (2359 → 23:59, 903 → 09:03)
 * - HH:-- → HH:00
 * - H:M → minuto como dezena humana (7:3 → 07:30)
 * - HH:MM padrão
 * - Apenas hora (7 → 07:00)
 * 
 * @param value - Valor de entrada (string)
 * @returns Valor normalizado em formato HH:MM ou null se inválido
 */
export function normalizeTimeValue(value: string): string | null {
  if (!value || value.trim() === '') return null;

  const v = value.trim();

  // Draft explícito
  if (v === '--:--') return null;

  // ─────────────────────────────────────────
  // 1️⃣ HHMM ou HMM (teclado numérico direto)
  // 2359 → 23:59
  // 1203 → 12:03
  // 903  → 09:03
  // ─────────────────────────────────────────
  if (/^\d{3,4}$/.test(v)) {
    const padded = v.padStart(4, '0');
    const h = Number(padded.slice(0, 2));
    const m = Number(padded.slice(2));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }

  // ─────────────────────────────────────────
  // 2️⃣ HH:--  → HH:00
  // ─────────────────────────────────────────
  const hhDash = v.match(/^([01]?\d|2[0-3]):--$/);
  if (hhDash) {
    return `${hhDash[1].padStart(2, '0')}:00`;
  }

  // ─────────────────────────────────────────
  // 3️⃣ H:M  → minuto como dezena humana
  // 7:3 → 07:30
  // 9:5 → 09:50
  // ─────────────────────────────────────────
  const humanMinute = v.match(/^([01]?\d|2[0-3]):([0-5])$/);
  if (humanMinute) {
    const h = Number(humanMinute[1]);
    const m = Number(humanMinute[2]) * 10;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ─────────────────────────────────────────
  // 4️⃣ HH:MM padrão
  // ─────────────────────────────────────────
  const full = v.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (full) {
    return `${full[1].padStart(2, '0')}:${full[2]}`;
  }

  // ─────────────────────────────────────────
  // 5️⃣ Apenas hora
  // 7 → 07:00
  // 23 → 23:00
  // ─────────────────────────────────────────
  const hourOnly = v.match(/^([01]?\d|2[0-3])$/);
  if (hourOnly) {
    return `${hourOnly[1].padStart(2, '0')}:00`;
  }

  return null;
}

