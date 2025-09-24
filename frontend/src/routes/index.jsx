import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import LoginPage from '../modules/user/auth/pages/login-page.jsx';
import SignUpPage from '../modules/user/auth/pages/signup-page.jsx';
import DashboardPage from '../modules/user/dashboard/pages/dashboard-page.jsx';
import UserAccountPage from '../modules/user/account/pages/user-account-page.jsx';

import AdminDashboardUnifyCard from '../pages/admin/unify-card/dashboard-page.jsx';

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div>Bem-vindo à homepage</div>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/minha-conta" element={<UserAccountPage />} />

        {/* ✅ ROTA CORRETA PARA ADMIN UNIFYCARD */}
        <Route path="/admin/unifycard/dashboard" element={<AdminDashboardUnifyCard />} />

        <Route path="*" element={<div>Página não encontrada</div>} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
