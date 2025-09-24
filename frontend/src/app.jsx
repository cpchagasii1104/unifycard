import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useAuth } from './modules/user/auth/contexts/auth-context.js';

import HomePage from './modules/unify_card/pages/home-page.jsx';
import LoginPage from './modules/user/auth/pages/login-page.jsx';
import SignupPage from './modules/user/auth/pages/signup-page.jsx';
import DashboardPage from './modules/user/dashboard/pages/dashboard-page.jsx';
import UserAccountPage from './modules/user/account/pages/user-account-page.jsx';

// ✅ Novas páginas
import SchedulePage from './modules/schedule/pages/schedule-page.jsx';
import CompanyPermissionPage from './modules/company/pages/company-permission-page.jsx';
import ProductManagementPage from './modules/product/pages/product-management-page.jsx'; // ✅ Novo

const PrivateRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();

  // ✅ Protege tanto por token (user) quanto por perfil carregado
  if (loading || !profile) {
    return <div>Carregando sessão do usuário...</div>;
  }

  return user ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />

    <Route
      path="/dashboard"
      element={
        <PrivateRoute>
          <DashboardPage />
        </PrivateRoute>
      }
    />

    <Route
      path="/minha-conta"
      element={
        <PrivateRoute>
          <UserAccountPage />
        </PrivateRoute>
      }
    />

    {/* ✅ Novas rotas privadas */}
    <Route
      path="/agenda"
      element={
        <PrivateRoute>
          <SchedulePage />
        </PrivateRoute>
      }
    />

    <Route
      path="/empresa/permissoes"
      element={
        <PrivateRoute>
          <CompanyPermissionPage />
        </PrivateRoute>
      }
    />

    <Route
      path="/empresa/produtos"
      element={
        <PrivateRoute>
          <ProductManagementPage />
        </PrivateRoute>
      }
    />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <ToastContainer autoClose={3500} position="top-center" />
    <AppRoutes />
  </BrowserRouter>
);

export default App;
