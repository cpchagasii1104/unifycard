// frontend/src/components/common/GovernedCombobox.tsx
// Campo GOVERNADO reutilizável (Clayton 2026-07-07). Combobox reabrível: clicar reabre as opções,
// o usuário NÃO apaga texto manualmente. Consome o catálogo via loadOptions (injetado); NÃO conhece
// veículos/marcas/modelos/concepts/actors — é UX pura. NÃO decide validade: só lê e projeta o que o
// backend devolve (SSOT decide; este componente lê). Estados: vazio/carregando/selecionado/sem-
// resultado/dependência-ausente.
import { useEffect, useRef, useState } from 'react';
import './GovernedCombobox.css';

export default function GovernedCombobox<T>({
  value, onChange, loadOptions, getOptionKey, getOptionLabel,
  disabledReason, placeholder = 'Buscar…', emptyMessage = 'Nada encontrado',
  loadingMessage = 'Carregando…', label,
}: {
  value: T | null;
  onChange: (opt: T | null) => void;
  /** Busca no catálogo governado. `q` = texto digitado. Retorna as opções JÁ resolvidas do backend. */
  loadOptions: (q: string) => Promise<T[]>;
  getOptionKey: (opt: T) => string;
  getOptionLabel: (opt: T) => string;
  /** Se presente, o campo fica DESABILITADO com esta razão (dependência ausente). */
  disabledReason?: string | null;
  placeholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadKey, setLoadKey] = useState(0); // força reload ao reabrir
  const boxRef = useRef<HTMLDivElement>(null);

  // fecha ao clicar fora
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // carrega opções quando aberto (e a cada digitação/reabertura)
  useEffect(() => {
    if (!open || disabledReason) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      loadOptions(query).then((o) => { if (alive) setOptions(o); }).catch(() => { if (alive) setOptions([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [open, query, loadKey, disabledReason, loadOptions]);

  const disabled = !!disabledReason;
  const shown = value ? getOptionLabel(value) : '';

  return (
    <div className={`gcb ${disabled ? 'gcb--disabled' : ''}`} ref={boxRef}>
      {label && <span className="gcb-label">{label}</span>}
      <button
        type="button"
        className={`gcb-field ${open ? 'gcb-field--open' : ''} ${value ? 'gcb-field--filled' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => { if (!disabled) { setOpen((v) => !v); setQuery(''); setLoadKey((k) => k + 1); } }}
      >
        <span className="gcb-value">{disabled ? disabledReason : (shown || placeholder)}</span>
        <span className="gcb-caret">▾</span>
      </button>

      {open && !disabled && (
        <div className="gcb-pop">
          <input
            className="gcb-search" autoFocus placeholder={placeholder}
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
          <div className="gcb-list" role="listbox">
            {loading && <div className="gcb-state">{loadingMessage}</div>}
            {!loading && options.length === 0 && <div className="gcb-state">{emptyMessage}</div>}
            {!loading && options.map((opt) => {
              const k = getOptionKey(opt);
              const sel = value ? getOptionKey(value) === k : false;
              return (
                <button
                  key={k} type="button" role="option" aria-selected={sel}
                  className={`gcb-item ${sel ? 'gcb-item--sel' : ''}`}
                  onClick={() => { onChange(opt); setOpen(false); }}
                >
                  <span>{getOptionLabel(opt)}</span>
                  {sel && <span className="gcb-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
