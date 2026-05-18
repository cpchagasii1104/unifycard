// backend/src/core/profile-inference/profile-inference.types.ts
// 2026-05-18 P2 — Profile Inference MVP (interesses inferidos)
//
// Tipos para agregação READ-ONLY de afinidades derivadas de comportamento
// material (event_attendees + events + group_members + groups). Implementa
// camada 2 (Inferido derivado) do modelo de perfil descrito na memória
// project_home_contextual_modelo_2026-05-18.md (§C).
//
// V1 cobre 2 sinais: afinidade por tipo de evento + comunidades (grupos
// ativos). Outros sinais (rede de confiança econômica, ritmo diário,
// região operacional, categorias de marketplace) entram conforme uso
// real puxar — sem inflar.
//
// PRINCÍPIO operacional:
//   - Profile NÃO possui verdade própria — projeta agregação de SSOT
//   - Frontend pode mostrar para usuário VALIDAR ("isso é você?"),
//     mas NUNCA decide com base nisso sem confirmação backend em fluxo crítico

/** Afinidade por tipo de evento — quantas vezes actor compareceu a eventos de cada tipo. */
export interface EventTypeAffinity {
  /** event_type canônico (string livre — vocabulário do projeto). */
  eventType: string;
  /** event_subtype opcional. */
  eventSubtype: string | null;
  /** Quantidade de eventos atendidos desse tipo. */
  attendanceCount: number;
  /** Data do último atendimento (ISO). */
  lastAttendanceAt: string;
}

/** Comunidade — grupo ativo onde actor é membro. */
export interface CommunityMembership {
  /** ID do grupo. */
  groupId: string;
  /** Nome do grupo. */
  groupName: string;
  /** Papel no grupo (member / admin / owner / etc.). */
  role: string;
  /** Quando virou membro. */
  joinedAt: string;
}

export interface InferredProfileResponse {
  actorId: string;
  /** Afinidades por tipo de evento (ordenadas por attendanceCount DESC). */
  eventTypeAffinities: EventTypeAffinity[];
  /** Comunidades onde actor é membro ativo. */
  communities: CommunityMembership[];
  /** Janela observada em dias para event affinities. */
  windowDaysEvents: number;
  resolvedAt: string;
  source: 'mvp-events-and-communities';
}
