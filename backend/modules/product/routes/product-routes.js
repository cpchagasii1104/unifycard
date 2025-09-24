'use strict';

const express = require('express');
const router = express.Router();

const productController = require('../controllers/product-controller');
const authMiddleware = require('../../../middlewares/auth-middleware');

// 📦 Produtos
router.post('/', authMiddleware, productController.createProduct);
router.get('/company/:companyId', authMiddleware, productController.listProducts);
router.get('/:productId', authMiddleware, productController.getProductById);
router.put('/:productId', authMiddleware, productController.updateProduct);
router.delete('/:productId', authMiddleware, productController.deleteProduct);

// 🖼️ Imagens
router.post('/:productId/images', authMiddleware, productController.addProductImage);

// 💰 Histórico de preços
router.post('/:productId/price-history', authMiddleware, productController.registerPriceChange);

module.exports = router;
