// ✅ Todas as chamadas agora usam caminhos relativos à baseURL definida no axios.defaults.baseURL
import axios from 'axios';

const AuthService = {
  /**
   * Cadastro de usuário
   * @param {Object} data - Dados do formulário de cadastro
   * @returns {Promise<Object>}
   */
  async signup(data) {
    const response = await axios.post('/signup', data);
    return response.data;
  },

  /**
   * Login de usuário
   * @param {Object} data - { email, password }
   * @returns {Promise<Object>} // { user, token, ... }
   */
  async login(data) {
    const response = await axios.post('/login', data);
    return response.data;
  },

  /**
   * Consulta os dados do dashboard do usuário logado
   * @returns {Promise<Object>} // { user, regionalAccount, saldo, etc. }
   */
  async getUserDashboard() {
    const response = await axios.get('/user/dashboard');
    return response.data;
  },
};

export default AuthService;
