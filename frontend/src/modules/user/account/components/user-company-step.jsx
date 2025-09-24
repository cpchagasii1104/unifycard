import React, { useEffect, useState, useContext } from 'react';
import { useAuth } from 'modules/user/auth/contexts/auth-context';
import {
  getUserCompanyLink,
  updateUserCompanyLink,
  getAvailableCompanies,
} from '../../services/user-service';

import styles from '../styles/user-company-step.module.css';

const UserCompanyStep = () => {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  const fetchUserCompany = async () => {
    try {
      const data = await getUserCompanyLink(user.userId);
      if (data?.companyId) {
        setCompanyId(data.companyId);
      }
    } catch (err) {
      console.error('Error fetching user company:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const list = await getAvailableCompanies();
      setCompanies(list);
    } catch (err) {
      console.error('Error loading companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserCompany();
    fetchCompanies();
  }, []);

  const handleChange = (e) => {
    setCompanyId(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateUserCompanyLink(user.userId, { companyId });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating company link:', err);
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>Company Link</h2>

      <label>
        Select your company:
        <select value={companyId} onChange={handleChange} required>
          <option value="">Select...</option>
          {companies.map((c) => (
            <option key={c.companyId} value={c.companyId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <button type="submit">Save</button>

      {success && <p className={styles.success}>Company linked successfully!</p>}
    </form>
  );
};

export default UserCompanyStep;
