// /unifycard/frontend/src/modules/schedule/services/schedule-service.js

import api from '../../../services/api';

// 🔁 Horários base (schedules)

// Criar novo horário
export const createSchedule = async (companyId, scheduleData) => {
  const res = await api.post('/schedule', {
    ...scheduleData,
    companyId,
  });
  return res.data;
};

// Buscar horários cadastrados por empresa
export const getCompanySchedules = async (companyId) => {
  const res = await api.get(`/schedule/company/${companyId}`);
  return res.data;
};

// Atualizar horário base
export const updateSchedule = async (scheduleId, updateData) => {
  const res = await api.put(`/schedule/${scheduleId}`, updateData);
  return res.data;
};

// Deletar horário base
export const deleteSchedule = async (scheduleId) => {
  const res = await api.delete(`/schedule/${scheduleId}`);
  return res.data;
};

// 📅 Agendamentos (bookings)

// Criar agendamento para um usuário
export const bookSchedule = async (userId, bookingData) => {
  const res = await api.post('/schedule/booking', {
    ...bookingData,
    userId,
  });
  return res.data;
};

// Buscar agendamentos por empresa
export const getCompanyBookings = async (companyId) => {
  const res = await api.get(`/schedule/booking/company/${companyId}`);
  return res.data;
};

// Atualizar status do agendamento
export const updateBookingStatus = async (bookingId, status) => {
  const res = await api.put(`/schedule/booking/${bookingId}/status`, { status });
  return res.data;
};
