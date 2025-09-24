import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getUserDashboardProfile } from '../../../user/services/user-service';

axios.defaults.baseURL = 'http://localhost:3001/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    setUser(null);
    setProfile(null);
    setToken('');
    localStorage.clear();
  };

  const fetchProfileFromBackend = async (savedToken) => {
    try {
      const response = await getUserDashboardProfile(savedToken);
      const raw = response?.profile || response; // 👈 corrigido aqui!

      if (raw?.user_id) {
        const simplifiedUser = {
          user_id: raw.user_id,
          email: raw.email,
          referral_code: raw.referral_code || '',
          regional_account_id: raw.regional_account_id || '',
          unify_bank_account_id: raw.unify_bank_account_id || '',
          card_id: raw.card_id || '',
        };

        const mappedProfile = {
          ...raw,
          cpf: raw.masked_cpf || raw.cpf || '',
          birth_date: raw.birth_date || '',
          gender_identity: raw.gender_identity || '',
          biological_sex: raw.biological_sex || '',
          function_codes: Array.isArray(raw.function_codes) ? raw.function_codes : [],
          hobby_codes: Array.isArray(raw.hobby_codes) ? raw.hobby_codes : [],
          preferences: raw.preferences || '',
          neighborhood: raw.neighborhood || '',
          city_name: raw.city_name || '',
          state_name: raw.state_name || '',
          street: raw.street || '',
          number: raw.number || '',
          complement: raw.complement || '',
          cep: raw.cep || '',
          referral_code: raw.referral_code || '',
        };

        setUser(simplifiedUser);
        setProfile(mappedProfile);

        localStorage.setItem('token', savedToken);
        localStorage.setItem('user', JSON.stringify(simplifiedUser));
        localStorage.setItem('profile', JSON.stringify(mappedProfile));
      } else {
        clearSession();
      }
    } catch (err) {
      console.error('[AuthContext] Erro ao buscar perfil:', err);
      clearSession();
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async () => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      clearSession();
      setLoading(false);
      return;
    }

    try {
      const cachedProfile = localStorage.getItem('profile');
      const parsedProfile = cachedProfile ? JSON.parse(cachedProfile) : null;

      const cpfExists = parsedProfile?.cpf;

      if (!cpfExists) {
        await fetchProfileFromBackend(savedToken);
      } else {
        setUser(JSON.parse(localStorage.getItem('user')));
        setProfile(parsedProfile);
        setToken(savedToken);
      }
    } catch (err) {
      console.error('[AuthContext] Erro ao carregar sessão:', err);
      clearSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const login = async (profileData, jwtToken) => {
    localStorage.setItem('token', jwtToken);
    setToken(jwtToken);
    await fetchProfileFromBackend(jwtToken);
  };

  const refreshProfile = async () => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      await fetchProfileFromBackend(savedToken);
    }
  };

  const logout = () => {
    clearSession();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        login,
        logout,
        loading,
        setProfile,
        setUser,
        refreshProfile,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
