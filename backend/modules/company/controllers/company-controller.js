'use strict';

const companyService = require('../services/company-service');

const createCompany = async (req, res, next) => {
  try {
    const { userId } = req.auth; // 🔐 auth-middleware obrigatório
    const data = req.body;

    const newCompany = await companyService.createCompany(userId, data);
    return res.status(201).json(newCompany);
  } catch (error) {
    next(error);
  }
};

const getCompanyById = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const company = await companyService.getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    return res.json(company);
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { userId } = req.auth;
    const updates = req.body;

    const updated = await companyService.updateCompany(companyId, userId, updates);
    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { userId } = req.auth;

    await companyService.deleteCompany(companyId, userId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// 📄 Perfil completo com vínculos
const getCompanyProfile = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const profile = await companyService.getCompanyProfile(companyId);
    return res.json(profile);
  } catch (error) {
    next(error);
  }
};

const updateCompanyProfile = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const profileData = req.body;

    const updatedProfile = await companyService.updateCompanyProfile(companyId, profileData);
    return res.json(updatedProfile);
  } catch (error) {
    next(error);
  }
};

// 🖼️ Uploads de imagem (perfil ou capa)
const uploadCompanyImage = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { fileType } = req.query; // 'cover' ou 'profile'
    const { fileUrl, description } = req.body;

    const result = await companyService.uploadImage(companyId, fileType, fileUrl, description, req.auth.userId);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// 🔐 Permissões dos funcionários
const updateEmployeePermissions = async (req, res, next) => {
  try {
    const { companyId, employeeId } = req.params;
    const permissions = req.body;

    const updated = await companyService.updatePermissions(companyId, employeeId, permissions);
    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

// 🧩 Campos customizados (painel dinâmico)
const getCustomFields = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const fields = await companyService.getCustomFields(companyId);
    return res.json(fields);
  } catch (error) {
    next(error);
  }
};

const updateCustomFieldValue = async (req, res, next) => {
  try {
    const { companyId, fieldKey } = req.params;
    const { value } = req.body;

    const result = await companyService.updateCustomFieldValue(companyId, fieldKey, value);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyProfile,
  updateCompanyProfile,
  uploadCompanyImage,
  updateEmployeePermissions,
  getCustomFields,
  updateCustomFieldValue,
};
