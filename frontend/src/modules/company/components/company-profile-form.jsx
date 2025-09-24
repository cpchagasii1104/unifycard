import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import { getCompanyById, updateCompanyProfile } from '../services/company-service';

import styles from '../styles/company-profile-form.module.css';

const CompanyProfileForm = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState({
    description: '',
    segment: '',
    email: '',
    phone: '',
    website: '',
  });

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  const fetchProfile = async () => {
    try {
      if (user?.companyId) {
        const data = await getCompanyById(user.companyId);
        setProfile({
          description: data.profile?.description || '',
          segment: data.profile?.segment || '',
          email: data.profile?.email || '',
          phone: data.profile?.phone || '',
          website: data.profile?.website || '',
        });
      }
    } catch (error) {
      console.error('Failed to load company profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateCompanyProfile(user.companyId, profile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>Edit Company Profile</h2>

      <label>
        Description:
        <textarea name="description" value={profile.description} onChange={handleChange} />
      </label>

      <label>
        Segment:
        <input type="text" name="segment" value={profile.segment} onChange={handleChange} />
      </label>

      <label>
        Email:
        <input type="email" name="email" value={profile.email} onChange={handleChange} />
      </label>

      <label>
        Phone:
        <input type="text" name="phone" value={profile.phone} onChange={handleChange} />
      </label>

      <label>
        Website:
        <input type="text" name="website" value={profile.website} onChange={handleChange} />
      </label>

      <button type="submit">Save</button>

      {success && <p className={styles.success}>Profile updated successfully!</p>}
    </form>
  );
};

export default CompanyProfileForm;
