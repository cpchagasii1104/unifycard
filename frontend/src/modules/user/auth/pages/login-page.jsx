import React, { useState } from 'react';
import { useAuth } from '../contexts/auth-context.js';
import AuthService from '../services/auth-service.js';
import { useNavigate } from 'react-router-dom';
import styles from './login-page.module.css';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // 🚨 Corrigido: chamada agora garante /api/login minúsculo
      const data = await AuthService.login({
        email: form.email,
        password: form.password
      });

      // ✅ Atualiza usuário no contexto global
      login(data.user, data.token);
      setSuccess('Login realizado com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 600);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Login falhou. Verifique seu e-mail e senha.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles['login-page-container']}>
      <h2>Entrar na plataforma</h2>
      <form onSubmit={handleSubmit} className={styles['login-form']}>
        <label>
          E-mail
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
            maxLength={255}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={8}
            maxLength={128}
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      {error && <div className={styles['login-error']}>{error}</div>}
      {success && <div className={styles['login-success']}>{success}</div>}
      <p className={styles['login-link']}>
        Não tem conta? <span onClick={() => navigate('/signup')}>Cadastre-se</span>
      </p>
      <p className={styles['home-link']}>
        Voltar para <span onClick={() => navigate('/')}>Página inicial</span>
      </p>
    </div>
  );
};

export default LoginPage;
