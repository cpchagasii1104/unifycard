// src/components/events/EventBookingConfirmationModal.tsx
// Modal de Confirmação de Booking Aceito
// Permite ao organizador confirmar a contratação após o prestador aceitar

import { useState, useEffect } from 'react';
import { confirmBookingFromDecision } from '../../api/service-orders';
import { getService } from '../../api/services';
import { getEvent } from '../../api/events';
import { showToast } from '../common/Toast';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import type { ServiceBookingDecision } from '../../api/service-booking-decisions';
import './EventBookingConfirmationModal.css';

export interface EventBookingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bookingId: string;
  decision: ServiceBookingDecision;
  eventId: string;
  serviceId: string;
}

export default function EventBookingConfirmationModal({
  isOpen,
  onClose,
  onSuccess,
  bookingId,
  decision,
  eventId,
  serviceId,
}: EventBookingConfirmationModalProps) {
  const { activeActor } = useActiveActor();
  const [isLoading, setIsLoading] = useState(false);
  const [service, setService] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);

  // Carregar dados ao abrir
  useEffect(() => {
    if (isOpen && !service) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [serviceData, eventData] = await Promise.all([
        getService(serviceId),
        getEvent(eventId),
      ]);
      setService(serviceData);
      setEvent(eventData);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!activeActor) {
      showToast('Actor não encontrado', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await confirmBookingFromDecision(bookingId, decision.decisionId);
      showToast('Contratação confirmada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Erro ao confirmar contratação', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="event-booking-confirmation-modal-overlay" onClick={onClose}>
      <div className="event-booking-confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-booking-confirmation-modal-header">
          <h2>Confirmar Contratação</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="event-booking-confirmation-modal-content">
          <div className="confirmation-warning">
            <strong>⚠️ Esta ação confirma a contratação</strong>
            <p>Após confirmar, a agenda será bloqueada e o serviço será listado como "Confirmado" no evento.</p>
          </div>

          {isLoading && !service ? (
            <div className="loading">Carregando dados...</div>
          ) : (
            <>
              <div className="confirmation-summary">
                <h3>Resumo do Acordo</h3>
                <div className="summary-item">
                  <strong>Serviço:</strong>
                  <span>{service?.name || serviceId}</span>
                </div>
                {event && (
                  <div className="summary-item">
                    <strong>Evento:</strong>
                    <span>{event.title}</span>
                  </div>
                )}
                {decision.decidedAt && (
                  <div className="summary-item">
                    <strong>Data do Aceite:</strong>
                    <span>{formatDate(decision.decidedAt)}</span>
                  </div>
                )}
                {decision.reason && (
                  <div className="summary-item">
                    <strong>Observações do Prestador:</strong>
                    <span>{decision.reason}</span>
                  </div>
                )}
              </div>

              <div className="confirmation-actions">
                <button
                  className="btn-cancel"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  className="btn-confirm"
                  onClick={handleConfirm}
                  disabled={isLoading}
                >
                  {isLoading ? 'Confirmando...' : 'Confirmar Contratação'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

