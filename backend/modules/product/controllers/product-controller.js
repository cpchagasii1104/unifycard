'use strict';

const productService = require('../services/product-service');

// 📦 Criar novo produto
const createProduct = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const productData = req.body;
    const result = await productService.createProduct(userId, productData);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// 📋 Listar produtos de uma empresa
const listProducts = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const filters = req.query;
    const result = await productService.listProducts(companyId, filters);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

// 🔍 Obter produto por ID
const getProductById = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const product = await productService.getProductById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json(product);
  } catch (error) {
    next(error);
  }
};

// ✏️ Atualizar produto
const updateProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const updates = req.body;
    const result = await productService.updateProduct(productId, updates);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

// ❌ Excluir produto
const deleteProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    await productService.deleteProduct(productId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// 🖼️ Adicionar imagem ao produto
const addProductImage = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const imageData = req.body;
    const result = await productService.addProductImage(productId, imageData);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// 📈 Registrar histórico de preço
const registerPriceChange = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { newPrice, changeType } = req.body;
    const { userId } = req.auth;
    const result = await productService.registerPriceChange(productId, newPrice, changeType, userId);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addProductImage,
  registerPriceChange,
};
