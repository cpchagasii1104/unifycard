import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import { getCompanyById } from '../services/company-service';

import styles from '../styles/company-employees-table.module.css';

const CompanyEmployeesTable = () => {
  const { user } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    try {
      if (user?.companyId) {
        const company = await getCompanyById(user.companyId);
        setEmployees(company.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  if (loading) return <div className={styles.loading}>Loading employees...</div>;

  return (
    <div className={styles.container}>
      <h2>Company Employees</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            {/* 🔐 Pronto para ações futuras */}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && (
            <tr>
              <td colSpan="5">No employees found.</td>
            </tr>
          )}
          {employees.map((emp) => (
            <tr key={emp.companyEmployeeId}>
              <td>{emp.name || emp.user?.name || '—'}</td>
              <td>{emp.email || emp.user?.email || '—'}</td>
              <td>{emp.role}</td>
              <td>{emp.status}</td>
              <td>
                {/* 🔧 Integrações futuras */}
                <button className={styles.actionBtn}>Edit</button>
                <button className={styles.actionBtn}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyEmployeesTable;
