// /unifycard/frontend/src/modules/company/components/company-permissions-panel.jsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../user/auth/contexts/auth-context';
import {
  getCompanyById,
  updateEmployeePermissions,
} from '../services/company-service';

import styles from '../styles/company-permissions-panel.module.css';

const CompanyPermissionsPanel = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const fetchPermissions = async () => {
    try {
      if (user?.companyId) {
        const data = await getCompanyById(user.companyId);
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handlePermissionChange = async (employeeId, permissionName, value) => {
    try {
      setSavingId(employeeId);
      await updateEmployeePermissions(user.companyId, employeeId, {
        [permissionName]: value,
      });
      await fetchPermissions();
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className={styles.loading}>Carregando permissões...</div>;

  return (
    <div className={styles.container}>
      <h2>Permissões dos Funcionários</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Administrador</th>
            <th>Editar</th>
            <th>Relatórios</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && (
            <tr>
              <td colSpan="5">Nenhum funcionário encontrado.</td>
            </tr>
          )}
          {employees.map((emp) => (
            <tr key={emp.companyEmployeeId}>
              <td>{emp.name || emp.user?.name || '—'}</td>
              <td>
                <input
                  type="checkbox"
                  checked={emp.permissions?.isAdmin || false}
                  disabled={savingId === emp.companyEmployeeId}
                  onChange={(e) =>
                    handlePermissionChange(
                      emp.companyEmployeeId,
                      'isAdmin',
                      e.target.checked
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={emp.permissions?.canEdit || false}
                  disabled={savingId === emp.companyEmployeeId}
                  onChange={(e) =>
                    handlePermissionChange(
                      emp.companyEmployeeId,
                      'canEdit',
                      e.target.checked
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={emp.permissions?.canViewReports || false}
                  disabled={savingId === emp.companyEmployeeId}
                  onChange={(e) =>
                    handlePermissionChange(
                      emp.companyEmployeeId,
                      'canViewReports',
                      e.target.checked
                    )
                  }
                />
              </td>
              <td>{emp.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyPermissionsPanel;
