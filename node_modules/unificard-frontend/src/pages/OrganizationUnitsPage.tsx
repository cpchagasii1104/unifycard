// src/pages/OrganizationUnitsPage.tsx
// Lista de Unidades Organizacionais (Read-only)
// SPRINT: Organization MVP

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  listOrganizationUnits,
  type OrganizationUnit,
  type OrganizationUnitType,
} from '../api/organization';
import { showToast } from '../components/common/Toast';
import './OrganizationUnitsPage.css';

export default function OrganizationUnitsPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<OrganizationUnitType | 'ALL'>('ALL');

  useEffect(() => {
    loadUnits();
  }, [activeActor, typeFilter]);

  const loadUnits = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (typeFilter !== 'ALL') filters.type = typeFilter;

      const result = await listOrganizationUnits(filters);
      setUnits(result.units);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar unidades');
      showToast(err.message || 'Erro ao carregar unidades');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeLabel = (type: OrganizationUnitType): string => {
    const labels: Record<OrganizationUnitType, string> = {
      MATRIX: 'Matriz',
      BRANCH: 'Filial',
      DC: 'Centro de Distribuição',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="organization-units-page">
        <div className="loading">Carregando unidades...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="organization-units-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadUnits}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="organization-units-page">
      <div className="page-header">
        <button onClick={() => navigate(-1)}>← Voltar</button>
        <h1>Unidades Organizacionais</h1>
      </div>

      <div className="info-banner">
        <p>A criação e edição de unidades organizacionais é gerenciada pelo sistema.</p>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="type-filter">Tipo:</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as OrganizationUnitType | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="MATRIX">Matriz</option>
            <option value="BRANCH">Filial</option>
            <option value="DC">Centro de Distribuição</option>
          </select>
        </div>
      </div>

      {units.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma unidade encontrada.</p>
        </div>
      ) : (
        <div className="units-list">
          {units.map((unit) => (
            <div key={unit.id} className="unit-item">
              <div className="unit-header">
                <span className="unit-name">{unit.name}</span>
                <span className="unit-type">{getTypeLabel(unit.type)}</span>
              </div>
              <div className="unit-details">
                {unit.parentId && (
                  <span className="unit-parent">Unidade pai: {unit.parentId.substring(0, 8)}...</span>
                )}
                <span className="unit-id">ID: {unit.id.substring(0, 8)}...</span>
              </div>
              {unit.metadata && Object.keys(unit.metadata).length > 0 && (
                <div className="unit-metadata">
                  <strong>Metadata:</strong> {JSON.stringify(unit.metadata, null, 2)}
                </div>
              )}
              <div className="unit-meta">
                <span>Criado em: {new Date(unit.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

