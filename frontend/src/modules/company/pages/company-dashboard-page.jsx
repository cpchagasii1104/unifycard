import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import { getCompanyById } from '../services/company-service';

import styles from '../styles/company-dashboard-page.module.css';

const CompanyDashboardPage = () => {
  const { user } = useContext(AuthContext);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCompany = async () => {
    try {
      if (user?.companyId) {
        const data = await getCompanyById(user.companyId);
        setCompany(data);
      }
    } catch (error) {
      console.error('Failed to load company dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, []);

  if (loading) return <div className={styles.loading}>Loading dashboard...</div>;
  if (!company) return <div className={styles.error}>Company not found</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Company Dashboard</h1>

      {/* 👤 Empresa resumida */}
      <div className={styles.summary}>
        <h2>{company.name}</h2>
        <p>{company.profile?.description}</p>
      </div>

      {/* 📦 Cards de módulos */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <h3>Products</h3>
          <p>{company.products?.length ?? 0} registered</p>
          {/* botão de atalho */}
        </div>
        <div className={styles.card}>
          <h3>Employees</h3>
          <p>{company.employees?.length ?? 0} active</p>
        </div>
        <div className={styles.card}>
          <h3>Schedule</h3>
          <p>{company.schedules?.length ?? 0} slots</p>
        </div>
        <div className={styles.card}>
          <h3>Custom Fields</h3>
          <p>{company.customFields?.length ?? 0} configured</p>
        </div>
      </div>

      {/* 🔮 Futuras integrações */}
      <div className={styles.futureSection}>
        <h4>Coming soon:</h4>
        <ul>
          <li>Activity feed</li>
          <li>Permission management</li>
          <li>Financial reports</li>
          <li>Customer engagement</li>
        </ul>
      </div>
    </div>
  );
};

export default CompanyDashboardPage;
