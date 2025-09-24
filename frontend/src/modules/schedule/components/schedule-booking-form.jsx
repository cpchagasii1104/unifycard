import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import {
  getCompanySchedules,
  bookSchedule,
} from '../services/schedule-service';

import styles from '../styles/schedule-booking-form.module.css';

const ScheduleBookingForm = () => {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    scheduleId: '',
    date: '',
    notes: '',
  });

  const [schedules, setSchedules] = useState([]);
  const [success, setSuccess] = useState(false);

  const fetchSchedules = async () => {
    try {
      const data = await getCompanySchedules(user.companyId);
      setSchedules(data);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  };

  useEffect(() => {
    if (user?.companyId) {
      fetchSchedules();
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await bookSchedule(user.userId, {
        ...form,
        userId: user.userId,
      });
      setForm({ scheduleId: '', date: '', notes: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3>Book a Schedule</h3>

      <label>
        Schedule:
        <select
          name="scheduleId"
          value={form.scheduleId}
          onChange={handleChange}
          required
        >
          <option value="">Select a time slot</option>
          {schedules.map((s) => (
            <option key={s.scheduleId} value={s.scheduleId}>
              {`${s.title || 'Slot'} - ${s.dayOfWeek} ${s.startTime} to ${s.endTime}`}
            </option>
          ))}
        </select>
      </label>

      <label>
        Date:
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Notes (optional):
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows="3"
        />
      </label>

      <button type="submit">Confirm Booking</button>

      {success && <p className={styles.success}>Booking created!</p>}
    </form>
  );
};

export default ScheduleBookingForm;
