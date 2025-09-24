'use strict';

const db = require('../../../database');
const {
  Company,
  CompanyProfile,
  CompanyPermission,
  CompanyCustomField,
  CompanyCustomFieldValue,
  CompanyCoverImage,
  CompanyProfileImage,
  CompanyEmployee,
  CompanyBranch,
  Schedule,
  UserProfile,
} = db;

const createCompany = async (userId, data) => {
  return await db.sequelize.transaction(async (t) => {
    const company = await Company.create(data, { transaction: t });

    await CompanyEmployee.create({
      companyId: company.companyId,
      userId,
      role: 'admin',
      status: 'active',
    }, { transaction: t });

    await CompanyPermission.create({
      companyEmployeeId: userId,
      isAdmin: true,
    }, { transaction: t });

    await CompanyProfile.create({
      companyId: company.companyId,
    }, { transaction: t });

    return company;
  });
};

const getCompanyById = async (companyId) => {
  return await Company.findByPk(companyId, {
    include: [
      { model: CompanyProfile, as: 'profile' },
      { model: CompanyCoverImage, as: 'coverImage' },
      { model: CompanyProfileImage, as: 'profileImage' },
      { model: CompanyEmployee, as: 'employees' },
    ],
  });
};

const updateCompany = async (companyId, userId, updates) => {
  const company = await Company.findByPk(companyId);
  if (!company) throw new Error('Company not found');
  return await company.update(updates);
};

const deleteCompany = async (companyId, userId) => {
  const company = await Company.findByPk(companyId);
  if (!company) throw new Error('Company not found');
  await company.destroy();
};

const getCompanyProfile = async (companyId) => {
  return await CompanyProfile.findOne({ where: { companyId } });
};

const updateCompanyProfile = async (companyId, profileData) => {
  const profile = await CompanyProfile.findOne({ where: { companyId } });
  if (!profile) throw new Error('Company profile not found');
  return await profile.update(profileData);
};

const uploadImage = async (companyId, fileType, fileUrl, description, uploadedBy) => {
  if (fileType === 'cover') {
    return await CompanyCoverImage.create({
      companyId,
      imageUrl: fileUrl,
      description,
      uploadedBy,
    });
  }

  if (fileType === 'profile') {
    return await CompanyProfileImage.create({
      companyId,
      fileUrl,
      description,
    });
  }

  throw new Error('Invalid image type');
};

const updatePermissions = async (companyId, employeeId, permissions) => {
  const employee = await CompanyEmployee.findOne({
    where: { companyId, companyEmployeeId: employeeId },
  });

  if (!employee) throw new Error('Employee not found');

  const current = await CompanyPermission.findOne({
    where: { companyEmployeeId: employeeId },
  });

  if (current) {
    return await current.update(permissions);
  }

  return await CompanyPermission.create({
    companyEmployeeId: employeeId,
    ...permissions,
  });
};

const getCustomFields = async (companyId) => {
  return await CompanyCustomField.findAll({
    where: { companyId },
    order: [['sortOrder', 'ASC']],
  });
};

const updateCustomFieldValue = async (companyId, fieldKey, value) => {
  const field = await CompanyCustomField.findOne({
    where: { companyId, fieldKey },
  });

  if (!field) throw new Error('Field not found');

  const existing = await CompanyCustomFieldValue.findOne({
    where: {
      companyId,
      companyCustomFieldId: field.companyCustomFieldId,
    },
  });

  if (existing) {
    return await existing.update({ fieldValue: value });
  }

  return await CompanyCustomFieldValue.create({
    companyId,
    companyCustomFieldId: field.companyCustomFieldId,
    fieldValue: value,
  });
};

module.exports = {
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyProfile,
  updateCompanyProfile,
  uploadImage,
  updatePermissions,
  getCustomFields,
  updateCustomFieldValue,
};
