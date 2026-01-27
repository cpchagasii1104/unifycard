// src/pages/ServiceAvailabilityPage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Declaration / Creation Page
// Declaração progressiva de disponibilidade (sem validação temporal)

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  listServiceAvailabilities,
  createServiceAvailability,
  type ServiceAvailability,
  type AvailabilityStatus,
} from '../api/service-availability';
import { getService } from '../api/services';
import { showToast } from '../components/common/Toast';
import './ServiceAvailabilityPage.css';

export default function ServiceAvailabilityPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [serviceName, setServiceName] = useState<string>('');
  const [availabilities, setAvailabilities] = useState<ServiceAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AvailabilityStatus | 'ALL'>('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    startDatetime: '',
    endDatetime: '',
    timezone: 'America/Sao_Paulo',
    capacity: '',
    status: 'active' as AvailabilityStatus,
  });

  useEffect(() => {
    if (id) {
      loadService();
      loadAvailabilities();
    }
  }, [id, statusFilter]);

  const loadService = async () => {
    if (!id) return;
    try {
      const service = await getService(id);
      setServiceName(service.name);
    } catch (err) {
      console.error('Erro ao carregar serviço:', err);
    }
  };

  const loadAvailabilities = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;

      const data = await listServiceAvailabilities(id, filters);
      setAvailabilities(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar disponibilidades');
      showToast(err.message || 'Erro ao carregar disponibilidades', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔴 ENTITY DECLARATION PAGE: Salvar como rascunho (sem validação temporal)
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSubmitting(true);
    try {
      // Validação mínima: apenas campos básicos
      if (!formData.startDatetime || !formData.endDatetime) {
        showToast('Preencha data/hora de início e fim para salvar como rascunho', 'error');
        setIsSubmitting(false);
        return;
      }

      await createServiceAvailability(id, {
        serviceId: id,
        startDatetime: formData.startDatetime,
        endDatetime: formData.endDatetime,
        timezone: formData.timezone,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        status: formData.status,
      });
      showToast('Disponibilidade salva como rascunho', 'success');
      setShowCreateForm(false);
      setFormData({
        startDatetime: '',
        endDatetime: '',
        timezone: 'America/Sao_Paulo',
        capacity: '',
        status: 'active',
      });
      loadAvailabilities();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar disponibilidade', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };


  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="service-availability-page">
        <div className="loading">Carregando disponibilidades...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="service-availability-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadAvailabilities}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="service-availability-page">
      <div className="page-header">
        <button onClick={() => navigate(`/services/${id}`)}>← Voltar</button>
        <h1>Disponibilidade: {serviceName}</h1>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary">
          {showCreateForm ? 'Cancelar' : 'Nova Disponibilidade'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleSaveDraft} className="create-form">
          <h3>Declarar Nova Disponibilidade</h3>
          <p className="form-description">
            Preencha as informações da disponibilidade. Você pode salvar como rascunho a qualquer momento.
            <br />
            <strong>🔴 NOTA:</strong> Datas/horas são apenas INPUT VISUAL - sem validação temporal no frontend.
          </p>
          <div className="form-group">
            <label htmlFor="startDatetime">Data/Hora Início <span className="required">*</span></label>
            <input
              id="startDatetime"
              type="datetime-local"
              value={formData.startDatetime}
              onChange={(e) => setFormData({ ...formData, startDatetime: e.target.value })}
              required
            />
            <small className="form-hint">Apenas input visual - validação no backend</small>
          </div>
          <div className="form-group">
            <label htmlFor="endDatetime">Data/Hora Fim <span className="required">*</span></label>
            <input
              id="endDatetime"
              type="datetime-local"
              value={formData.endDatetime}
              onChange={(e) => setFormData({ ...formData, endDatetime: e.target.value })}
              required
            />
            <small className="form-hint">Apenas input visual - validação no backend</small>
          </div>
          <div className="form-group">
            <label htmlFor="timezone">Fuso Horário</label>
            <input
              id="timezone"
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="capacity">Capacidade (opcional)</label>
            <input
              id="capacity"
              type="number"
              min="1"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as AvailabilityStatus })}
            >
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
            </select>
          </div>
          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => {
                setShowCreateForm(false);
                setFormData({
                  startDatetime: '',
                  endDatetime: '',
                  timezone: 'America/Sao_Paulo',
                  capacity: '',
                  status: 'active',
                });
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar Rascunho'}
            </button>
          </div>
        </form>
      )}

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AvailabilityStatus | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="active">Ativo</option>
            <option value="paused">Pausado</option>
          </select>
        </div>
      </div>

      {availabilities.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma disponibilidade cadastrada.</p>
        </div>
      ) : (
        <div className="availabilities-list">
          {availabilities.map((availability) => (
            <div key={availability.id} className="availability-item">
              <div className="availability-info">
                <div className="availability-dates">
                  <strong>Início:</strong> {formatDateTime(availability.startDatetime)}
                  <br />
                  <strong>Fim:</strong> {formatDateTime(availability.endDatetime)}
                </div>
                <div className="availability-meta">
                  {availability.capacity && (
                    <span className="capacity">Capacidade: {availability.capacity}</span>
                  )}
                  <span className={`status status-${availability.status}`}>
                    {availability.status === 'active' ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
              </div>
              {/* 🔴 ENTITY DECLARATION PAGE: CTA explícito para navegar para Action Page (alterar status) */}
              <div className="availability-actions">
                <button
                  onClick={() => navigate(`/service-availability/${id}/${availability.id}/toggle-status`)}
                  className={`btn-toggle ${availability.status === 'active' ? 'btn-pause' : 'btn-activate'}`}
                >
                  {availability.status === 'active' ? 'Pausar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




