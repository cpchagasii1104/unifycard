// frontend/src/components/NotApplicableMessage.tsx
// FIX 2.c — Defesa em profundidade para Profile sub-componentes (DECISION-0043 pendente).
//
// Razão: se algum bug futuro (race condition, hot reload, navegação direta via URL)
// fizer Profile renderizar com actor=page apesar do guard em Profile.tsx, sub-componentes
// não vazam dados PF.
//
// Princípios invocados:
// - #4: campos não aplicáveis por actor_type são comportamento esperado
// - #5: frontend NÃO mascara ausência contextual com fallback implícito
//
// Componente visual puro: zero fetch, zero useEffect, zero lookup.

import type { AvailableActor } from "../api/social";

interface NotApplicableMessageProps {
  actor: AvailableActor | null | undefined;
  tab: string;
}

function actorLabel(actor: AvailableActor | null | undefined): string {
  if (!actor) return "este contexto";
  switch (actor.actor_type) {
    case "page": return "perfil de empresa";
    case "group": return "grupo";
    case "channel": return "canal";
    default: return actor.actor_type;
  }
}

export default function NotApplicableMessage({ actor, tab }: NotApplicableMessageProps) {
  return (
    <div
      style={{
        padding: "2rem",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        margin: "1rem 0",
        textAlign: "center",
        color: "#6b7280",
      }}
    >
      <p style={{ fontSize: "1rem", marginBottom: "0.5rem", fontWeight: 500 }}>
        Esta seção ({tab}) não é aplicável a {actorLabel(actor)}.
      </p>
      <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
        Troque para o seu perfil pessoal para acessar este conteúdo.
      </p>
    </div>
  );
}
