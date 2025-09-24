// /unifycard/frontend/src/modules/company/services/company-service.js

import api from '../../../services/api';

// 📄 Buscar empresa por ID
export const getCompanyById = async (companyId) => {
  const res = await api.get(`/company/${companyId}`);
  return res.data;
};

// ✏️ Atualizar dados do perfil
export const updateCompanyProfile = async (companyId, profileData) => {
  const res = await api.put(`/company/${companyId}/profile`, profileData);
  return res.data;
};

// 🗺️ Atualizar endereço da empresa
export const updateCompanyAddress = async (companyId, addressData) => {
  const res = await api.put(`/company/${companyId}/address`, addressData);
  return res.data;
};

// 🖼️ Upload de imagem (perfil ou capa)
export const uploadCompanyImage = async (companyId, formData) => {
  const res = await api.post(`/company/${companyId}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// 👥 Atualizar permissões de funcionário
export const updateEmployeePermissions = async (companyId, employeeId, permissions) => {
  const res = await api.put(`/company/${companyId}/employee/${employeeId}/permissions`, permissions);
  return res.data;
};

// 🗓️ Criar novo horário
export const createSchedule = async (companyId, scheduleData) => {
  const res = await api.post(`/schedule`, {
    ...scheduleData,
    companyId,
  });
  return res.data;
};
