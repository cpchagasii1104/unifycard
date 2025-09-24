import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import { getCompanyById, updateCompanyProfile } from '../services/company-service';

import styles from '../styles/company-social-links.module.css';

const CompanySocialLinks = () => {
  const { user } = useContext(AuthContext);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ type: '', url: '' });
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    try {
      const data = await getCompanyById(user.companyId);
      setLinks(data.socialLinks || []);
    } catch (error) {
      console.error('Failed to fetch social links:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleAdd = () => {
    if (!newLink.type || !newLink.url) return;
    setLinks([...links, { ...newLink }]);
    setNewLink({ type: '', url: '' });
  };

  const handleRemove = (index) => {
    const updated = [...links];
    updated.splice(index, 1);
    setLinks(updated);
  };

  const handleChange = (index, field, value) => {
    const updated = [...links];
    updated[index][field] = value;
    setLinks(updated);
  };

  const handleSave = async () => {
    try {
      await updateCompanyProfile(user.companyId, { socialLinks: links });
      alert('Social links updated');
    } catch (error) {
      console.error('Failed to save social links:', error);
    }
  };

  if (loading) return <div className={styles.loading}>Loading social links...</div>;

  return (
    <div className={styles.container}>
      <h3>Social Links</h3>

      <div className={styles.newLink}>
        <input
          type="text"
          placeholder="Type (e.g. Instagram)"
          value={newLink.type}
          onChange={(e) => setNewLink({ ...newLink, type: e.target.value })}
        />
        <input
          type="url"
          placeholder="URL"
          value={newLink.url}
          onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      <ul className={styles.linkList}>
        {links.map((link, index) => (
          <li key={index}>
            <input
              type="text"
              value={link.type}
              onChange={(e) => handleChange(index, 'type', e.target.value)}
            />
            <input
              type="url"
              value={link.url}
              onChange={(e) => handleChange(index, 'url', e.target.value)}
            />
            <button onClick={() => handleRemove(index)}>Remove</button>
          </li>
        ))}
      </ul>

      <button onClick={handleSave} className={styles.saveBtn}>
        Save Changes
      </button>
    </div>
  );
};

export default CompanySocialLinks;
