// /unifycard/frontend/src/modules/product/services/product-service.js

import api from '../../../services/api';

// 🔹 Produto base

export const getProductsByCompany = async (companyId) => {
  const res = await api.get(`/product/company/${companyId}`);
  return res.data;
};

export const getProductById = async (productId) => {
  const res = await api.get(`/product/${productId}`);
  return res.data;
};

export const createProduct = async (userId, productData) => {
  const res = await api.post(`/product`, {
    ...productData,
    createdBy: userId,
  });
  return res.data;
};

export const updateProduct = async (productId, updateData) => {
  const res = await api.put(`/product/${productId}`, updateData);
  return res.data;
};

export const deleteProduct = async (productId) => {
  const res = await api.delete(`/product/${productId}`);
  return res.data;
};

// 🔸 Categorias

export const getProductCategories = async () => {
  const res = await api.get(`/product/categories`);
  return res.data;
};

// 🖼️ Imagens

export const uploadProductImage = async (productId, formData) => {
  const res = await api.post(`/product/${productId}/images`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

// 📦 Estoque

export const updateProductStock = async (productStockId, stockData) => {
  const res = await api.put(`/product/stock/${productStockId}`, stockData);
  return res.data;
};

// 💰 Histórico de preços

export const registerPriceChange = async (productId, newPrice, changeType, userId) => {
  const res = await api.post(`/product/${productId}/price-history`, {
    newPrice,
    changeType,
    userId,
  });
  return res.data;
};
