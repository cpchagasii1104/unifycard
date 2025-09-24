// /unifycard/frontend/src/modules/product/components/product-form.jsx

import React, { useEffect, useState } from 'react';
import {
  createProduct,
  updateProduct,
  getProductCategories,
} from '../services/product-service';
import { useAuth } from '../../user/auth/contexts/auth-context';
import ProductStockTable from './product-stock-table';
import styles from '../styles/product-form.module.css';

const ProductForm = ({ product, onClose }) => {
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    tags: '',
    isVisible: true,
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        categoryId: product.categoryId || '',
        tags: product.tags?.join(', ') || '',
        isVisible: product.isVisible ?? true,
      });
    }
  }, [product]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getProductCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      tags: form.tags.split(',').map((t) => t.trim()),
      companyId: user.companyId,
    };

    try {
      if (product?.productId) {
        await updateProduct(product.productId, payload);
      } else {
        await createProduct(user.userId, payload);
      }
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>{product ? 'Edit Product' : 'New Product'}</h2>

      <label>
        Name:
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Description:
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
        />
      </label>

      <label>
        Price:
        <input
          type="number"
          name="price"
          step="0.01"
          value={form.price}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Category:
        <select
          name="categoryId"
          value={form.categoryId}
          onChange={handleChange}
          required
        >
          <option value="">Select</option>
          {categories.map((c) => (
            <option key={c.productCategoryId} value={c.productCategoryId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Tags (comma-separated):
        <input
          type="text"
          name="tags"
          value={form.tags}
          onChange={handleChange}
        />
      </label>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          name="isVisible"
          checked={form.isVisible}
          onChange={handleChange}
        />
        Visible to customers
      </label>

      <div className={styles.actions}>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>

      {/* ✅ Exibe o estoque apenas ao editar produto existente */}
      {product?.productId && (
        <div className={styles.stockTable}>
          <ProductStockTable productId={product.productId} />
        </div>
      )}
    </form>
  );
};

export default ProductForm;
