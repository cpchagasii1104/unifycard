'use strict';

const express = require('express');
const router = express.Router();

const companyController = require('../controllers/company-controller');
const authMiddleware = require('../../../middlewares/auth-middleware');

// 🏢 CRUD empresa
router.post('/', authMiddleware, companyController.createCompany);
router.get('/:companyId', authMiddleware, companyController.getCompanyById);
router.put('/:companyId', authMiddleware, companyController.updateCompany);
router.delete('/:companyId', authMiddleware, companyController.deleteCompany);

// 📄 Perfil
router.get('/:companyId/profile', authMiddleware, companyController.getCompanyProfile);
router.put('/:companyId/profile', authMiddleware, companyController.updateCompanyProfile);

// 🖼️ Uploads (perfil ou capa)
router.post('/:companyId/images', authMiddleware, companyController.uploadCompanyImage);

// 🔐 Permissões de funcionário
router.put('/:companyId/permissions/:employeeId', authMiddleware, companyController.updateEmployeePermissions);

// 🧩 Campos customizados
router.get('/:companyId/custom-fields', authMiddleware, companyController.getCustomFields);
router.put('/:companyId/custom-fields/:fieldKey', authMiddleware, companyController.updateCustomFieldValue);

module.exports = router;
