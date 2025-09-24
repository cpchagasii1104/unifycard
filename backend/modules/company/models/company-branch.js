'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanyBranch extends Model {
    static associate(models) {
      // 🔗 Empresa principal
      CompanyBranch.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });

      // 📍 Endereço específico da filial (opcional)
      CompanyBranch.belongsTo(models.CompanyAddress, {
        foreignKey: 'address_id',
        as: 'address',
        onDelete: 'SET NULL',
      });

      // 📅 Agendamentos da filial
      CompanyBranch.hasMany(models.Schedule, {
        foreignKey: 'branch_id',
        as: 'schedules',
        onDelete: 'SET NULL',
      });

      // 🔐 Permissões futuras por filial
      CompanyBranch.hasMany(models.CompanyPermission, {
        foreignKey: 'branch_id',
        as: 'permissions',
        onDelete: 'SET NULL',
      });
    }
  }

  CompanyBranch.init(
    {
      companyBranchId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'company_branch_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nome interno ou comercial da filial',
      },
      addressId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'address_id',
        comment: 'Endereço específico da filial (pode ser nulo)',
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'CompanyBranch',
      tableName: 'company_branch',
      underscored: true,
      timestamps: true,
      updatedAt: false,
      paranoid: false,
    }
  );

  return CompanyBranch;
};
