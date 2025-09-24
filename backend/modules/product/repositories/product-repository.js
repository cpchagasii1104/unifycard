'use strict';

const { Op } = require('sequelize');
const db = require('@/database');

const {
  Product,
  ProductCategory,
  ProductImage,
  ProductStock,
  ProductPriceHistory,
} = db;

// 🔍 Buscar produto por ID (completo)
const findById = async (productId) => {
  return await Product.findByPk(productId, {
    include: [
      { model: ProductCategory, as: 'category' },
      { model: ProductImage, as: 'images' },
      { model: ProductStock, as: 'stock' },
      { model: ProductPriceHistory, as: 'priceHistory' },
    ],
  });
};

// 📋 Listar produtos por empresa com filtros
const findByCompany = async (companyId, filters = {}) => {
  const where = { companyId };

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.search) {
    where.name = { [Op.iLike]: `%${filters.search}%` };
  }

  return await Product.findAll({
    where,
    include: [
      { model: ProductCategory, as: 'category' },
      { model: ProductImage, as: 'images' },
      { model: ProductStock, as: 'stock' },
    ],
    order: [['created_at', 'DESC']],
  });
};

// ➕ Criar novo produto
const create = async (data, transaction = null) => {
  return await Product.create(data, { transaction });
};

// ✏️ Atualizar produto
const update = async (product, updates, transaction = null) => {
  return await product.update(updates, { transaction });
};

// ❌ Deletar produto
const remove = async (product, transaction = null) => {
  return await product.destroy({ transaction });
};

// 📸 Adicionar imagem
const addImage = async (imageData, transaction = null) => {
  return await ProductImage.create(imageData, { transaction });
};

// 💰 Registrar histórico de preço
const addPriceHistory = async (priceData, transaction = null) => {
  return await ProductPriceHistory.create(priceData, { transaction });
};

module.exports = {
  findById,
  findByCompany,
  create,
  update,
  remove,
  addImage,
  addPriceHistory,
};
