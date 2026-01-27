// src/pages/CreateServiceOrderPage.tsx
// Criar Service Order (Cliente)
// SPRINT 68: Service Orders + Agenda

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { createServiceOrder, type CreateServiceOrderInput } from '../api/service-orders';
import { getEventById } from '../api/events';
import { showToast } from '../components/common/Toast';
import './CreateServiceOrderPage.css';

export default function CreateServiceOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeActor } = useActiveActor();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);
  
  // Parâmetros de origem (evento/necessidade)
  const eventId = searchParams.get('eventId');
  const needId = searchParams.get('needId');
  const needCategory = searchParams.get('needCategory');
  const needDescription = searchParams.get('needDescription');
  
  const [formData, setFormData] = useState<Partial<CreateServiceOrderInput>>({
    scheduledStart: '',
    scheduledEnd: '',
    description: '',
    customerNotes: '',
    locationAddress: '',
  });

  // Carregar informações do evento se vier de uma necessidade
  useEffect(() => {
    if (eventId && needCategory) {
      setIsLoadingEvent(true);
      loadEventInfo();
    }
  }, [eventId, needCategory]);

  const loadEventInfo = async () => {
    if (!eventId) return;

    try {
      const event = await getEventById(eventId);
      
      // Preencher campos com informações do evento
      setFormData(prev => ({
        ...prev,
        description: needDescription || needCategory || prev.description,
        customerNotes: `Necessidade do evento: ${event.event.title}\nCategoria: ${needCategory}${needDescription ? `\nDescrição: ${needDescription}` : ''}`,
        // Usar data/hora do evento como sugestão
        scheduledStart: event.event.datetime_start ? new Date(event.event.datetime_start).toISOString().slice(0, 16) : prev.scheduledStart,
        scheduledEnd: event.event.datetime_end ? new Date(event.event.datetime_end).toISOString().slice(0, 16) : prev.scheduledEnd,
      }));
    } catch (err) {
      console.error('Erro ao carregar informações do evento:', err);
    } finally {
      setIsLoadingEvent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeActor) {
      showToast('É necessário estar logado para criar uma ordem', 'error');
      return;
    }

    // Validações básicas
    if (!formData.serviceId) {
      showToast('ID do serviço é obrigatório', 'error');
      return;
    }

    if (!formData.workerActorId) {
      showToast('ID do funcionário é obrigatório', 'error');
      return;
    }

    if (!formData.scheduledStart) {
      showToast('Data/hora de início é obrigatória', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const input: CreateServiceOrderInput = {
        serviceId: formData.serviceId!,
        workerActorId: formData.workerActorId!,
        customerActorId: activeActor.actor_id,
        scheduledStart: new Date(formData.scheduledStart!).toISOString(),
        scheduledEnd: formData.scheduledEnd ? new Date(formData.scheduledEnd).toISOString() : undefined,
        estimatedDurationMinutes: formData.estimatedDurationMinutes ? parseInt(formData.estimatedDurationMinutes.toString()) : undefined,
        locationAddress: formData.locationAddress || undefined,
        locationLatitude: formData.locationLatitude ? parseFloat(formData.locationLatitude.toString()) : undefined,
        locationLongitude: formData.locationLongitude ? parseFloat(formData.locationLongitude.toString()) : undefined,
        description: formData.description || undefined,
        customerNotes: formData.customerNotes || undefined,
        // Salvar referência ao evento/necessidade no metadata
        metadata: eventId ? {
          eventId,
          needId: needId || null,
          needCategory: needCategory || null,
          origin: 'event_need',
        } : undefined,
      };

      const order = await createServiceOrder(input);
      showToast('Ordem de serviço criada com sucesso', 'success');
      navigate(`/service-orders/${order.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar ordem de serviço';
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateServiceOrderInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!activeActor) {
    return (
      <div className="create-service-order-page">
        <div className="error">É necessário estar logado para criar uma ordem</div>
      </div>
    );
  }

  if (isLoadingEvent) {
    return (
      <div className="create-service-order-page">
        <div className="loading">Carregando informações do evento...</div>
      </div>
    );
  }

  return (
    <div className="create-service-order-page">
      <div className="page-header">
        <button onClick={() => eventId ? navigate(`/events/${eventId}`) : navigate('/service-orders')}>
          ← Voltar
        </button>
        <h1>
          {eventId && needCategory 
            ? `Nova Ordem de Serviço - ${needCategory}`
            : 'Nova Ordem de Serviço'
          }
        </h1>
      </div>

      {eventId && needCategory && (
        <div className="event-context-banner">
          <p>
            <strong>Origem:</strong> Necessidade do evento
            {needCategory && <span> • <strong>Categoria:</strong> {needCategory}</span>}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="service-order-form">
        <div className="form-group">
          <label htmlFor="serviceId">ID do Serviço *</label>
          <input
            id="serviceId"
            type="text"
            value={formData.serviceId || ''}
            onChange={(e) => handleChange('serviceId', e.target.value)}
            required
            placeholder="Cole o UUID do serviço aqui"
          />
          <small className="form-hint">
            Você pode encontrar o ID do serviço na página do serviço ou na lista de serviços
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="workerActorId">ID do Funcionário *</label>
          <input
            id="workerActorId"
            type="text"
            value={formData.workerActorId || ''}
            onChange={(e) => handleChange('workerActorId', e.target.value)}
            required
            placeholder="Cole o UUID do funcionário (actor) aqui"
          />
          <small className="form-hint">
            Você pode encontrar o ID do funcionário no perfil da empresa ou na lista de funcionários
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="scheduledStart">Data/Hora de Início *</label>
          <input
            id="scheduledStart"
            type="datetime-local"
            value={formData.scheduledStart || ''}
            onChange={(e) => handleChange('scheduledStart', e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="scheduledEnd">Data/Hora de Fim (opcional)</label>
          <input
            id="scheduledEnd"
            type="datetime-local"
            value={formData.scheduledEnd || ''}
            onChange={(e) => handleChange('scheduledEnd', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="estimatedDurationMinutes">Duração Estimada (minutos)</label>
          <input
            id="estimatedDurationMinutes"
            type="number"
            min="1"
            value={formData.estimatedDurationMinutes || ''}
            onChange={(e) => handleChange('estimatedDurationMinutes', e.target.value)}
            placeholder="60"
          />
        </div>

        <div className="form-group">
          <label htmlFor="locationAddress">Endereço</label>
          <input
            id="locationAddress"
            type="text"
            value={formData.locationAddress || ''}
            onChange={(e) => handleChange('locationAddress', e.target.value)}
            placeholder="Endereço completo"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="locationLatitude">Latitude</label>
            <input
              id="locationLatitude"
              type="number"
              step="any"
              value={formData.locationLatitude || ''}
              onChange={(e) => handleChange('locationLatitude', e.target.value)}
              placeholder="-23.5505"
            />
          </div>

          <div className="form-group">
            <label htmlFor="locationLongitude">Longitude</label>
            <input
              id="locationLongitude"
              type="number"
              step="any"
              value={formData.locationLongitude || ''}
              onChange={(e) => handleChange('locationLongitude', e.target.value)}
              placeholder="-46.6333"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={4}
            placeholder="Descrição do serviço a ser realizado"
          />
        </div>

        <div className="form-group">
          <label htmlFor="customerNotes">Notas do Cliente</label>
          <textarea
            id="customerNotes"
            value={formData.customerNotes || ''}
            onChange={(e) => handleChange('customerNotes', e.target.value)}
            rows={3}
            placeholder="Observações ou instruções especiais"
          />
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate('/service-orders')}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Criando...' : 'Criar Ordem'}
          </button>
        </div>
      </form>
    </div>
  );
}

