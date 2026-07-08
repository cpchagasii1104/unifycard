// frontend/src/components/composer/AudienceOptionCard.tsx
// O card de uma plateia. A TRAVA DE DESIGN de Clayton vive aqui:
//   • pastel (bolha do ícone) = RECONHECIMENTO visual — decoração pura.
//   • índigo (borda + fundo + halo + indicador) = DECISÃO — padrão ÚNICO de seleção.
// Exclusiva (public/connections/only_me) usa indicador de RADIO; combinável (relação típada) usa
// CHECK — derivado do shape (audienceRelationshipTypes === null), nunca de lista local.
import type { AudienceOption } from '../../api/audience';
import { audienceVisual } from './audience-icon-palette';
import { isExclusive } from './audience-payload';
import './AudienceOptionCard.css';

export default function AudienceOptionCard({ option, selected, onSelect }: {
  option: AudienceOption;
  selected: boolean;
  onSelect: (opt: AudienceOption) => void;
}) {
  const v = audienceVisual(option.key, option.audienceRelationshipTypes?.[0], option.icon);
  const exclusive = isExclusive(option);
  return (
    <button
      type="button"
      className={`aoc ${selected ? 'aoc--sel' : ''}`}
      role={exclusive ? 'radio' : 'checkbox'}
      aria-checked={selected}
      onClick={() => onSelect(option)}
    >
      <span className="aoc-ic" style={{ background: v.bg, color: v.fg }}>{v.icon}</span>
      <span className="aoc-label">{option.label}</span>
      <span className={`aoc-mark ${exclusive ? 'aoc-mark--radio' : 'aoc-mark--check'}`} aria-hidden="true" />
    </button>
  );
}
