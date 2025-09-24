'use strict';

const db = require('@/database');
const { Op } = require('sequelize');

const {
  Company,
  CompanyProfile,
  CompanyCoverImage,
  CompanyProfileImage,
  CompanyEmployee,
  CompanyCategory,
  CompanyCustomField,
  CompanyCustomFieldValue,
} = db;

const findById = async (companyId) => {
  return await Company.findByPk(companyId, {
    include: [
      { model: CompanyProfile, as: 'profile' },
      { model: CompanyCoverImage, as: 'coverImage' },
      { model: CompanyProfileImage, as: 'profileImage' },
      { model: CompanyEmployee, as: 'employees' },
    ],
  });
};

const findByFilter = async (filters = {}, options = {}) => {
  const {
    name,
    sector,
    companyType,
    status,
    category,
    page = 1,
    pageSize = 20,
  } = filters;

  const where = {};

  if (name) {
    where.name = { [Op.iLike]: `%${name}%` };
  }

  if (companyType) {
    where.companyType = companyType;
  }

  if (sector) {
    where.companySector = sector;
  }

  if (status) {
    where.status = status;
  }

  const include = [];

  if (category) {
    include.push({
      model: CompanyCategory,
      as: 'category',
      where: { slug: category },
    });
  }

  const result = await Company.findAndCountAll({
    where,
    include,
    offset: (page - 1) * pageSize,
    limit: pageSize,
    order: [['createdAt', 'DESC']],
  });

  return {
    data: result.rows,
    total: result.count,
    page,
    pageSize,
    totalPages: Math.ceil(result.count / pageSize),
  };
};

const create = async (data, transaction = null) => {
  return await Company.create(data, { transaction });
};

const update = async (companyId, updates, transaction = null) => {
  const company = await Company.findByPk(companyId);
  if (!company) throw new Error('Company not found');
  return await company.update(updates, { transaction });
};

const remove = async (companyId, transaction = null) => {
  const company = await Company.findByPk(companyId);
  if (!company) throw new Error('Company not found');
  return await company.destroy({ transaction });
};

const findCustomFields = async (companyId) => {
  return await CompanyCustomField.findAll({
    where: { companyId },
    order: [['sortOrder', 'ASC']],
  });
};

const findCustomFieldValue = async (companyId, customFieldId) => {
  return await CompanyCustomFieldValue.findOne({
    where: {
      companyId,
      companyCustomFieldId: customFieldId,
    },
  });
};

module.exports = {
  findById,
  findByFilter,
  create,
  update,
  remove,
  findCustomFields,
  findCustomFieldValue,
};
