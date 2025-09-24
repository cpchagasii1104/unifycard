// /unifycard/frontend/src/modules/product/components/product-stock-table.jsx

import React, { useEffect, useState } from 'react';
import {
  getProductById,
  updateProductStock,
} from '../services/product-service';

import styles from '../styles/product-stock-table.module.css';

const ProductStockTable = ({ productId }) => {
  const [stock, setStock] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    quantity: '',
    minimum: '',
  });

  const fetchStock = async () => {
    try {
      const data = await getProductById(productId);
      if (data.stock) {
        setStock(data.stock);
        setForm({
          quantity: data.stock.quantity || 0,
          minimum: data.stock.minimum || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchStock();
    }
  }, [productId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    try {
      await updateProductStock(stock.productStockId, {
        quantity: parseInt(form.quantity, 10),
        minimum: parseInt(form.minimum, 10),
      });
      setEditing(false);
      fetchStock();
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  if (!stock) return <div className={styles.loading}>Loading stock...</div>;

  return (
    <div className={styles.container}>
      <h3>Product Stock</h3>

      {editing ? (
        <div className={styles.form}>
          <label>
            Quantity:
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
            />
          </label>

          <label>
            Minimum:
            <input
              type="number"
              name="minimum"
              value={form.minimum}
              onChange={handleChange}
            />
          </label>

          <div className={styles.actions}>
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Quantity</th>
              <th>Reserved</th>
              <th>Minimum</th>
              <th>Status</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{stock.quantity}</td>
              <td>{stock.reserved}</td>
              <td>{stock.minimum}</td>
              <td>
                {stock.quantity <= stock.minimum ? (
                  <span className={styles.alert}>Low</span>
                ) : (
                  <span className={styles.ok}>OK</span>
                )}
              </td>
              <td>
                <button onClick={() => setEditing(true)}>Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ProductStockTable;