// frontend/src/components/composer/AudiencePicker.tsx
// A grade de cards "1 · Para quem é isso?" — MATRIZ ÚNICA de plateia do sistema (Clayton 2026-07-07).
// Componente BURRO: recebe options + value + onChange. Não faz fetch, não decide PF/PJ, não filtra
// permissão, não tem lista local. A verdade vem toda de /audience-options (via useAudienceOptions no
// pai, ou options passadas por prop). Reutilizado por post, evento, locação, demanda, oportunidade.
import type { AudienceOption } from '../../api/audience';
import AudienceOptionCard from './AudienceOptionCard';
import './AudiencePicker.css';

export default function AudiencePicker({ options, value, onChange, title = '1 · Para quem é isso?', subtitle }: {
  options: AudienceOption[];
  value: string | null;
  onChange: (opt: AudienceOption) => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="apk">
      {title && <p className="apk-q">{title}</p>}
      {subtitle && <p className="apk-sub">{subtitle}</p>}
      <div className="apk-grid" role="radiogroup" aria-label="Para quem é esta publicação">
        {options.map((opt) => (
          <AudienceOptionCard
            key={opt.key}
            option={opt}
            selected={value === opt.key}
            onSelect={onChange}
          />
        ))}
      </div>
    </div>
  );
}
