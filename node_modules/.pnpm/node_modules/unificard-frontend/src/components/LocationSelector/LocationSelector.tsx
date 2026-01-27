// src/components/LocationSelector/LocationSelector.tsx
// Componente central de seleção de localização

import { useEffect, useRef } from 'react';
import { useLocation } from './useLocation';
import type { LocationSelectorProps } from './types';
import './LocationSelector.css';

export default function LocationSelector({
  scope,
  value,
  onChange,
  required = false,
  disabled = false,
  labels = {},
  className = '',
  error,
}: LocationSelectorProps) {
  const { data, loading } = useLocation(scope, value);
  
  // Ref para rastrear último estado validado (evita loops)
  const lastValidatedStateRef = useRef<string | undefined>(value.state_id);
  const lastValidatedCityRef = useRef<string | undefined>(value.city_id);

  // 🔴 VALIDAÇÃO: Se cidade selecionada não pertence ao estado atual, resetar
  // Isso garante que não haja inconsistência (ex: Curitiba selecionada mas estado é Amazonas)
  useEffect(() => {
    // Só validar se:
    // 1. Há estado selecionado
    // 2. Há cidade selecionada
    // 3. Cidades já foram carregadas (não está em loading)
    // 4. Há cidades disponíveis para comparar
    // 5. Estado ou cidade mudou desde a última validação
    if (
      value.state_id && 
      value.city_id && 
      !loading.cities && 
      data.cities.length > 0 &&
      (lastValidatedStateRef.current !== value.state_id || lastValidatedCityRef.current !== value.city_id)
    ) {
      const cityBelongsToState = data.cities.some(city => city.id === value.city_id);
      
      if (!cityBelongsToState) {
        // Cidade não pertence ao estado atual - resetar
        // Guard: Só chamar onChange se realmente precisar mudar (evita loop)
        if (value.city_id !== undefined || value.neighborhood_id !== undefined) {
          onChange({
            country_id: value.country_id,
            state_id: value.state_id,
            city_id: undefined,
            neighborhood_id: undefined,
          });
        }
        lastValidatedCityRef.current = undefined;
      } else {
        // Cidade válida - atualizar refs
        lastValidatedStateRef.current = value.state_id;
        lastValidatedCityRef.current = value.city_id;
      }
    } else if (value.state_id && !value.city_id) {
      // Se não há cidade selecionada, atualizar refs
      lastValidatedStateRef.current = value.state_id;
      lastValidatedCityRef.current = undefined;
    }
  }, [value.state_id, value.city_id, data.cities, loading.cities, onChange, value.country_id]);

  // Labels padrão
  const defaultLabels = {
    country: 'País',
    state: 'Estado',
    city: 'Cidade',
    neighborhood: 'Bairro',
  };

  const finalLabels = { ...defaultLabels, ...labels };

  // Handler para mudança de país
  const handleCountryChange = (countryId: string) => {
    // 🔴 DEBUG: Log mudança de país
    if (import.meta.env.DEV) {
      console.log('[LocationSelector] País mudou:', {
        oldCountryId: value.country_id,
        newCountryId: countryId || undefined,
        scope,
        action: 'Resetando state, city, neighborhood',
      });
    }
    
    onChange({
      country_id: countryId || undefined,
      state_id: undefined, // Resetar estado ao mudar país
      city_id: undefined, // Resetar cidade ao mudar país
      neighborhood_id: undefined, // Resetar bairro ao mudar país
    });
  };

  // Handler para mudança de estado
  const handleStateChange = (stateId: string) => {
    // 🔴 CORREÇÃO: Sempre resetar cidade e bairro ao trocar estado
    // Isso garante que a cidade selecionada não seja de outro estado
    
    // 🔴 DEBUG: Log mudança de estado
    if (import.meta.env.DEV) {
      console.log('[LocationSelector] Estado mudou:', {
        oldStateId: value.state_id,
        newStateId: stateId || undefined,
        scope,
        action: 'Resetando city, neighborhood',
      });
    }
    
    onChange({
      ...value,
      state_id: stateId || undefined,
      city_id: undefined, // Sempre limpar cidade ao trocar estado
      neighborhood_id: undefined, // Sempre limpar bairro ao trocar estado
    });
  };

  // Handler para mudança de cidade
  const handleCityChange = (cityId: string) => {
    // 🔴 DEBUG: Log mudança de cidade
    if (import.meta.env.DEV) {
      console.log('[LocationSelector] Cidade mudou:', {
        oldCityId: value.city_id,
        newCityId: cityId || undefined,
        scope,
        action: 'Resetando neighborhood',
      });
    }
    
    onChange({
      ...value,
      city_id: cityId || undefined,
      neighborhood_id: undefined, // Resetar bairro ao mudar cidade
    });
  };

  // Handler para mudança de bairro
  const handleNeighborhoodChange = (neighborhoodId: string) => {
    onChange({
      ...value,
      neighborhood_id: neighborhoodId || undefined,
    });
  };

  // País é sempre obrigatório, mesmo para scope 'national'
  return (
    <div className={`location-selector ${className}`}>
      {/* País - sempre exibido */}
      <div className="location-selector-field">
        <label htmlFor="location-country" className="location-selector-label">
          {finalLabels.country}
          {required && <span className="location-selector-required"> *</span>}
        </label>
        <select
          id="location-country"
          value={value.country_id || ''}
          onChange={(e) => handleCountryChange(e.target.value)}
          disabled={disabled || loading.countries}
          required={required}
          className={`location-selector-select ${error ? 'error' : ''}`}
          aria-label={finalLabels.country}
          aria-required={required}
          aria-invalid={!!error}
        >
          <option value="">
            {loading.countries ? 'Carregando...' : `Selecione um ${finalLabels.country.toLowerCase()}`}
          </option>
          {data.countries.length === 0 && !loading.countries ? (
            <option value="" disabled>
              Nenhum país disponível
            </option>
          ) : (
            data.countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))
          )}
        </select>
        {(error || (data.countries.length === 0 && !loading.countries)) && (
          <span className="location-selector-error">
            {error || 'Nenhum país disponível. Por favor, recarregue a página.'}
          </span>
        )}
      </div>

      {/* Estado */}
      {(scope === 'state' || scope === 'city' || scope === 'neighborhood') && (
        <div className="location-selector-field">
          <label htmlFor="location-state" className="location-selector-label">
            {finalLabels.state}
            {required && <span className="location-selector-required"> *</span>}
          </label>
          <select
            id="location-state"
            value={value.state_id || ''}
            onChange={(e) => handleStateChange(e.target.value)}
            disabled={disabled || loading.states || !value.country_id || loading.countries}
            required={required}
            className={`location-selector-select ${error ? 'error' : ''}`}
            aria-label={finalLabels.state}
            aria-required={required}
            aria-invalid={!!error}
          >
            <option value="">
              {loading.states
                ? 'Carregando...'
                : !value.country_id
                ? `Selecione um ${finalLabels.country.toLowerCase()} primeiro`
                : `Selecione um ${finalLabels.state.toLowerCase()}`}
            </option>
            {data.states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Cidade */}
      {(scope === 'city' || scope === 'neighborhood') && (
        <div className="location-selector-field">
          <label htmlFor="location-city" className="location-selector-label">
            {finalLabels.city}
            {required && <span className="location-selector-required"> *</span>}
          </label>
          <select
            id="location-city"
            value={value.city_id || ''}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={disabled || loading.cities || !value.state_id || loading.states}
            required={required && (scope === 'city' || scope === 'neighborhood')}
            className={`location-selector-select ${error ? 'error' : ''}`}
            aria-label={finalLabels.city}
            aria-required={required && (scope === 'city' || scope === 'neighborhood')}
            aria-invalid={!!error}
          >
            <option value="">
              {loading.cities
                ? 'Carregando...'
                : !value.state_id
                ? `Selecione um ${finalLabels.state.toLowerCase()} primeiro`
                : data.cities.length === 0
                ? 'Nenhuma cidade disponível'
                : `Selecione uma ${finalLabels.city.toLowerCase()}`}
            </option>
            {data.cities.length === 0 && !loading.cities && value.state_id ? (
              <option value="" disabled>
                Nenhuma cidade encontrada para este estado
              </option>
            ) : (
              data.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Bairro */}
      {scope === 'neighborhood' && (
        <div className="location-selector-field">
          <label htmlFor="location-neighborhood" className="location-selector-label">
            {finalLabels.neighborhood}
            {required && <span className="location-selector-required"> *</span>}
          </label>
          <select
            id="location-neighborhood"
            value={value.neighborhood_id || ''}
            onChange={(e) => handleNeighborhoodChange(e.target.value)}
            disabled={disabled || loading.neighborhoods || !value.city_id || loading.cities}
            required={required && scope === 'neighborhood'}
            className={`location-selector-select ${error ? 'error' : ''}`}
            aria-label={finalLabels.neighborhood}
            aria-required={required && scope === 'neighborhood'}
            aria-invalid={!!error}
          >
            <option value="">
              {loading.neighborhoods
                ? 'Carregando...'
                : !value.city_id
                ? `Selecione uma ${finalLabels.city.toLowerCase()} primeiro`
                : `Selecione um ${finalLabels.neighborhood.toLowerCase()}`}
            </option>
            {data.neighborhoods.map((neighborhood) => (
              <option key={neighborhood.id} value={neighborhood.id}>
                {neighborhood.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

