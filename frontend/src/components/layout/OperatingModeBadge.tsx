// frontend/src/components/layout/OperatingModeBadge.tsx
// 2026-05-18: badge discreto persistente do modo operante (RC6 da auditoria
// contextual). Sinaliza ao usuário em qualquer página em qual modo está
// operando, complementando o OperatingModeToggle (que é o controle).
//
// Princípio âncora: "prioriza, não esconde" + "modo nunca invisível".
//
// Aparece APENAS quando o actor tem 2 modos (consumir + operar).
// Para group/channel (mono-modo) não renderiza nada — silencioso.

import { useActorMode } from '../../hooks/useActorMode';
import { useOperatingMode } from '../../hooks/useOperatingMode';
import { profileHasTwoOperatingModes } from '../../config/actorContextConfig';
import './OperatingModeBadge.css';

export default function OperatingModeBadge() {
  const { profile, hasActor } = useActorMode();
  const { mode } = useOperatingMode();

  if (!hasActor) return null;
  if (!profileHasTwoOperatingModes(profile)) return null;

  const label = mode === 'operar' ? 'Operando' : 'Consumindo';
  const icon = mode === 'operar' ? '💼' : '🛒';

  return (
    <span
      className={`om-badge ${mode === 'operar' ? 'om-badge--operar' : 'om-badge--consumir'}`}
      role="status"
      aria-label={`Modo atual: ${label}`}
      title={`Você está no modo ${label}`}
    >
      <span className="om-badge-icon" aria-hidden="true">{icon}</span>
      <span className="om-badge-label">{label}</span>
    </span>
  );
}
