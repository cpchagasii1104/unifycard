// src/components/feed/ActiveLocationManager.tsx
// DECISION-0030 (F5) — Modal de gestão de localização ativa do actor.
//
// Princípios LGPD:
//   - lat/lng NUNCA persistidos em localStorage (apenas envio HTTP)
//   - Geolocation API só com consent explícito (browser pede)
//   - Sem coleta automática ao login (opt-in obrigatório)
//
// Dois caminhos UX:
//   A) Busca cidade via worldService (hierarquia BR: estado → cidade)
//   B) Geolocation API do browser (W3C)

import { useState, useEffect } from 'react';
import {
  getActiveLocation,
  setActiveLocation,
  clearActiveLocation,
  type ActiveLocation,
} from '../../api/active-location';
import {
  getStatesByCountry,
  getCitiesByState,
  type State,
  type City,
} from '../../api/world';
import './ActiveLocationManager.css';

interface ActiveLocationManagerProps {
  open: boolean;
  onClose: () => void;
  onLocationChange: (next: ActiveLocation | null) => void;
}

// Brasil é o único país com seed inicial (DECISION-0020 §2 — multi-país incremental).
// Quando outros países entrarem, este valor vira selector de país.
// [REVISAR_COM_CLAYTON: hardcode BR temporário até seed multi-país]
const BR_COUNTRY_ID = '__BR__';

export default function ActiveLocationManager({
  open,
  onClose,
  onLocationChange,
}: ActiveLocationManagerProps) {
  const [current, setCurrent] = useState<ActiveLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Caminho A: estado → cidade
  const [states, setStates] = useState<State[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  // Hidratar localização atual + estados ao abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loc = await getActiveLocation();
        if (cancelled) return;
        setCurrent(loc);

        // Buscar estados (BR é o único país populado hoje)
        // O backend tem GET /world/countries/:id/states — descobrimos country_id da primeira chamada
        const { getCountries } = await import('../../api/world');
        const countries = await getCountries();
        const br = countries.find((c) => c.code === 'BR') ?? countries[0];
        if (br) {
          const list = await getStatesByCountry(br.countryId);
          if (!cancelled) setStates(list);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Carregar cidades quando estado muda
  useEffect(() => {
    if (!selectedStateId) {
      setCities([]);
      setSelectedCityId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await getCitiesByState(selectedStateId);
        if (!cancelled) {
          setCities(list);
          setSelectedCityId('');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar cidades');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStateId]);

  async function handleSetByCity() {
    if (!selectedCityId) {
      setError('Selecione uma cidade');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Backend aceita address_id OU (lat, lng). Para "set by city" sem address_id
      // específico, enviamos só city info via metadata + lat/lng da cidade.
      // [REVISAR_COM_CLAYTON: city sem address_id usa lat/lng da city; ideal seria
      //  ter helper backend para resolver address de cidade]
      const city = cities.find((c) => c.cityId === selectedCityId);
      if (!city) {
        setError('Cidade inválida');
        setLoading(false);
        return;
      }
      // Para MVP: enviamos lat/lng da cidade (já existem em cities table).
      // Backend valida CHECK address_id OR (lat, lng); aceita.
      // Futuro: helper que resolve city_id → address_id canônico.
      const lat = city.latitude;
      const lng = city.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        setError('Cidade sem coordenadas registradas — escolha outra ou use GPS.');
        setLoading(false);
        return;
      }
      const result = await setActiveLocation({
        lat,
        lng,
        source: 'USER_INPUT_CITY',
        scope_level: 'CITY',
        metadata: { city_id: selectedCityId, state_id: selectedStateId },
      });
      setCurrent(result);
      onLocationChange(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao definir localização');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetByGeolocation() {
    if (!navigator.geolocation) {
      setError('Navegador não suporta geolocalização');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await setActiveLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            source: 'BROWSER_GEOLOCATION',
            // scope_level omitido — backend infere se necessário
          });
          setCurrent(result);
          onLocationChange(result);
          onClose();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erro ao salvar localização');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(
          err.code === 1
            ? 'Permissão negada. Você pode escolher uma cidade manualmente.'
            : 'Não foi possível obter localização. Tente escolher uma cidade.'
        );
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  async function handleClear() {
    setLoading(true);
    setError(null);
    try {
      await clearActiveLocation();
      setCurrent(null);
      onLocationChange(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao limpar localização');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="alm-backdrop" onClick={onClose}>
      <div className="alm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="alm-header">
          <h2>Sua localização</h2>
          <button type="button" className="alm-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        {current && (
          <section className="alm-current">
            <p className="alm-current-label">Localização ativa:</p>
            <p className="alm-current-detail">
              {current.source === 'USER_INPUT_CITY' && 'Cidade selecionada manualmente'}
              {current.source === 'BROWSER_GEOLOCATION' && 'GPS do navegador'}
              {current.source === 'IP_ESTIMATE' && 'Estimativa por IP'}
              {current.source === 'EXPLICIT_TRAVEL_MODE' && 'Modo viagem'}
              {' · '}
              <small>desde {new Date(current.activatedAt).toLocaleString()}</small>
            </p>
            <button
              type="button"
              className="alm-btn alm-btn-ghost"
              onClick={handleClear}
              disabled={loading}
            >
              Limpar localização
            </button>
          </section>
        )}

        <section className="alm-section">
          <h3>Escolher uma cidade</h3>
          <p className="alm-hint">
            Hoje atendemos o Brasil. Selecione estado e cidade — sem GPS.
          </p>
          <div className="alm-form-row">
            <label>
              Estado
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                disabled={loading || states.length === 0}
              >
                <option value="">— selecionar —</option>
                {states.map((s) => (
                  <option key={s.stateId} value={s.stateId}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cidade
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                disabled={loading || !selectedStateId || cities.length === 0}
              >
                <option value="">— selecionar —</option>
                {cities.map((c) => (
                  <option key={c.cityId} value={c.cityId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="alm-btn alm-btn-primary"
            onClick={handleSetByCity}
            disabled={loading || !selectedCityId}
          >
            Usar esta cidade
          </button>
        </section>

        <section className="alm-section">
          <h3>Usar localização do navegador</h3>
          <p className="alm-hint">
            O navegador vai pedir sua permissão. Não armazenamos sua posição precisa
            localmente — apenas enviamos para a sua conta.
          </p>
          <button
            type="button"
            className="alm-btn alm-btn-secondary"
            onClick={handleSetByGeolocation}
            disabled={loading}
          >
            Permitir localização do navegador
          </button>
        </section>

        {error && <p className="alm-error">{error}</p>}
      </div>
    </div>
  );
}

// Silenciar warning sobre BR_COUNTRY_ID não usado (mantido como nota para futuro)
void BR_COUNTRY_ID;
