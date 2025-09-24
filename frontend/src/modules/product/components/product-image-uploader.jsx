import React, { useState } from 'react';
import { uploadProductImage } from '../services/product-service';

import styles from '../styles/product-image-uploader.module.css';

const ProductImageUploader = ({ productId, onUpload }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState([]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    setPreview(selected.map((file) => URL.createObjectURL(file)));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('image', files[i]);
        formData.append('isPrimary', i === 0); // Primeira imagem é a principal
        formData.append('sortOrder', i);

        await uploadProductImage(productId, formData);
      }

      if (typeof onUpload === 'function') {
        onUpload(); // callback para recarregar imagens
      }

      setFiles([]);
      setPreview([]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3>Upload Product Images</h3>

      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />

      {preview.length > 0 && (
        <div className={styles.previewGrid}>
          {preview.map((src, i) => (
            <div key={i} className={styles.previewBox}>
              <img src={src} alt={`preview-${i}`} />
              {i === 0 && <span className={styles.primaryTag}>Primary</span>}
            </div>
          ))}
        </div>
      )}

      <button onClick={handleUpload} disabled={uploading || !files.length}>
        {uploading ? 'Uploading...' : 'Upload Images'}
      </button>
    </div>
  );
};

export default ProductImageUploader;
