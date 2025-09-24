import api from '../../../services/api';

/**
 * Busca o perfil do usuário com endereço e dados do Raio-X (dashboard).
 */
export async function getUserDashboardProfile(token) {
  const response = await api.get('/user/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.profile || response.data;
}

/**
 * Busca o perfil do usuário por ID (rota direta /user-profile/:id).
 */
export async function getUserProfile(token, userProfileId) {
  const response = await api.get(`/user-profile/${userProfileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.profile || response.data;
}

/**
 * Atualiza o perfil do usuário.
 */
export async function updateUserProfile(userProfileId, payload, token) {
  const response = await api.put(`/user-profile/${userProfileId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.profile;
}

/**
 * Verifica vínculo atual com empresa.
 */
export async function getUserCompanyLink(userId) {
  const response = await api.get(`/user/${userId}/company`);
  return response.data;
}

/**
 * Lista empresas disponíveis para vínculo.
 */
export async function getAvailableCompanies() {
  const response = await api.get('/companies/available');
  return response.data;
}

/**
 * Atualiza vínculo do usuário com empresa.
 */
export async function updateUserCompanyLink(userId, payload) {
  const response = await api.put(`/user/${userId}/company`, payload);
  return response.data;
}
