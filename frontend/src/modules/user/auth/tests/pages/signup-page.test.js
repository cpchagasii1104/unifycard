import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import SignupPage from '../../pages/signup-page.jsx';
import AuthService from '../../services/auth-service.js';

// Mock do AuthService para evitar chamadas reais à API
jest.mock('../../services/auth-service.js');

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza todos os campos de formulário', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
  });

  it('valida e envia o formulário com sucesso', async () => {
    AuthService.signup.mockResolvedValueOnce({ success: true });

    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com', name: 'email' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: '12345678', name: 'password' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(AuthService.signup).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: '12345678',
        phone: ''
      });
      expect(screen.getByText(/user registered successfully/i)).toBeInTheDocument();
    });
  });

  it('exibe mensagem de erro ao falhar no cadastro', async () => {
    AuthService.signup.mockRejectedValueOnce({ response: { data: { message: 'Email already registered' } } });

    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'exists@example.com', name: 'email' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: '12345678', name: 'password' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
  });
});
