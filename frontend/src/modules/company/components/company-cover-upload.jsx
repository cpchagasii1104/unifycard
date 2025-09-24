import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '@/auth/contexts/auth-context';
import { getCompanyById, uploadCompanyImage } from '../services/company-service';

import styles from '../styles/company-cover-upload.module.css';

const CompanyCoverUpload = () => {
  const { user } = useContext(AuthContext);
  const [coverUrl, setCoverUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const fetchCover = async () => {
    try {
      const data = await getCompanyById(user.companyId);
      setCoverUrl(data.coverImage?.imageUrl || null);
    } catch (error) {
      console.error('Failed to load cover image:', error);
    }
  };

  useEffect(() => {
    if (user?.companyId) {
      fetchCover();
    }
  }, [user]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type.startsWith('image/')) {
      setFile(selected);
    } else {
      alert('Please select a valid image file.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('type', 'cover');
    formData.append('image', file);

    try {
      setUploading(true);
      await uploadCompanyImage(user.companyId, formData);
      await fetchCover();
      setFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3>Cover Image</h3>

      {coverUrl ? (
        <div className={styles.preview}>
          <img src={coverUrl} alt="Current cover" />
        </div>
      ) : (
        <p>No cover image uploaded yet.</p>
      )}

      <input type="file" accept="image/*" onChange={handleFileChange} />

      <button onClick={handleUpload} disabled={uploading || !file}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
};

export default CompanyCoverUpload;
