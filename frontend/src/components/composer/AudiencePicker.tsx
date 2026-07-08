// frontend/src/components/composer/AudiencePicker.tsx
// A grade de cards "1 · Para quem é isso?" — MATRIZ ÚNICA de plateia (Clayton 2026-07-07).
// MULTI-SELEÇÃO: escopos amplos (public/connections/only_me) são EXCLUSIVOS; relações típadas
// (amigo/cliente/...) COMBINAM entre si. A distinção vem do backend (types===null), não de lista
// local. Componente BURRO: recebe options + selectedKeys + onChange(keys). A resolução para payload
// é o helper puro resolveAudiencePayload — este componente só cuida do estado visual da seleção.
import type { AudienceOption } from '../../api/audience';
import AudienceOptionCard from './AudienceOptionCard';
import { toggleAudienceKey, isExclusive } from './audience-payload';
import './AudiencePicker.css';

export default function AudiencePicker({ options, selectedKeys, onChange, title = '1 · Para quem é isso?', subtitle }: {
  options: AudienceOption[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  title?: string;
  subtitle?: string;
}) {
  const selectedSet = new Set(selectedKeys);
  // Resumo humano só quando há relações combináveis escolhidas (mais de contexto que a própria opção).
  const combinableLabels = options
    .filter((o) => selectedSet.has(o.key) && !isExclusive(o))
    .map((o) => o.label);
  const summary = combinableLabels.length > 0
    ? combinableLabels.length === 1
      ? combinableLabels[0]
      : `${combinableLabels.slice(0, -1).join(', ')} e ${combinableLabels[combinableLabels.length - 1]}`
    : null;

  return (
    <div className="apk">
      {title && <p className="apk-q">{title}</p>}
      {subtitle && <p className="apk-sub">{subtitle}</p>}
      <div className="apk-grid" aria-label="Para quem é esta publicação">
        {options.map((opt) => (
          <AudienceOptionCard
            key={opt.key}
            option={opt}
            selected={selectedSet.has(opt.key)}
            onSelect={(o) => onChange(toggleAudienceKey(options, selectedKeys, o.key))}
          />
        ))}
      </div>
      {summary && <p className="apk-summary">Visível para: <strong>{summary}</strong>.</p>}
    </div>
  );
}
