// frontend/src/components/composer/AudienceOptionCard.tsx
// O card de uma plateia. A TRAVA DE DESIGN de Clayton vive aqui:
//   • pastel (bolha do ícone) = RECONHECIMENTO visual — decoração pura.
//   • índigo (borda + fundo + halo + radio) = DECISÃO — padrão ÚNICO de seleção no sistema inteiro.
// Cor nunca entra em payload/lógica/permissão. O componente não sabe o que a opção "significa";
// só projeta o que recebe.
import type { AudienceOption } from '../../api/audience';
import { audienceVisual } from './audience-icon-palette';
import './AudienceOptionCard.css';

export default function AudienceOptionCard({ option, selected, onSelect }: {
  option: AudienceOption;
  selected: boolean;
  onSelect: (opt: AudienceOption) => void;
}) {
  const v = audienceVisual(option.key, option.audienceRelationshipTypes?.[0], option.icon);
  return (
    <button
      type="button"
      className={`aoc ${selected ? 'aoc--sel' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(option)}
    >
      <span className="aoc-ic" style={{ background: v.bg, color: v.fg }}>{v.icon}</span>
      <span className="aoc-label">{option.label}</span>
      <span className="aoc-radio" aria-hidden="true" />
    </button>
  );
}
