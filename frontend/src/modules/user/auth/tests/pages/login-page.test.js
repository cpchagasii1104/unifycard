import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import LoginPage from '../../pages/login-page.jsx';
import AuthService from '../../services/auth-service.js';

// Mock do AuthService para não chamar a API real
jest.mock('../../services/auth-service.js');

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza todos os campos do formulário', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('envia o formulário de login com sucesso', async () => {
    AuthService.login.mockResolvedValueOnce({ token: 'abc', user: { email: 'x@y.com' } });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com', name: 'email' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: '12345678', name: 'password' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(AuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: '12345678'
      });
      expect(screen.getByText(/login successful/i)).toBeInTheDocument();
    });
  });

  it('exibe mensagem de erro ao falhar no login', async () => {
    AuthService.login.mockRejectedValueOnce({ response: { data: { message: 'Invalid email or password' } } });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'fail@example.com', name: 'email' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass', name: 'password' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });
});
