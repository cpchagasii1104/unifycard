import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import { getCompanyById, updateCompanyAddress } from '../services/company-service';

import styles from '../styles/company-address-form.module.css';

const CompanyAddressForm = () => {
  const { user } = useContext(AuthContext);
  const [address, setAddress] = useState({
    zipCode: '',
    state: '',
    city: '',
    neighborhood: '',
    street: '',
    number: '',
    complement: '',
  });

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  const fetchAddress = async () => {
    try {
      if (user?.companyId) {
        const data = await getCompanyById(user.companyId);
        if (data?.address) {
          setAddress({
            zipCode: data.address.zipCode || '',
            state: data.address.state || '',
            city: data.address.city || '',
            neighborhood: data.address.neighborhood || '',
            street: data.address.street || '',
            number: data.address.number || '',
            complement: data.address.complement || '',
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch company address:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddress();
  }, []);

  const handleChange = (e) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateCompanyAddress(user.companyId, address);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating address:', error);
    }
  };

  if (loading) return <div className={styles.loading}>Loading address...</div>;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>Edit Company Address</h2>

      <label>
        ZIP Code:
        <input type="text" name="zipCode" value={address.zipCode} onChange={handleChange} />
      </label>

      <label>
        State:
        <input type="text" name="state" value={address.state} onChange={handleChange} />
      </label>

      <label>
        City:
        <input type="text" name="city" value={address.city} onChange={handleChange} />
      </label>

      <label>
        Neighborhood:
        <input type="text" name="neighborhood" value={address.neighborhood} onChange={handleChange} />
      </label>

      <label>
        Street:
        <input type="text" name="street" value={address.street} onChange={handleChange} />
      </label>

      <label>
        Number:
        <input type="text" name="number" value={address.number} onChange={handleChange} />
      </label>

      <label>
        Complement:
        <input type="text" name="complement" value={address.complement} onChange={handleChange} />
      </label>

      <button type="submit">Save</button>

      {success && <p className={styles.success}>Address updated successfully!</p>}
    </form>
  );
};

export default CompanyAddressForm;
