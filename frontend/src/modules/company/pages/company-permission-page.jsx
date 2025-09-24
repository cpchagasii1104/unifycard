// /unifycard/frontend/src/modules/company/pages/company-permission-page.jsx

import React from 'react';
import { useAuth } from '../../user/auth/contexts/auth-context';
import CompanyPermissionsPanel from '../components/company-permissions-panel.jsx';

const CompanyPermissionPage = () => {
  const { profile, user } = useAuth();

  if (!user || !profile) {
    return <div>Carregando dados da empresa...</div>;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Permissões da Empresa</h1>
      <p>Gerencie abaixo os acessos dos funcionários aos módulos do sistema.</p>

      {/* 🔁 Renderiza o painel real com permissões */}
      <CompanyPermissionsPanel companyId={profile.company_id} />
    </div>
  );
};

export default CompanyPermissionPage;
