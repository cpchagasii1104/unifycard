import React, { useEffect, useState, useContext } from 'react';
import { useAuth } from 'modules/user/auth/contexts/auth-context';
import { getCompanyBookings } from '../services/schedule-service';

import styles from '../styles/schedule-calendar.module.css';

const ScheduleCalendar = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const data = await getCompanyBookings(user.companyId);
      setBookings(data);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.companyId) {
      fetchBookings();
    }
  }, [user]);

  const filtered = bookings.filter((b) => b.date === selectedDate);

  return (
    <div className={styles.container}>
      <h2>Calendar View</h2>

      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className={styles.datePicker}
      />

      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p>No bookings for selected date.</p>
      ) : (
        <ul className={styles.bookingList}>
          {filtered.map((booking) => (
            <li key={booking.scheduleBookingId}>
              <strong>{booking.startTime} - {booking.endTime}</strong> — {booking.user?.name || 'Client'} ({booking.status})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ScheduleCalendar;
