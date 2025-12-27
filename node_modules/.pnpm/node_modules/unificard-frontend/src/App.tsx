// src/App.tsx
// App funcional com React Router - 3 Layouts: Social, Bank, Admin
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import SocialLedger from './components/social/SocialLedger';
import CompanyValidationBackoffice from './components/CompanyValidationBackoffice';
import RegionalFundUser from './components/RegionalFundUser';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SocialLayout from './components/layout/SocialLayout';
import BankLayout from './components/layout/BankLayout';
import AdminLayout from './components/layout/AdminLayout';
import { SessionProvider, useSession } from './contexts/SessionProvider';
import FullScreenLoading from './components/FullScreenLoading';
import OnboardingWrapper from './components/onboarding/OnboardingWrapper';
import DashboardPage from './pages/DashboardPage';
import PerfilPage from './pages/PerfilPage';
import EmpresasPage from './pages/EmpresasPage';
import GruposPage from './pages/GruposPage';
import GrupoNovoPage from './pages/GrupoNovoPage';
import GrupoDetailPage from './pages/GrupoDetailPage';
import WalletPage from './pages/WalletPage';
import TransactionDetailPage from './pages/TransactionDetailPage';
import SocialProfilePage from './pages/SocialProfilePage';
import SocialCompanyPage from './pages/SocialCompanyPage';
import EventDetailPage from './pages/EventDetailPage';
import SocialPage from './pages/SocialPage';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import EmDesenvolvimentoPage from './pages/EmDesenvolvimentoPage';
import VotesPage from './pages/VotesPage';
import AssistantPage from './pages/AssistantPage';
import ServicosPage from './pages/ServicosPage';
import { isAuthenticated } from './config/auth';
import './App.css';
import './styles/global.css';

// Componente wrapper para Login/Register com navegação
function AuthWrapper() {
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    navigate('/home');
  };

  const handleRegisterSuccess = () => {
    navigate('/home');
  };

  if (currentView === 'register') {
    return (
      <Register
        onRegisterSuccess={handleRegisterSuccess}
        onBackToLogin={() => setCurrentView('login')}
      />
    );
  }

  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      onGoToRegister={() => setCurrentView('register')}
    />
  );
}

// Listener para navegação para banco via evento customizado
function WalletNavigationListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigateToWallet = () => {
      navigate('/banco');
    };

    window.addEventListener('navigate-to-wallet', handleNavigateToWallet);
    return () => {
      window.removeEventListener('navigate-to-wallet', handleNavigateToWallet);
    };
  }, [navigate]);

  return null;
}

// Componente interno que precisa de SessionProvider
function AppContent() {
  const { sessionReady } = useSession();

  // Bloquear renderização até bootstrap estar pronto
  if (!sessionReady) {
    return <FullScreenLoading />;
  }

  return (
    <>
      <WalletNavigationListener />
      <OnboardingWrapper>
        <Routes>
          {/* Rotas públicas */}
          <Route 
            path="/login" 
            element={isAuthenticated() ? <Navigate to="/home" replace /> : <AuthWrapper />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated() ? <Navigate to="/home" replace /> : <AuthWrapper />} 
          />

          {/* Rota Home (sem layout específico) */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />

          {/* Rota Em Desenvolvimento */}
          <Route
            path="/em-desenvolvimento"
            element={
              <ProtectedRoute>
                <EmDesenvolvimentoPage />
              </ProtectedRoute>
            }
          />

          {/* Rota de Busca */}
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />

          {/* Rotas protegidas - Layout Social (DEFAULT) */}
          <Route
            element={
              <ProtectedRoute>
                <SocialLayout />
              </ProtectedRoute>
            }
          >
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="social" element={<SocialPage />} />
          <Route path="grupos" element={<GruposPage />} />
          <Route path="grupos/:id" element={<GrupoDetailPage />} />
          <Route path="feed" element={<SocialPage />} />
          <Route path="votacoes" element={<VotesPage />} />
          <Route path="votes" element={<VotesPage />} />
          <Route path="servicos" element={<ServicosPage />} />
          <Route path="impacto" element={<div style={{ padding: '2rem' }}><h1>Impacto</h1><p>Em breve...</p></div>} />
          <Route path="ledger" element={<SocialLedger />} />
          <Route path="profile/:id" element={<SocialProfilePage />} />
          <Route path="company/:id" element={<SocialCompanyPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="assistant" element={<AssistantPage />} />
        </Route>

        {/* Rotas protegidas - Layout Financeiro (Bank) */}
        <Route
          element={
            <ProtectedRoute>
              <BankLayout />
            </ProtectedRoute>
          }
        >
          <Route path="banco" element={<WalletPage />} />
          <Route path="bank" element={<WalletPage />} />
          <Route path="extrato" element={<div style={{ padding: '2rem' }}><h1>Extrato</h1><p>Em breve...</p></div>} />
          <Route path="fundo-regional" element={<RegionalFundUser />} />
          {/* Compatibilidade */}
          <Route path="wallet" element={<WalletPage />} />
          <Route path="fund" element={<RegionalFundUser />} />
          <Route path="transaction/:id" element={<TransactionDetailPage />} />
        </Route>

        {/* Rotas protegidas - Layout Administrativo */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="empresas" element={<EmpresasPage />} />
          <Route path="grupos/novo" element={<GrupoNovoPage />} />
          <Route path="validation" element={<CompanyValidationBackoffice />} />
          {/* Compatibilidade */}
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
      </OnboardingWrapper>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;






