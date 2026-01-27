// frontend/src/components/marketplace/SearchFiltersPanel.tsx
// Painel de Filtros de Busca do Marketplace
// 🔴 BLINDAGEM: Filtros sempre opt-in, nunca aplicados silenciosamente

import { useState } from 'react';
import type { MarketplaceSearchFilters } from '../../api/marketplace-search';
import './SearchFiltersPanel.css';

interface SearchFiltersPanelProps {
  filters: MarketplaceSearchFilters;
  onFiltersChange: (filters: Partial<MarketplaceSearchFilters>) => void;
  onApply: () => void;
}

export default function SearchFiltersPanel({
  filters,
  onFiltersChange,
  onApply,
}: SearchFiltersPanelProps) {
  const [localFilters, setLocalFilters] = useState<Partial<MarketplaceSearchFilters>>({
    dateRange: filters.dateRange,
    location: filters.location,
    capacity: filters.capacity,
    priceRange: filters.priceRange,
    availability: filters.availability,
    trustLevel: filters.trustLevel,
    actorType: filters.actorType,
  });

  const handleChange = (key: keyof MarketplaceSearchFilters, value: any) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onApply();
  };

  const handleClear = () => {
    setLocalFilters({});
    onFiltersChange({});
    onApply();
  };

  return (
    <div className="search-filters-panel">
      <div className="filters-header">
        <h3>Filtros</h3>
        <button className="clear-filters-button" onClick={handleClear}>
          Limpar
        </button>
      </div>

      <div className="filters-content">
        {/* Filtro de Data */}
        <div className="filter-group">
          <label className="filter-label">Período</label>
          <div className="filter-inputs">
            <input
              type="date"
              value={localFilters.dateRange?.start || ''}
              onChange={(e) =>
                handleChange('dateRange', {
                  ...localFilters.dateRange,
                  start: e.target.value,
                })
              }
              className="filter-input"
            />
            <span className="filter-separator">até</span>
            <input
              type="date"
              value={localFilters.dateRange?.end || ''}
              onChange={(e) =>
                handleChange('dateRange', {
                  ...localFilters.dateRange,
                  end: e.target.value,
                })
              }
              className="filter-input"
            />
          </div>
        </div>

        {/* Filtro de Localização */}
        <div className="filter-group">
          <label className="filter-label">Localização</label>
          <input
            type="text"
            placeholder="Cidade"
            value={localFilters.location?.cityId || ''}
            onChange={(e) =>
              handleChange('location', {
                ...localFilters.location,
                cityId: e.target.value || undefined,
              })
            }
            className="filter-input"
          />
        </div>

        {/* Filtro de Capacidade */}
        <div className="filter-group">
          <label className="filter-label">Capacidade</label>
          <div className="filter-inputs">
            <input
              type="number"
              placeholder="Mín"
              value={localFilters.capacity?.min || ''}
              onChange={(e) =>
                handleChange('capacity', {
                  ...localFilters.capacity,
                  min: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              className="filter-input"
            />
            <span className="filter-separator">-</span>
            <input
              type="number"
              placeholder="Máx"
              value={localFilters.capacity?.max || ''}
              onChange={(e) =>
                handleChange('capacity', {
                  ...localFilters.capacity,
                  max: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              className="filter-input"
            />
          </div>
        </div>

        {/* Filtro de Preço */}
        <div className="filter-group">
          <label className="filter-label">Faixa de Preço</label>
          <div className="filter-inputs">
            <input
              type="number"
              placeholder="Mín (R$)"
              value={localFilters.priceRange?.min || ''}
              onChange={(e) =>
                handleChange('priceRange', {
                  ...localFilters.priceRange,
                  min: e.target.value ? parseInt(e.target.value) * 100 : undefined, // Converter para centavos
                  currency: localFilters.priceRange?.currency || 'BRL',
                })
              }
              className="filter-input"
            />
            <span className="filter-separator">-</span>
            <input
              type="number"
              placeholder="Máx (R$)"
              value={localFilters.priceRange?.max || ''}
              onChange={(e) =>
                handleChange('priceRange', {
                  ...localFilters.priceRange,
                  max: e.target.value ? parseInt(e.target.value) * 100 : undefined, // Converter para centavos
                  currency: localFilters.priceRange?.currency || 'BRL',
                })
              }
              className="filter-input"
            />
          </div>
        </div>

        {/* Filtro de Trust Level */}
        <div className="filter-group">
          <label className="filter-label">Nível de Confiança Mínimo</label>
          <select
            value={localFilters.trustLevel || ''}
            onChange={(e) =>
              handleChange('trustLevel', e.target.value || undefined)
            }
            className="filter-select"
          >
            <option value="">Todos</option>
            <option value="LOW">Baixo ou superior</option>
            <option value="MEDIUM">Médio ou superior</option>
            <option value="HIGH">Alto</option>
          </select>
        </div>

        {/* Botão Aplicar */}
        <button className="apply-filters-button" onClick={handleApply}>
          Aplicar Filtros
        </button>
      </div>
    </div>
  );
}




