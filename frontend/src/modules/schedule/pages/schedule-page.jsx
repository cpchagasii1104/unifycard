// /unifycard/frontend/src/modules/schedule/pages/schedule-page.jsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../user/auth/contexts/auth-context';
import { getCompanyBookings } from '../services/schedule-service';

import styles from '../styles/schedule-page.module.css';

const SchedulePage = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const data = await getCompanyBookings(user.companyId);
      setBookings(data);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.companyId) {
      fetchBookings();
    }
  }, [user]);

  if (loading) return <div className={styles.loading}>Carregando agenda...</div>;

  return (
    <div className={styles.container}>
      <h1>Agenda da Empresa</h1>

      {bookings.length === 0 ? (
        <p>Nenhum agendamento encontrado.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Horário</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Serviço</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.scheduleBookingId}>
                <td>{booking.date}</td>
                <td>{`${booking.startTime} - ${booking.endTime}`}</td>
                <td>{booking.user?.name || '—'}</td>
                <td>{booking.status}</td>
                <td>{booking.schedule?.title || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SchedulePage;
