// frontend/src/components/layout/OperatingModeToggle.tsx
// 2026-05-16: pill toggle no header para o modo operante (Consumir/Operar).
//
// Diretriz Clayton (memory project_modo_operante.md):
//   "Modo operante prioriza, não esconde. Mantém transparência transversal
//    do ecossistema."
//
// Aparece APENAS quando o actor atual tem 2 modos (consumir + operar).
// Para group/channel (mono-modo) o toggle não renderiza nada — silencioso.

import { useActorMode } from '../../hooks/useActorMode';
import { useOperatingMode } from '../../hooks/useOperatingMode';
import { profileHasTwoOperatingModes } from '../../config/actorContextConfig';
import './OperatingModeToggle.css';

export default function OperatingModeToggle() {
  const { profile, hasActor } = useActorMode();
  const { mode, setMode } = useOperatingMode();

  if (!hasActor) return null;
  if (!profileHasTwoOperatingModes(profile)) return null;

  return (
    <div className="om-toggle" role="group" aria-label="Modo operante">
      <button
        type="button"
        className={`om-toggle-option ${mode === 'consumir' ? 'om-active' : 'om-inactive'}`}
        onClick={() => setMode('consumir')}
        aria-pressed={mode === 'consumir'}
        title="Consumir — o que você quer fazer agora como consumidor"
      >
        <span className="om-toggle-icon" aria-hidden="true">🛒</span>
        <span className="om-toggle-label">Consumir</span>
      </button>
      <button
        type="button"
        className={`om-toggle-option ${mode === 'operar' ? 'om-active' : 'om-inactive'}`}
        onClick={() => setMode('operar')}
        aria-pressed={mode === 'operar'}
        title="Operar — o que você quer fazer agora como trabalho/operação"
      >
        <span className="om-toggle-icon" aria-hidden="true">💼</span>
        <span className="om-toggle-label">Operar</span>
      </button>
    </div>
  );
}
