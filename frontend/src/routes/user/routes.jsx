import React from 'react';
import { Routes, Route } from 'react-router-dom';

import UserAccountPage from '../../pages/user-account-page.jsx';

const UserRoutes = () => {
  return (
    <Routes>
      <Route path="/minha-conta" element={<UserAccountPage />} />
    </Routes>
  );
};

export default UserRoutes;
