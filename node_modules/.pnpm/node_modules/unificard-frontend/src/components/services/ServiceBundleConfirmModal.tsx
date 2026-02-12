// frontend/src/components/services/ServiceBundleConfirmModal.tsx
// Modal para confirmar bundle de forma atômica

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getBundleBookings, canConfirmBundle, confirmBundle, type ConfirmBundleInput } from '../../api/service-bundles';
import { getBookingDecision } from '../../api/service-booking-decisions';
import { getService } from '../../api/services';
import { showToast } from '../common/Toast';
import type { Service } from '../../api/services';
import './ServiceBundleConfirmModal.css';

interface ServiceBundleConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bundleId: string;
}

export default function ServiceBundleConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  bundleId,
}: ServiceBundleConfirmModalProps) {
  const { activeActor } = useActiveActor();
  const [bookings, setBookings] = useState<Array<{
    bookingId: string;
    serviceId: string;
    status: string;
  }>>([]);
  const [services, setServices] = useState<Record<string, Service>>({});
  const [decisions, setDecisions] = useState<Record<string, string>>({}); // bookingId -> decisionId
  const [canConfirm, setCanConfirm] = useState(false);
  const [confirmReason, setConfirmReason] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && bundleId) {
      loadBundleData();
    }
  }, [isOpen, bundleId]);

  const loadBundleData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carregar bookings do bundle
      const bookingsData = await getBundleBookings(bundleId);
      setBookings(bookingsData);

      // Carregar serviços
      const servicesData: Record<string, Service> = {};
      for (const booking of bookingsData) {
        const service = await getService(booking.serviceId);
        servicesData[booking.serviceId] = service;
      }
      setServices(servicesData);

      // Carregar decisões para cada booking
      const decisionsData: Record<string, string> = {};
      for (const booking of bookingsData) {
        try {
          const decision = await getBookingDecision(booking.serviceId, booking.bookingId);
          if (decision && decision.status === 'accepted') {
            decisionsData[booking.bookingId] = decision.decisionId;
          }
        } catch (err) {
          // Decisão não encontrada ou não aceita
        }
      }
      setDecisions(decisionsData);

      // Verificar se pode confirmar
      const confirmCheck = await canConfirmBundle(bundleId);
      setCanConfirm(confirmCheck.canConfirm);
      setConfirmReason(confirmCheck.reason);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do bundle');
      showToast(err.message || 'Erro ao carregar dados do bundle', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!activeActor) {
      showToast('Nenhum ator ativo para confirmar bundle.', 'error');
      return;
    }

    if (!canConfirm) {
      showToast(confirmReason || 'Bundle não pode ser confirmado', 'error');
      return;
    }

    const bookingIds = bookings.map(b => b.bookingId);
    const decisionIds = bookingIds.map(id => decisions[id]).filter(Boolean);

    if (decisionIds.length !== bookingIds.length) {
      showToast('Nem todos os bookings têm decisão ACCEPTED', 'error');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: ConfirmBundleInput = {
        bundleId,
        bookingIds,
        decisionIds,
      };

      const result = await confirmBundle(input);

      showToast('Bundle confirmado com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao confirmar bundle');
      showToast(err.message || 'Erro ao confirmar bundle', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="service-bundle-confirm-modal-overlay" onClick={onClose}>
      <div className="service-bundle-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirmar Bundle de Serviços</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {isLoading ? (
            <div className="loading">Carregando dados do bundle...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <>
              <div className="bundle-warning-section">
                <div className={`warning-box ${canConfirm ? 'warning-success' : 'warning-error'}`}>
                  {canConfirm ? (
                    <>
                      <strong>✅ Bundle pronto para confirmação</strong>
                      <p>Todos os bookings têm decisão ACCEPTED. Ao confirmar, todos os service orders serão criados de forma atômica.</p>
                    </>
                  ) : (
                    <>
                      <strong>⚠️ Bundle não pode ser confirmado</strong>
                      <p>{confirmReason || 'Nem todos os bookings têm decisão ACCEPTED'}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="bookings-list">
                <h3>Serviços do Bundle</h3>
                {bookings.map((booking) => {
                  const service = services[booking.serviceId];
                  const hasDecision = !!decisions[booking.bookingId];

                  return (
                    <div key={booking.bookingId} className="booking-item">
                      <div className="booking-header">
                        <h4>{service?.name || booking.serviceId}</h4>
                        <span className={`status-badge ${hasDecision ? 'status-accepted' : 'status-pending'}`}>
                          {hasDecision ? '✓ Aceito' : '⏳ Pendente'}
                        </span>
                      </div>
                      {service && (
                        <p className="service-description">{service.description || 'Sem descrição'}</p>
                      )}
                      <p className="booking-id">Booking: {booking.bookingId.substring(0, 8)}...</p>
                    </div>
                  );
                })}
              </div>

              <div className="confirmation-impact">
                <h3>Impacto da Confirmação</h3>
                <ul>
                  <li>✅ {bookings.length} Service Order(s) serão criados</li>
                  <li>✅ Agenda será bloqueada para todos os serviços</li>
                  <li>✅ Todos os bookings serão vinculados ao bundle</li>
                  <li>⚠️ Confirmação é atômica: todos ou nenhum</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={isSubmitting || !canConfirm}
          >
            {isSubmitting ? 'Confirmando...' : 'Confirmar Bundle'}
          </button>
        </div>
      </div>
    </div>
  );
}

