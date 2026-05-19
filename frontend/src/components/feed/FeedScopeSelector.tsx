// src/components/feed/FeedScopeSelector.tsx
// DECISION-0030 (F5) — UI de seleção de scope geográfico para o feed.
//
// Princípios aplicados:
//   - Frontend NUNCA calcula raio — envia payload {scope, value} ao backend
//   - feed-proximity ≠ proximity genérico (DECISION-0030 anti-padrão #1):
//     este componente é ESPECÍFICO do feed; rides/delivery/marketplace
//     TERÃO seus próprios componentes de scope com regras próprias.
//   - Preferência (scope escolhido) pode ser persistida em localStorage;
//     lat/lng NUNCA (LGPD).

import { useState, useEffect } from 'react';
import type { FeedScope } from '../../api/social-2.0';
import './FeedScopeSelector.css';

export interface FeedScopeValue {
  scope: FeedScope;
  /** Em km quando scope='radius_km' */
  value?: number;
  includeGlobal: boolean;
}

interface FeedScopeSelectorProps {
  value: FeedScopeValue;
  onChange: (next: FeedScopeValue) => void;
  /** Indica se o usuário tem localização ativa; se não, alguns scopes degradam UX */
  hasActiveLocation: boolean;
  /** Callback quando user clica em "ativar localização" (abre ActiveLocationManager) */
  onActivateLocation?: () => void;
  disabled?: boolean;
}

const SCOPE_PRESETS: Array<{
  id: string;
  label: string;
  scope: FeedScope;
  value?: number;
  requiresLocation: boolean;
}> = [
  { id: 'r3', label: '3 km', scope: 'radius_km', value: 3, requiresLocation: true },
  { id: 'r10', label: '10 km', scope: 'radius_km', value: 10, requiresLocation: true },
  { id: 'city', label: 'Minha cidade', scope: 'city', requiresLocation: true },
  { id: 'state', label: 'Meu estado', scope: 'state', requiresLocation: true },
  { id: 'unlimited', label: 'Tudo', scope: 'unlimited', requiresLocation: false },
];

const LS_KEY = 'unificard_feed_scope_preference';

function loadPreference(): FeedScopeValue | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed.scope === 'radius_km' ||
        parsed.scope === 'city' ||
        parsed.scope === 'state' ||
        parsed.scope === 'unlimited')
    ) {
      return {
        scope: parsed.scope,
        value: typeof parsed.value === 'number' ? parsed.value : undefined,
        includeGlobal: parsed.includeGlobal === true,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function savePreference(v: FeedScopeValue): void {
  try {
    // Persistimos apenas a PREFERÊNCIA do scope (não dados de localização).
    // lat/lng nunca entram aqui (LGPD).
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        scope: v.scope,
        value: v.value,
        includeGlobal: v.includeGlobal,
      })
    );
  } catch {
    /* ignore */
  }
}

export default function FeedScopeSelector({
  value,
  onChange,
  hasActiveLocation,
  onActivateLocation,
  disabled = false,
}: FeedScopeSelectorProps) {
  // Hidratar preferência salva uma vez ao montar (se caller não controlar via prop)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    setHydrated(true);
    const saved = loadPreference();
    if (saved && (saved.scope !== value.scope || saved.value !== value.value)) {
      onChange(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectPreset(preset: typeof SCOPE_PRESETS[number]) {
    if (disabled) return;
    if (preset.requiresLocation && !hasActiveLocation) {
      // UX degrada: avisa user para ativar localização
      onActivateLocation?.();
      return;
    }
    const next: FeedScopeValue = {
      scope: preset.scope,
      value: preset.value,
      includeGlobal: value.includeGlobal,
    };
    savePreference(next);
    onChange(next);
  }

  function toggleIncludeGlobal() {
    if (disabled) return;
    const next = { ...value, includeGlobal: !value.includeGlobal };
    savePreference(next);
    onChange(next);
  }

  const activePresetId = SCOPE_PRESETS.find((p) => {
    if (p.scope !== value.scope) return false;
    if (p.scope === 'radius_km') return p.value === value.value;
    return true;
  })?.id;

  return (
    <div className={`feed-scope-selector ${disabled ? 'is-disabled' : ''}`}>
      <div className="feed-scope-row">
        <span className="feed-scope-label">Mostrar:</span>
        <div className="feed-scope-pills" role="tablist" aria-label="Alcance do feed">
          {SCOPE_PRESETS.map((preset) => {
            const isActive = preset.id === activePresetId;
            const needsLocation = preset.requiresLocation && !hasActiveLocation;
            return (
              <button
                key={preset.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`feed-scope-pill ${isActive ? 'is-active' : ''} ${needsLocation ? 'needs-location' : ''}`}
                onClick={() => selectPreset(preset)}
                disabled={disabled}
                title={needsLocation ? 'Requer localização ativa — clique para configurar' : undefined}
              >
                {preset.label}
                {needsLocation && <span className="feed-scope-pill-warn" aria-hidden="true">!</span>}
              </button>
            );
          })}
        </div>
      </div>
      {value.scope !== 'unlimited' && (
        <label className="feed-scope-toggle">
          <input
            type="checkbox"
            checked={value.includeGlobal}
            onChange={toggleIncludeGlobal}
            disabled={disabled}
          />
          <span>Incluir postagens sem localização</span>
        </label>
      )}
      {!hasActiveLocation && (
        <button
          type="button"
          className="feed-scope-activate"
          onClick={onActivateLocation}
          disabled={disabled}
        >
          Ativar minha localização
        </button>
      )}
    </div>
  );
}
