// frontend/src/components/composer/audience-icon-palette.ts
// PALETA DE APRESENTAÇÃO (Clayton 2026-07-07: "pastel = reconhecimento, índigo = decisão").
// ⚠️ ISTO É DECORAÇÃO PURA — cor/ícone NUNCA entra em payload, lógica, permissão ou define
// público/privado. A verdade (quais opções existem) vem SEMPRE de /audience-options. Se uma opção
// vier do backend sem entrada aqui, o fallback é um ícone/cor NEUTRO — nunca inventar opção local.
export interface AudienceVisual { icon: string; bg: string; fg: string; }

const PALETTE: Record<string, AudienceVisual> = {
  public: { icon: '🌐', bg: '#e0f2fe', fg: '#0369a1' },
  connections: { icon: '🔗', bg: '#ede9fe', fg: '#6d28d9' },
  amigo: { icon: '👥', bg: '#dcfce7', fg: '#15803d' },
  conhecido: { icon: '😊', bg: '#fef3c7', fg: '#b45309' },
  familiar: { icon: '🏠', bg: '#ffe4e6', fg: '#be123c' },
  cliente: { icon: '🛒', bg: '#d1fae5', fg: '#047857' },
  colaborador: { icon: '🧑‍💼', bg: '#e0e7ff', fg: '#4338ca' },
  fornecedor: { icon: '📦', bg: '#fce7f3', fg: '#a21caf' },
  parceiro: { icon: '🤝', bg: '#e0e7ff', fg: '#4338ca' },
  only_me: { icon: '🔒', bg: '#f1f5f9', fg: '#475569' },
};

const NEUTRAL: AudienceVisual = { icon: '•', bg: '#eef1ff', fg: '#4f46e5' };

/** Visual de uma opção. Preferência: a key da opção; depois o 1º label típado (audienceType);
 *  fallback = neutro. Se o backend já mandou opt.icon, ele vence (backend > paleta local). */
export function audienceVisual(key: string, audienceType?: string | null, backendIcon?: string): AudienceVisual {
  const base = PALETTE[key] ?? (audienceType ? PALETTE[audienceType] : undefined) ?? NEUTRAL;
  return backendIcon ? { ...base, icon: backendIcon } : base;
}
