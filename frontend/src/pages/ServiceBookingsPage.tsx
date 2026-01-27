// src/pages/ServiceBookingsPage.tsx
// Lista de Reservas do Serviço
// SPRINT: Services MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  listServiceBookings,
  updateServiceBooking,
  type ServiceBooking,
  type BookingStatus,
} from '../api/service-bookings';
import { getService } from '../api/services';
import { getActorName } from '../utils/service-orders-helpers';
import { showToast } from '../components/common/Toast';
import './ServiceBookingsPage.css';

export default function ServiceBookingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [serviceName, setServiceName] = useState<string>('');
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [requesterNames, setRequesterNames] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (id) {
      loadService();
      loadBookings();
    }
  }, [id, statusFilter]);

  useEffect(() => {
    if (bookings.length > 0) {
      loadRequesterNames();
    }
  }, [bookings]);

  const loadService = async () => {
    if (!id) return;
    try {
      const service = await getService(id);
      setServiceName(service.name);
    } catch (err) {
      console.error('Erro ao carregar serviço:', err);
    }
  };

  const loadBookings = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;

      const data = await listServiceBookings(id, filters);
      setBookings(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar reservas');
      showToast(err.message || 'Erro ao carregar reservas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRequesterNames = async () => {
    const names: Record<string, string | null> = {};
    for (const booking of bookings) {
      try {
        const name = await getActorName(booking.requesterActorId);
        names[booking.requesterActorId] = name;
      } catch (err) {
        names[booking.requesterActorId] = null;
      }
    }
    setRequesterNames(names);
  };

  const handleCancel = async (booking: ServiceBooking) => {
    if (!id) return;
    if (!window.confirm('Tem certeza que deseja cancelar esta reserva?')) {
      return;
    }

    try {
      await updateServiceBooking(id, booking.bookingId, {
        status: 'cancelled',
      });
      showToast('Reserva cancelada com sucesso', 'success');
      loadBookings();
    } catch (err: any) {
      showToast(err.message || 'Erro ao cancelar reserva', 'error');
    }
  };

  const getStatusLabel = (status: BookingStatus): string => {
    const labels: Record<BookingStatus, string> = {
      requested: 'Solicitado',
      cancelled: 'Cancelado',
      expired: 'Expirado',
    };
    return labels[status] || status;
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="service-bookings-page">
        <div className="loading">Carregando reservas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="service-bookings-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadBookings}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="service-bookings-page">
      <div className="page-header">
        <button onClick={() => navigate(`/services/${id}`)}>← Voltar</button>
        <h1>Reservas: {serviceName}</h1>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="requested">Solicitado</option>
            <option value="cancelled">Cancelado</option>
            <option value="expired">Expirado</option>
          </select>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma reserva encontrada.</p>
        </div>
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => (
            <div key={booking.bookingId} className="booking-item">
              <div className="booking-info">
                <div className="booking-requester">
                  <strong>Solicitante:</strong>{' '}
                  {requesterNames[booking.requesterActorId] ||
                    `${booking.requesterActorId.substring(0, 8)}...`}
                </div>
                <div className="booking-dates">
                  <strong>Solicitado em:</strong> {formatDateTime(booking.requestedAt)}
                  {booking.cancelledAt && (
                    <>
                      <br />
                      <strong>Cancelado em:</strong> {formatDateTime(booking.cancelledAt)}
                    </>
                  )}
                  {booking.expiredAt && (
                    <>
                      <br />
                      <strong>Expirado em:</strong> {formatDateTime(booking.expiredAt)}
                    </>
                  )}
                </div>
                {booking.notes && (
                  <div className="booking-notes">
                    <strong>Notas:</strong> {booking.notes}
                  </div>
                )}
                <div className="booking-meta">
                  <span className={`booking-status status-${booking.status}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </div>
              </div>
              {booking.status === 'requested' && (
                <div className="booking-actions">
                  <button
                    onClick={() => handleCancel(booking)}
                    className="btn-cancel"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




