import React, { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { getCompanyById } from '../services/company-service';
import { AuthContext } from '@/auth/contexts/auth-context';

import styles from '../styles/company-profile-page.module.css';

const CompanyProfilePage = () => {
  const { companyId } = useParams();
  const { user } = useContext(AuthContext);

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCompany = async () => {
    try {
      const data = await getCompanyById(companyId);
      setCompany(data);
    } catch (error) {
      console.error('Failed to fetch company:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchCompany();
    }
  }, [companyId]);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!company) return <div className={styles.error}>Company not found.</div>;

  return (
    <div className={styles.container}>
      {/* 📸 Capa */}
      {company.coverImage && (
        <div className={styles.cover}>
          <img src={company.coverImage.imageUrl} alt="Cover" />
        </div>
      )}

      {/* 🏢 Perfil */}
      <div className={styles.profileBox}>
        {company.profileImage && (
          <img src={company.profileImage.fileUrl} alt="Logo" className={styles.logo} />
        )}
        <h1>{company.name}</h1>
        <p>{company.profile?.description}</p>

        <div className={styles.details}>
          <p><strong>Segment:</strong> {company.profile?.segment}</p>
          <p><strong>Website:</strong> {company.profile?.website}</p>
          <p><strong>Email:</strong> {company.profile?.email}</p>
          <p><strong>Phone:</strong> {company.profile?.phone}</p>
        </div>
      </div>

      {/* 🔗 Redes sociais */}
      {company.socialLinks?.length > 0 && (
        <div className={styles.social}>
          <h3>Social Links</h3>
          <ul>
            {company.socialLinks.map((link) => (
              <li key={link.companySocialLinkId}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label || link.type}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🧩 Campos customizados */}
      {company.customFields?.length > 0 && (
        <div className={styles.customFields}>
          <h3>Additional Information</h3>
          <ul>
            {company.customFields.map((field) => (
              <li key={field.companyCustomFieldId}>
                <strong>{field.fieldLabel}:</strong> {field.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CompanyProfilePage;
