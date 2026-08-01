// frontend/src/components/layout/OperatingModeToggle.tsx
// 2026-05-16: pill toggle no header para o modo operante (Consumir/Operar).
//
// Diretriz Clayton (memory project_modo_operante.md):
//   "Modo operante prioriza, não esconde. Mantém transparência transversal
//    do ecossistema."
//
// Aparece APENAS quando o actor atual tem 2 modos (consumir + operar).
// Para CHANNEL (mono-modo) o toggle não renderiza nada — silencioso.
// ⚠️ GROUP **NÃO** é mono-modo desde 2026-07-07: PROFILE_GROUP ganhou byOperatingMode com as DUAS
// chaves (achado de Clayton — "o churrasco compra a carne"), logo profileHasTwoOperatingModes()
// devolve true e o toggle RENDERIZA para grupo. Este comentário dizia o contrário até 2026-08-01.
// Quem decide é sempre profileHasTwoOperatingModes(), nunca uma lista de actor_type escrita aqui.

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
