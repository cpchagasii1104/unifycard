// frontend/src/components/events/EventRFQCreateModal.tsx
// Modal para criar RFQ (Request for Quotation)
// 🔴 BLINDAGEM: NÃO cria booking automaticamente
// 🔴 BLINDAGEM: NÃO aceita proposta automaticamente

import { useState, useEffect } from 'react';
import { createEventRFQ, type CreateEventRFQInput, type RFQItem, type RFQCriteria } from '../../api/event-rfq';
import { getEventById } from '../../api/events';
import { discoverServices, type DiscoveredService } from '../../api/service-discovery';
import { showToast } from '../common/Toast';
import type { EventNeed } from './EventNeedsList';
import './EventRFQCreateModal.css';

interface EventRFQCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (rfqId: string) => void;
  eventId: string;
  eventNeeds?: EventNeed[];
  selectedServices?: DiscoveredService[];
}

export default function EventRFQCreateModal({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  eventNeeds = [],
  selectedServices = [],
}: EventRFQCreateModalProps) {
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<RFQCriteria>({
    expectedPriceCents: null,
    date: null,
    location: null,
    locationLatitude: null,
    locationLongitude: null,
    notes: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    if (isOpen && eventId) {
      loadEvent();
    }
  }, [isOpen, eventId]);

  const loadEvent = async () => {
    try {
      const eventData = await getEventById(eventId);
      setEvent(eventData.event);
      
      // Pré-preencher critérios com dados do evento
      if (eventData.event.datetime_start) {
        setCriteria(prev => ({
          ...prev,
          date: eventData.event.datetime_start,
        }));
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar evento', 'error');
    }
  };

  const handleSubmit = async () => {
    // Validar que pelo menos um item foi selecionado
    if (selectedNeeds.length === 0 && selectedServiceIds.length === 0) {
      setError('Selecione pelo menos uma necessidade ou serviço');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Construir items
      const items: RFQItem[] = [];

      // Adicionar necessidades selecionadas
      for (const needId of selectedNeeds) {
        const need = eventNeeds.find(n => n.id === needId);
        if (need) {
          items.push({
            type: 'need',
            id: need.id,
            category: need.category,
            description: need.description,
          });
        }
      }

      // Adicionar serviços selecionados
      for (const serviceId of selectedServiceIds) {
        items.push({
          type: 'service',
          id: serviceId,
        });
      }

      const input: CreateEventRFQInput = {
        items,
        criteria,
      };

      const result = await createEventRFQ(eventId, input);

      showToast('RFQ criado com sucesso!', 'success');
      onSuccess(result.rfq.rfqId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar RFQ');
      showToast(err.message || 'Erro ao criar RFQ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="event-rfq-create-modal-overlay" onClick={onClose}>
      <div className="event-rfq-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Criar RFQ (Solicitação de Orçamento)</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="rfq-section">
            <h3>Selecionar Itens</h3>
            
            {eventNeeds.length > 0 && (
              <div className="needs-selection">
                <h4>Necessidades do Evento</h4>
                {eventNeeds.map((need) => (
                  <label key={need.id} className="selection-item">
                    <input
                      type="checkbox"
                      checked={selectedNeeds.includes(need.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedNeeds([...selectedNeeds, need.id]);
                        } else {
                          setSelectedNeeds(selectedNeeds.filter(id => id !== need.id));
                        }
                      }}
                    />
                    <span>
                      <strong>{need.category}</strong>
                      {need.description && <span className="item-description"> - {need.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {selectedServices.length > 0 && (
              <div className="services-selection">
                <h4>Serviços Selecionados</h4>
                {selectedServices.map((service) => (
                  <label key={service.serviceId} className="selection-item">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(service.serviceId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedServiceIds([...selectedServiceIds, service.serviceId]);
                        } else {
                          setSelectedServiceIds(selectedServiceIds.filter(id => id !== service.serviceId));
                        }
                      }}
                    />
                    <span>
                      <strong>{service.name}</strong>
                      {service.shortDescription && <span className="item-description"> - {service.shortDescription}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {eventNeeds.length === 0 && selectedServices.length === 0 && (
              <div className="empty-selection">
                <p>Nenhuma necessidade ou serviço disponível. Adicione necessidades ao evento ou selecione serviços primeiro.</p>
              </div>
            )}
          </div>

          <div className="rfq-section">
            <h3>Critérios do RFQ</h3>
            
            <div className="form-group">
              <label>Preço Esperado (opcional)</label>
              <input
                type="number"
                value={criteria.expectedPriceCents || ''}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    expectedPriceCents: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Valor em centavos"
              />
            </div>

            <div className="form-group">
              <label>Data do Evento</label>
              <input
                type="date"
                value={criteria.date ? criteria.date.split('T')[0] : ''}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    date: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Localização (opcional)</label>
              <input
                type="text"
                value={criteria.location || ''}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    location: e.target.value || null,
                  })
                }
                placeholder="Endereço completo"
              />
            </div>

            <div className="form-group">
              <label>Observações (opcional)</label>
              <textarea
                value={criteria.notes || ''}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    notes: e.target.value || null,
                  })
                }
                rows={3}
                placeholder="Informações adicionais para os prestadores..."
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || (selectedNeeds.length === 0 && selectedServiceIds.length === 0)}
          >
            {isSubmitting ? 'Criando...' : 'Criar RFQ'}
          </button>
        </div>
      </div>
    </div>
  );
}




