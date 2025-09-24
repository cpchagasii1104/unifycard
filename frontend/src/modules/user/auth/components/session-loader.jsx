// C:\unifycard\frontend\src\modules\user\auth\components\session-loader.jsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/auth-context';

const SessionLoader = ({ children }) => {
  const { token, setProfile, setUser } = useAuth();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setLoaded(true);
        return;
      }

      try {
        const res = await axios.get('/api/user/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const raw = res.data?.profile;
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
            neighborhood: raw.neighborhood || '',
            city_name: raw.city_name || '',
            state_name: raw.state_name || '',
          };

          setUser(simplifiedUser);
          setProfile(mappedProfile);
          localStorage.setItem('user', JSON.stringify(simplifiedUser));
          localStorage.setItem('profile', JSON.stringify(mappedProfile));
        } else {
          throw new Error('Usuário inválido');
        }
      } catch (err) {
        console.warn('[SessionLoader] Sessão inválida. Limpando...');
        setUser(null);
        setProfile(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('profile');
      } finally {
        setLoaded(true);
      }
    };

    fetchProfile();
  }, [token, setUser, setProfile]);

  if (!loaded) return <div>Carregando sessão...</div>;

  return children;
};

export default SessionLoader;
