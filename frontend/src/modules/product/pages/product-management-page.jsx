// /unifycard/frontend/src/modules/product/pages/product-management-page.jsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../user/auth/contexts/auth-context';
import { getProductsByCompany } from '../services/product-service';

import ProductForm from '../components/product-form';
import styles from '../styles/product-management-page.module.css';

const ProductManagementPage = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const data = await getProductsByCompany(user.companyId);
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.companyId) {
      fetchProducts();
    }
  }, [user]);

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setShowForm(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    fetchProducts();
  };

  if (loading) return <div className={styles.loading}>Loading products...</div>;

  return (
    <div className={styles.container}>
      <h1>Product Management</h1>

      <button onClick={handleCreate} className={styles.createBtn}>
        + New Product
      </button>

      {showForm && (
        <ProductForm
          product={selectedProduct}
          onClose={handleFormClose}
        />
      )}

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Visible</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId}>
                <td>{p.name}</td>
                <td>{p.category?.name || '—'}</td>
                <td>R$ {parseFloat(p.price).toFixed(2)}</td>
                <td>{p.isActive ? 'Active' : 'Inactive'}</td>
                <td>{p.isVisible ? 'Yes' : 'No'}</td>
                <td>
                  <button onClick={() => handleEdit(p)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ProductManagementPage;
