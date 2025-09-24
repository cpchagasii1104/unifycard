// /frontend/src/modules/user/hooks/use-signup.js

import { useContext } from 'react';
import { AuthContext } from '../contexts/auth-context.js';
import AuthService from '../services/auth-service.js';

export const useSignup = () => {
  const { login } = useContext(AuthContext);

  const signup = async (data) => {
    const res = await AuthService.signup(data);
    login(res.user, res.token);
  };

  return { signup };
};
