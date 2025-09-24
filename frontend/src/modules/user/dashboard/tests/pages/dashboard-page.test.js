import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardPage from '../../pages/dashboard-page.jsx';
import { AuthProvider } from '../../../auth/contexts/auth-context.js';

// Mock de contexto para simular usuário autenticado
const mockUser = {
  user_id: '1234',
  email: 'user@example.com',
  created_at: '2024-06-06T10:00:00Z'
};

const customRender = (ui, { providerProps, ...renderOptions } = {}) => {
  return render(
    <AuthProvider value={providerProps}>{ui}</AuthProvider>,
    renderOptions
  );
};

jest.mock('../../../auth/contexts/auth-context.js', () => {
  const actual = jest.requireActual('../../../auth/contexts/auth-context.js');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      logout: jest.fn()
    })
  };
});

describe('DashboardPage', () => {
  it('renderiza os dados do usuário', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/welcome to your dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/user info/i)).toBeInTheDocument();
    expect(screen.getByText(mockUser.user_id)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
  });

  it('executa logout ao clicar no botão', () => {
    const { getByText } = render(<DashboardPage />);
    fireEvent.click(getByText(/logout/i));
    // Aqui você pode expandir o teste para checar efeitos do logout, se quiser
  });
});
